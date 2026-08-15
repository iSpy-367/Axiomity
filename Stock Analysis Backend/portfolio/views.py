import concurrent.futures
import yfinance as yf
from django.utils import timezone
from rest_framework import generics, permissions, status as http_status, views
from rest_framework.response import Response

from stocks.views import _resolve_symbol
from .models import Portfolio, BUY_BROKERAGE_RATE, SELL_BROKERAGE_RATE, BROKERAGE_RATE
from .serializers import PortfolioSerializer


def _refresh_portfolio_prices(portfolio_items):
    # Only refresh stocks for ACTIVE positions
    stocks_to_update = list(set([
        item.stock for item in portfolio_items 
        if item.status == 'active' and item.stock and item.stock.symbol
    ]))
    if not stocks_to_update:
        return

    def update_stock(stock):
        try:
            sym = stock.symbol
            # If stock symbol does not have exchange suffix, resolve it canonically
            if not sym.endswith('.NS') and not sym.endswith('.BO') and not sym.startswith('^'):
                res = _resolve_symbol(sym)
                if res and res[0]:
                    stock.symbol = res[0]
                    sym = res[0]
                    if res[1]:
                        stock.name = (res[1] or {}).get('longName') or (res[1] or {}).get('shortName') or stock.name
                    if res[2] is not None and not res[2].empty:
                        valid_closes = res[2]['Close'].dropna()
                        valid_closes = valid_closes[valid_closes > 0]
                        if not valid_closes.empty:
                            stock.current_price = float(valid_closes.iloc[-1])
                            stock.save()
                            return

            ticker = yf.Ticker(sym)
            hist = ticker.history(period='5d', auto_adjust=False)
            if not hist.empty:
                valid_closes = hist['Close'].dropna()
                valid_closes = valid_closes[valid_closes > 0]
                if not valid_closes.empty:
                    latest_close = float(valid_closes.iloc[-1])
                    if latest_close > 0:
                        stock.current_price = latest_close
                        stock.save(update_fields=['current_price', 'last_updated'])
        except Exception:
            pass

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(update_stock, stocks_to_update))


class PortfolioListCreateView(generics.ListCreateAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user).select_related('stock').order_by('-date_added')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        _refresh_portfolio_prices(queryset)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PortfolioDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == 'exited':
            buy_price = instance.buy_price
            exit_price = instance.exit_price or instance.stock.current_price or buy_price
            qty = instance.quantity
            invested = buy_price * qty
            exit_val = exit_price * qty
            gross = exit_val - invested
            buy_brk = BUY_BROKERAGE_RATE * invested
            sell_brk = SELL_BROKERAGE_RATE * exit_val
            brk = round(buy_brk + sell_brk, 2)
            net = round(gross - brk, 2)

            instance.realized_gross_pnl = round(gross, 2)
            instance.realized_brokerage = brk
            instance.realized_net_pnl = net
            instance.save()


class PortfolioExitView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        portfolio_item = Portfolio.objects.filter(pk=pk, user=request.user).first()
        if not portfolio_item:
            return Response({'detail': 'Position not found.'}, status=http_status.HTTP_404_NOT_FOUND)

        if portfolio_item.status == 'exited':
            return Response({'detail': 'Position is already exited.'}, status=http_status.HTTP_400_BAD_REQUEST)

        exit_price_val = request.data.get('exit_price')
        if exit_price_val is not None and str(exit_price_val).strip() != '':
            exit_price = float(exit_price_val)
        else:
            exit_price = portfolio_item.stock.current_price or portfolio_item.buy_price

        sell_date_val = request.data.get('sell_date')
        if sell_date_val and str(sell_date_val).strip() != '':
            sell_date = sell_date_val
        else:
            sell_date = timezone.now().date()

        invested = portfolio_item.buy_price * portfolio_item.quantity
        exit_val = exit_price * portfolio_item.quantity
        gross_pnl = exit_val - invested
        buy_brokerage = BUY_BROKERAGE_RATE * invested
        sell_brokerage = SELL_BROKERAGE_RATE * exit_val
        brokerage = round(buy_brokerage + sell_brokerage, 2)
        net_pnl = round(gross_pnl - brokerage, 2)

        portfolio_item.status = 'exited'
        portfolio_item.exit_price = exit_price
        portfolio_item.sell_date = sell_date
        portfolio_item.realized_gross_pnl = round(gross_pnl, 2)
        portfolio_item.realized_brokerage = brokerage
        portfolio_item.realized_net_pnl = net_pnl
        portfolio_item.save()

        serializer = PortfolioSerializer(portfolio_item)
        return Response(serializer.data)

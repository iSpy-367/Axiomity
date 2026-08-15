import concurrent.futures
import yfinance as yf
from rest_framework import generics, permissions
from rest_framework.response import Response

from stocks.views import _resolve_symbol
from .models import Portfolio
from .serializers import PortfolioSerializer


def _refresh_portfolio_prices(portfolio_items):
    stocks_to_update = list(set([item.stock for item in portfolio_items if item.stock and item.stock.symbol]))
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


class PortfolioDetailView(generics.DestroyAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)

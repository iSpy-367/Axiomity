import concurrent.futures
import yfinance as yf
from rest_framework import generics, permissions
from rest_framework.response import Response

from .models import Portfolio
from .serializers import PortfolioSerializer


def _refresh_portfolio_prices(portfolio_items):
    stocks_to_update = list(set([item.stock for item in portfolio_items if item.stock and item.stock.symbol]))
    if not stocks_to_update:
        return

    def update_stock(stock):
        try:
            ticker = yf.Ticker(stock.symbol)
            hist = ticker.history(period='5d', auto_adjust=False)
            if not hist.empty:
                latest_close = float(hist['Close'].dropna().iloc[-1])
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

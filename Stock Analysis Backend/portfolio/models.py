from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

BUY_BROKERAGE_RATE = 0.0015   # 0.15% buying brokerage on buy turnover
SELL_BROKERAGE_RATE = 0.0015  # 0.15% selling brokerage on LTP / exit turnover
BROKERAGE_RATE = 0.003        # Total combined 0.30% rate

STATUS_CHOICES = [
    ('active', 'Active'),
    ('exited', 'Exited'),
]

class Portfolio(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    stock = models.ForeignKey('stocks.Stock', on_delete=models.CASCADE)
    quantity = models.IntegerField()
    buy_price = models.FloatField()
    buy_date = models.DateField(default=timezone.now)
    sell_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    exit_price = models.FloatField(null=True, blank=True)
    realized_gross_pnl = models.FloatField(null=True, blank=True)
    realized_brokerage = models.FloatField(null=True, blank=True)
    realized_net_pnl = models.FloatField(null=True, blank=True)
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.stock.symbol} ({self.status})"
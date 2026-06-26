from django.db import models
from django.contrib.auth.models import User

class Portfolio(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    stock = models.ForeignKey('stocks.Stock', on_delete=models.CASCADE)
    quantity = models.IntegerField()
    buy_price = models.FloatField()
    date_added = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.stock.symbol}"
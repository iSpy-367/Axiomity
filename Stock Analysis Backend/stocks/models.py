from django.db import models

class Stock(models.Model):
    symbol = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    current_price = models.FloatField(null=True)
    volume = models.BigIntegerField(null=True)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.symbol

class StockHistory(models.Model):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE)
    date = models.DateField()
    open_price = models.FloatField()
    close_price = models.FloatField()
    high = models.FloatField()
    low = models.FloatField()
    volume = models.BigIntegerField()

    def __str__(self):
        return f"{self.stock.symbol} - {self.date}"

class Prediction(models.Model):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)
    recommendation = models.CharField(max_length=10)
    confidence = models.FloatField()
    rsi = models.FloatField(null=True)
    macd = models.FloatField(null=True)

    def __str__(self):
        return f"{self.stock.symbol} - {self.recommendation}"


class FiiDiiActivity(models.Model):
    date = models.DateField(unique=True, db_index=True)
    fii_buy_value = models.FloatField(default=0.0)
    fii_sell_value = models.FloatField(default=0.0)
    fii_net_value = models.FloatField(default=0.0)
    dii_buy_value = models.FloatField(default=0.0)
    dii_sell_value = models.FloatField(default=0.0)
    dii_net_value = models.FloatField(default=0.0)
    total_net_value = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']
        verbose_name_plural = 'FII / DII Activities'

    def __str__(self):
        return f"{self.date} | FII Net: {self.fii_net_value} | DII Net: {self.dii_net_value}"
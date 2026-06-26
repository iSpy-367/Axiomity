from django.contrib import admin
from .models import Stock, StockHistory, Prediction

admin.site.register(Stock)
admin.site.register(StockHistory)
admin.site.register(Prediction)
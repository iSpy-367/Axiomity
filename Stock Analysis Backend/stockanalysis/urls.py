from django.contrib import admin
from django.urls import path, include
from stocks.views import fii_dii_activity_view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/stocks/', include('stocks.urls')),
    path('api/users/', include('users.urls')),
    path('api/portfolio/', include('portfolio.urls')),
    path('api/market/fii-dii/', fii_dii_activity_view, name='market_fii_dii'),
]
from django.urls import path
from . import views

urlpatterns = [
    path('search/', views.search_stocks, name='search_stocks'),
    path('fetch/<str:symbol>/', views.fetch_stock_data, name='fetch_stock'),
    path('get/<str:symbol>/', views.get_stock, name='get_stock'),
    path('analyze/<str:symbol>/', views.analyze_stock, name='analyze_stock'),
    path('top-movers/', views.top_movers, name='top_movers'),
]
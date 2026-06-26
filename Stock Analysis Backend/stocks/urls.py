from django.urls import path
from . import views

urlpatterns = [
    path('fetch/<str:symbol>/', views.fetch_stock_data, name='fetch_stock'),
    path('get/<str:symbol>/', views.get_stock, name='get_stock'),
    path('analyze/<str:symbol>/', views.analyze_stock, name='analyze_stock'),
]
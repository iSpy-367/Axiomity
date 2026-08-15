from django.urls import path
from . import views

urlpatterns = [
    path('', views.PortfolioListCreateView.as_view(), name='portfolio-list'),
    path('<int:pk>/', views.PortfolioDetailView.as_view(), name='portfolio-detail'),
    path('<int:pk>/exit/', views.PortfolioExitView.as_view(), name='portfolio-exit'),
]

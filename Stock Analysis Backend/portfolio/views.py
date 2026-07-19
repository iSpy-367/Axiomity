from rest_framework import generics, permissions

from .models import Portfolio
from .serializers import PortfolioSerializer


class PortfolioListCreateView(generics.ListCreateAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user).select_related('stock').order_by('-date_added')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PortfolioDetailView(generics.DestroyAPIView):
    serializer_class = PortfolioSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Portfolio.objects.filter(user=self.request.user)

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from stocks.models import Stock
from .models import Portfolio


class PortfolioAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='portfolio_user', password='testpass123')
        self.client.force_authenticate(user=self.user)
        self.stock = Stock.objects.create(symbol='AAPL', name='Apple Inc.', current_price=190.0)

    def test_list_and_create_portfolio_items(self):
        response = self.client.get(reverse('portfolio-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

        create_response = self.client.post(reverse('portfolio-list'), {
            'symbol': 'AAPL',
            'quantity': 5,
            'buy_price': 180.0,
        }, format='json')

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['symbol'], 'AAPL')
        self.assertEqual(create_response.data['quantity'], 5)
        self.assertEqual(create_response.data['buy_price'], 180.0)
        self.assertIn('pnl', create_response.data)
        self.assertIn('net_gain', create_response.data)

    def test_delete_portfolio_item(self):
        portfolio_item = Portfolio.objects.create(user=self.user, stock=self.stock, quantity=2, buy_price=170.0)

        response = self.client.delete(reverse('portfolio-detail', args=[portfolio_item.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Portfolio.objects.filter(id=portfolio_item.id).exists())

    def test_merge_duplicate_portfolio_entries(self):
        Portfolio.objects.create(user=self.user, stock=self.stock, quantity=2, buy_price=170.0)

        response = self.client.post(reverse('portfolio-list'), {
            'symbol': 'AAPL',
            'quantity': 3,
            'buy_price': 180.0,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Portfolio.objects.filter(user=self.user, stock=self.stock).count(), 1)

        item = Portfolio.objects.get(user=self.user, stock=self.stock)
        self.assertEqual(item.quantity, 5)
        self.assertEqual(item.buy_price, 176.0)
        self.assertEqual(response.data['quantity'], 5)
        self.assertEqual(response.data['buy_price'], 176.0)

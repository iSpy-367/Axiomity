from unittest.mock import patch, MagicMock
from django.test import SimpleTestCase
from rest_framework.test import APIClient
import pandas as pd
import datetime

from .analysis import generate_recommendation
from .symbol_master import symbol_master
from .views import _resolve_symbol, _is_valid_stock_ticker


class RecommendationTests(SimpleTestCase):
    def test_generate_recommendation_handles_short_series(self):
        result = generate_recommendation([100.0])
        self.assertEqual(result['recommendation'], 'Hold')
        self.assertEqual(result['confidence'], 50.0)
        self.assertEqual(result['rsi'], 50.0)


class SymbolResolutionTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()

    def test_symbol_master_canonical_lookup(self):
        vbl = symbol_master.lookup('VBL')
        self.assertIsNotNone(vbl)
        self.assertEqual(vbl['symbol'], 'VBL')
        self.assertIn('Varun Beverages', vbl['name'])

        reliance = symbol_master.lookup('reliance.ns')
        self.assertIsNotNone(reliance)
        self.assertEqual(reliance['symbol'], 'RELIANCE')

    def test_real_nse_symbol_resolution(self):
        dummy_hist = pd.DataFrame([{
            'Open': 1500.0, 'High': 1520.0, 'Low': 1490.0, 'Close': 1510.0, 'Volume': 500000
        }], index=pd.to_datetime([datetime.date.today()]))

        with patch('yfinance.Ticker') as mock_ticker:
            instance = MagicMock()
            instance.history.return_value = dummy_hist
            instance.info = {'currency': 'INR', 'exchange': 'NSI', 'currentPrice': 1510.0}
            mock_ticker.return_value = instance

            resolved_sym, info, hist, exchange = _resolve_symbol('VBL')
            self.assertEqual(resolved_sym, 'VBL.NS')
            self.assertEqual(exchange, 'NSE')
            self.assertEqual(info.get('currency'), 'INR')

    def test_real_bse_only_symbol_resolution(self):
        dummy_hist = pd.DataFrame([{
            'Open': 3000.0, 'High': 3050.0, 'Low': 2980.0, 'Close': 3020.0, 'Volume': 10000
        }], index=pd.to_datetime([datetime.date.today()]))

        with patch('yfinance.Ticker') as mock_ticker:
            instance = MagicMock()
            instance.history.return_value = dummy_hist
            instance.info = {'currency': 'INR', 'exchange': 'BSE', 'currentPrice': 3020.0}
            mock_ticker.return_value = instance

            resolved_sym, info, hist, exchange = _resolve_symbol('500325')
            self.assertEqual(resolved_sym, '500325.BO')
            self.assertEqual(exchange, 'BSE')

    def test_foreign_collision_prevention_visl(self):
        dummy_hist = pd.DataFrame([{
            'Open': 250.0, 'High': 255.0, 'Low': 248.0, 'Close': 252.0, 'Volume': 20000
        }], index=pd.to_datetime([datetime.date.today()]))

        with patch('yfinance.Ticker') as mock_ticker:
            def ticker_side_effect(symbol_arg):
                if symbol_arg == 'VISL':
                    raise AssertionError("Raw unsuffixed ticker was queried against yfinance global namespace!")
                inst = MagicMock()
                inst.history.return_value = dummy_hist
                inst.info = {'currency': 'INR', 'exchange': 'NSI', 'currentPrice': 252.0}
                return inst

            mock_ticker.side_effect = ticker_side_effect

            resolved_sym, info, hist, exchange = _resolve_symbol('VISL')
            self.assertEqual(resolved_sym, 'VISL.NS')
            self.assertEqual(exchange, 'NSE')

    def test_flaky_thin_data_resilience_vbl(self):
        dummy_hist = pd.DataFrame([{
            'Open': 1500.0, 'High': 1520.0, 'Low': 1490.0, 'Close': 1510.0, 'Volume': 500000
        }], index=pd.to_datetime([datetime.date.today()]))

        mock_ticker = MagicMock()
        mock_ticker.history.return_value = dummy_hist
        mock_ticker.info = {'currency': 'INR', 'exchange': 'NSI', 'currentPrice': 1510.0}

        valid, info, hist = _is_valid_stock_ticker(mock_ticker, is_confirmed_symbol=True)
        self.assertTrue(valid)

    def test_genuinely_invalid_symbol(self):
        with patch('yfinance.Ticker') as mock_ticker:
            inst = MagicMock()
            inst.history.return_value = pd.DataFrame()
            inst.info = {}
            mock_ticker.return_value = inst

            resolved_sym, info, hist, exchange = _resolve_symbol('INVALIDXYZ999')
            self.assertIsNone(resolved_sym)
            self.assertIsNone(exchange)

    def test_autocomplete_search_endpoint(self):
        response = self.client.get('/api/stocks/search/?q=VARUN')
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', [])
        self.assertTrue(any(r['symbol'] == 'VBL' for r in results))

        response = self.client.get('/api/stocks/search/?q=RELIANCE')
        self.assertEqual(response.status_code, 200)
        results = response.data.get('results', [])
        self.assertTrue(any(r['symbol'] == 'RELIANCE' for r in results))

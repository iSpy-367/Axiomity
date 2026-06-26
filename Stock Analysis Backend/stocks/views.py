from django.shortcuts import render
from rest_framework.decorators import api_view
from rest_framework.response import Response
import yfinance as yf
from .models import Stock, StockHistory, Prediction
from .analysis import generate_recommendation
import pandas as pd
import numpy as np

@api_view(['GET'])
def fetch_stock_data(request, symbol):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        stock, created = Stock.objects.get_or_create(symbol=symbol)
        stock.name = info.get('longName', symbol)
        stock.current_price = info.get('currentPrice', 0)
        stock.volume = info.get('volume', 0)
        stock.save()
        
        hist = ticker.history(period="1y")
        for date, row in hist.iterrows():
            StockHistory.objects.update_or_create(
                stock=stock,
                date=date.date(),
                defaults={
                    'open_price': row['Open'],
                    'close_price': row['Close'],
                    'high': row['High'],
                    'low': row['Low'],
                    'volume': row['Volume'],
                }
            )
        
        return Response({'message': f'{symbol} data fetched successfully', 'price': stock.current_price})
    
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
def get_stock(request, symbol):
    try:
        stock = Stock.objects.get(symbol=symbol)
        history = StockHistory.objects.filter(stock=stock).order_by('date').values()
        return Response({
            'symbol': stock.symbol,
            'name': stock.name,
            'current_price': stock.current_price,
            'volume': stock.volume,
            'history': list(history)
        })
    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found'}, status=404)

@api_view(['GET'])
def analyze_stock(request, symbol):
    try:
        stock = Stock.objects.get(symbol=symbol)
        history = StockHistory.objects.filter(stock=stock).order_by('date')
        
        prices = pd.Series([h.close_price for h in history])
        
        result = generate_recommendation(prices)
        
        Prediction.objects.create(
            stock=stock,
            recommendation=result['recommendation'],
            confidence=result['confidence'],
            rsi=result['rsi'],
            macd=result['macd']
        )
        
        return Response({
            'symbol': symbol,
            'name': stock.name,
            'current_price': stock.current_price,
            **result
        })
    
    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found. Fetch it first.'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400)
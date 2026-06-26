import pandas as pd
import numpy as np

def calculate_rsi(prices, period=14):
    delta = prices.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(prices):
    ema12 = prices.ewm(span=12, adjust=False).mean()
    ema26 = prices.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    return macd, signal

def calculate_moving_averages(prices):
    ma20 = prices.rolling(window=20).mean()
    ma50 = prices.rolling(window=50).mean()
    return ma20, ma50

def generate_recommendation(prices):
    rsi = calculate_rsi(prices)
    macd, signal = calculate_macd(prices)
    ma20, ma50 = calculate_moving_averages(prices)
    
    latest_rsi = rsi.iloc[-1]
    latest_macd = macd.iloc[-1]
    latest_signal = signal.iloc[-1]
    latest_ma20 = ma20.iloc[-1]
    latest_ma50 = ma50.iloc[-1]
    latest_price = prices.iloc[-1]
    
    score = 0
    
    # RSI signals
    if latest_rsi < 30:
        score += 2  # Oversold - Buy
    elif latest_rsi > 70:
        score -= 2  # Overbought - Sell
    
    # MACD signals
    if latest_macd > latest_signal:
        score += 1  # Bullish
    else:
        score -= 1  # Bearish
    
    # Moving average signals
    if latest_price > latest_ma20 > latest_ma50:
        score += 1  # Uptrend
    elif latest_price < latest_ma20 < latest_ma50:
        score -= 1  # Downtrend
    
    # Generate recommendation
    if score >= 2:
        recommendation = "Buy"
        confidence = min(score / 4 * 100, 100)
    elif score <= -2:
        recommendation = "Sell"
        confidence = min(abs(score) / 4 * 100, 100)
    else:
        recommendation = "Hold"
        confidence = 50
    
    return {
        'recommendation': recommendation,
        'confidence': round(confidence, 2),
        'rsi': round(latest_rsi, 2),
        'macd': round(latest_macd, 2),
        'ma20': round(latest_ma20, 2),
        'ma50': round(latest_ma50, 2),
    }
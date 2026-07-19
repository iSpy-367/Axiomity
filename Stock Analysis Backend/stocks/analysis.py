import pandas as pd
import numpy as np


def calculate_rsi(prices, period=14):
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty or len(prices) < 2:
        return pd.Series([50.0], index=prices.index)

    delta = prices.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50.0)


def calculate_macd(prices):
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty:
        return pd.Series([0.0]), pd.Series([0.0])

    ema12 = prices.ewm(span=12, adjust=False).mean()
    ema26 = prices.ewm(span=26, adjust=False).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()
    return macd, signal


def calculate_moving_averages(prices):
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty:
        return pd.Series([0.0]), pd.Series([0.0])

    ma20 = prices.rolling(window=20).mean()
    ma50 = prices.rolling(window=50).mean()
    return ma20, ma50


def generate_recommendation(prices):
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty or len(prices) < 2:
        return {
            'recommendation': 'Hold',
            'confidence': 50.0,
            'rsi': 50.0,
            'macd': 0.0,
            'ma20': float(prices.iloc[-1]) if not prices.empty else 0.0,
            'ma50': float(prices.iloc[-1]) if not prices.empty else 0.0,
        }

    rsi = calculate_rsi(prices)
    macd, signal = calculate_macd(prices)
    ma20, ma50 = calculate_moving_averages(prices)

    latest_rsi = float(rsi.dropna().iloc[-1])
    latest_macd = float(macd.dropna().iloc[-1])
    latest_signal = float(signal.dropna().iloc[-1])
    latest_ma20 = float(ma20.dropna().iloc[-1])
    latest_ma50 = float(ma50.dropna().iloc[-1])
    latest_price = float(prices.iloc[-1])

    score = 0

    if latest_rsi < 30:
        score += 2
    elif latest_rsi > 70:
        score -= 2

    if latest_macd > latest_signal:
        score += 1
    else:
        score -= 1

    if latest_price > latest_ma20 > latest_ma50:
        score += 1
    elif latest_price < latest_ma20 < latest_ma50:
        score -= 1

    if score >= 2:
        recommendation = 'Buy'
        confidence = min(score / 4 * 100, 100)
    elif score <= -2:
        recommendation = 'Sell'
        confidence = min(abs(score) / 4 * 100, 100)
    else:
        recommendation = 'Hold'
        confidence = 50

    return {
        'recommendation': recommendation,
        'confidence': round(confidence, 2),
        'rsi': round(latest_rsi, 2),
        'macd': round(latest_macd, 2),
        'ma20': round(latest_ma20, 2),
        'ma50': round(latest_ma50, 2),
    }


def generate_prediction(prices, days_forward=14):
    """Simple linear regression prediction over the provided price series.

    Returns a dict with predicted points (next `days_forward` days), direction,
    slope and r_squared. Uses a linear fit on the sequential index of prices.
    """
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty or len(prices) < 3:
        return {
            'predicted': [],
            'direction': 'Unknown',
            'slope': 0.0,
            'r_squared': 0.0,
        }

    y = prices.values.astype(float)
    x = np.arange(len(y)).astype(float)

    # Fit linear regression y = m*x + b
    m, b = np.polyfit(x, y, 1)

    # Compute r-squared
    y_pred = m * x + b
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2) if len(y) > 1 else 0.0
    r_squared = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0

    last_index = x[-1]
    predicted = []
    last_date = prices.index[-1]
    # generate next calendar days; consumer can decide how to render business days
    for i in range(1, days_forward + 1):
        xi = last_index + i
        yi = float(m * xi + b)
        next_date = (pd.to_datetime(last_date) + pd.Timedelta(days=i)).date().isoformat()
        predicted.append({'date': next_date, 'predicted_price': float(round(yi, 2))})

    direction = 'Up' if predicted and predicted[-1]['predicted_price'] > float(y[-1]) else 'Down'

    return {
        'predicted': predicted,
        'direction': direction,
        'slope': float(m),
        'r_squared': round(float(r_squared), 4),
    }
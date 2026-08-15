import math
import pandas as pd
import numpy as np


def _safe_last(series, fallback=0.0):
    if series is None or series.empty:
        return float(fallback)
    clean = series.dropna()
    if clean.empty:
        return float(fallback)
    val = float(clean.iloc[-1])
    if math.isnan(val) or math.isinf(val):
        return float(fallback)
    return val


def calculate_rsi(prices, period=14):
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty or len(prices) < 2:
        return pd.Series([50.0], index=prices.index)

    effective_period = max(1, min(period, len(prices) - 1))
    delta = prices.diff()
    gain = delta.where(delta > 0, 0).rolling(window=effective_period, min_periods=1).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=effective_period, min_periods=1).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50.0)


def calculate_macd(prices):
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty:
        return pd.Series([0.0]), pd.Series([0.0])

    ema12 = prices.ewm(span=12, adjust=False, min_periods=1).mean()
    ema26 = prices.ewm(span=26, adjust=False, min_periods=1).mean()
    macd = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False, min_periods=1).mean()
    return macd.fillna(0.0), signal.fillna(0.0)


def calculate_moving_averages(prices):
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty:
        return pd.Series([0.0]), pd.Series([0.0])

    ma20 = prices.rolling(window=20, min_periods=1).mean()
    ma50 = prices.rolling(window=50, min_periods=1).mean()
    return ma20, ma50


def generate_recommendation(prices):
    prices = pd.Series(prices, dtype='float64').dropna()
    if prices.empty:
        return {
            'recommendation': 'Hold',
            'confidence': 50.0,
            'rsi': 50.0,
            'macd': 0.0,
            'ma20': 0.0,
            'ma50': 0.0,
        }

    latest_price = _safe_last(prices, fallback=100.0)

    if len(prices) < 2:
        return {
            'recommendation': 'Hold',
            'confidence': 50.0,
            'rsi': 50.0,
            'macd': 0.0,
            'ma20': latest_price,
            'ma50': latest_price,
        }

    rsi = calculate_rsi(prices)
    macd, signal = calculate_macd(prices)
    ma20, ma50 = calculate_moving_averages(prices)

    latest_rsi = _safe_last(rsi, fallback=50.0)
    latest_macd = _safe_last(macd, fallback=0.0)
    latest_signal = _safe_last(signal, fallback=0.0)
    latest_ma20 = _safe_last(ma20, fallback=latest_price)
    latest_ma50 = _safe_last(ma50, fallback=latest_price)

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
        'confidence': round(float(confidence), 2),
        'rsi': round(float(latest_rsi), 2),
        'macd': round(float(latest_macd), 2),
        'ma20': round(float(latest_ma20), 2),
        'ma50': round(float(latest_ma50), 2),
    }


def generate_prediction(prices, days_forward=14):
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

    try:
        m, b = np.polyfit(x, y, 1)

        y_pred = m * x + b
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2) if len(y) > 1 else 0.0
        r_squared = float(1 - ss_res / ss_tot) if ss_tot > 0 else 0.0
        if math.isnan(r_squared) or math.isinf(r_squared):
            r_squared = 0.0
        r_squared = max(0.0, min(1.0, r_squared))
    except Exception:
        m, b, r_squared = 0.0, float(y[-1]), 0.0

    import datetime
    last_index = x[-1]
    predicted = []
    raw_last_date = prices.index[-1]
    try:
        dt = pd.to_datetime(raw_last_date)
        if dt.year < 1990:
            dt = pd.to_datetime(datetime.date.today())
    except Exception:
        dt = pd.to_datetime(datetime.date.today())

    for i in range(1, days_forward + 1):
        xi = last_index + i
        yi = float(m * xi + b)
        if math.isnan(yi) or math.isinf(yi):
            yi = float(y[-1])
        next_date = (dt + pd.Timedelta(days=i)).date().isoformat()
        predicted.append({'date': next_date, 'predicted_price': float(round(yi, 2))})

    direction = 'Up' if (predicted and predicted[-1]['predicted_price'] >= float(y[-1])) else 'Down'

    return {
        'predicted': predicted,
        'direction': direction,
        'slope': float(round(m, 4)) if not (math.isnan(m) or math.isinf(m)) else 0.0,
        'r_squared': round(float(r_squared), 4),
    }
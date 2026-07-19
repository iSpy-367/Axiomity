from rest_framework.decorators import api_view
from rest_framework.response import Response
import pandas as pd
import yfinance as yf
from yfinance import screener
import concurrent.futures

from .models import Stock, StockHistory, Prediction
from .analysis import generate_recommendation


def _normalize_symbol(symbol):
    value = (symbol or '').strip().upper()
    if not value:
        raise ValueError('A stock symbol is required.')
    return value


def _script_code(normalized_symbol):
    return normalized_symbol.split('.')[0] if normalized_symbol else normalized_symbol


def _normalize_market_cap(value):
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _assign_market_cap_segments(quotes):
    # Assume market_cap is provided in rupees. Convert crore thresholds to rupees.
    crore = 10_000_000
    small_max = 22_000 * crore
    mid_max = 67_000 * crore

    for quote in quotes:
        cap = quote.get('market_cap')
        if cap is None:
            # If we don't have a market cap, mark as 'unknown' rather than
            # defaulting to 'large' — otherwise small/mid caps without data
            # appear in the large-cap filter.
            quote['cap_segment'] = 'unknown'
        elif cap < small_max:
            quote['cap_segment'] = 'small'
        elif cap <= mid_max:
            quote['cap_segment'] = 'mid'
        else:
            quote['cap_segment'] = 'large'


def _is_valid_stock_ticker(ticker):
    info = ticker.info or {}
    if not info:
        return False, info, None

    history = ticker.history(period='1y', auto_adjust=False)
    if history.empty or len(history) < 5:
        return False, info, history

    latest_close = history['Close'].dropna()
    if latest_close.empty or latest_close.iloc[-1] <= 0:
        return False, info, history

    if not (info.get('shortName') or info.get('longName') or info.get('symbol')):
        return False, info, history

    if info.get('regularMarketPrice') is None and info.get('currentPrice') is None:
        return False, info, history

    return True, info, history


def _resolve_symbol(symbol):
    normalized = _normalize_symbol(symbol)
    if '.' in normalized:
        candidates = [normalized]
    else:
        candidates = [normalized, f'{normalized}.NS']

    for candidate in candidates:
        ticker = yf.Ticker(candidate)
        valid, info, history = _is_valid_stock_ticker(ticker)
        if valid:
            return candidate, info, history

    return None, None, None


def _load_top_active_quotes(count=500):
    india_query = screener.query.EquityQuery('and', [
        screener.query.EquityQuery('eq', ['region', 'in']),
        screener.query.EquityQuery('is-in', ['exchange', 'BSE', 'NSI']),
    ])

    def fetch_page(page_idx):
        offset = page_idx * 25
        try:
            # yfinance screener returns max 25 per request, so page size is 25.
            # Fetching 40 pages in parallel yields 1000 raw quotes.
            res = screener.screen(india_query, offset=offset, count=25, sortField='intradaymarketcap', sortAsc=False)
            return res.get('quotes', []) or []
        except Exception:
            return []

    # Fetch 40 pages (1000 quotes) in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        pages = list(executor.map(fetch_page, range(40)))

    raw_quotes = []
    for page in pages:
        raw_quotes.extend(page)

    # De-duplicate by base symbol to find unique companies
    companies = {}
    for q in raw_quotes:
        symbol = q.get('symbol')
        if not symbol:
            continue
        base = symbol.split('.')[0] if '.' in symbol else symbol

        market_cap = _normalize_market_cap(
            q.get('marketCap')
            or q.get('market_cap')
            or q.get('intradayMarketCap')
            or q.get('intradaymarketcap')
        ) or 0.0

        if base not in companies:
            companies[base] = {
                'quote': q,
                'market_cap': market_cap
            }
        else:
            # Prefer NSE listing (.NS suffix) or listing with larger market cap
            existing_symbol = companies[base]['quote'].get('symbol') or ''
            is_nse = symbol.endswith('.NS')
            existing_is_nse = existing_symbol.endswith('.NS')

            if (is_nse and not existing_is_nse) or (market_cap > companies[base]['market_cap']):
                companies[base] = {
                    'quote': q,
                    'market_cap': max(market_cap, companies[base]['market_cap'])
                }

    # Sort unique companies by market cap descending
    sorted_companies = sorted(companies.values(), key=lambda x: x['market_cap'], reverse=True)

    active_quotes = []
    for idx, item in enumerate(sorted_companies):
        q = item['quote']

        # Classify cap segments:
        # Large Cap: top 100 companies (index 0 to 99)
        # Mid Cap: 101 to 250th companies (index 100 to 249)
        # Small Cap: 250th and beyond (index 250 onwards)
        if idx < 100:
            cap_segment = 'large'
        elif idx < 250:
            cap_segment = 'mid'
        else:
            cap_segment = 'small'

        price = q.get('regularMarketPrice')
        symbol = q.get('symbol')
        if symbol is None or price is None:
            continue

        exchange = q.get('exchange') or ''
        if exchange == 'NSI':
            exchange = 'NSE'

        short_symbol = symbol.split('.')[0] if '.' in symbol else symbol
        company_name = q.get('shortName') or q.get('longName') or short_symbol

        active_quotes.append({
            'symbol': short_symbol,
            'name': company_name,
            'display_name': f'{company_name} ({short_symbol})',
            'current_price': price,
            'change': q.get('regularMarketChange') or 0.0,
            'change_percent': q.get('regularMarketChangePercent') or 0.0,
            'volume': q.get('regularMarketVolume') or 0,
            'exchange': exchange,
            'currency': q.get('currency') or '',
            'market_cap': item['market_cap'],
            'cap_segment': cap_segment,
        })

    return active_quotes


@api_view(['GET'])
def top_movers(request):
    try:
        active_quotes = _load_top_active_quotes()
        if not active_quotes:
            return Response({'error': 'Unable to retrieve live market movers.'}, status=503)

        most_gained = sorted(active_quotes, key=lambda q: q['change_percent'], reverse=True)[:15]
        most_lost = sorted(
            [q for q in active_quotes if q['change_percent'] < 0],
            key=lambda q: q['change_percent']
        )[:15]

        return Response({
            'count': len(active_quotes),
            'top_active': active_quotes,
            'most_gained': most_gained,
            'most_lost': most_lost,
        })
    except Exception as exc:
        return Response({'error': str(exc)}, status=500)


@api_view(['GET'])
def fetch_stock_data(request, symbol):
    normalized_symbol = _normalize_symbol(symbol)
    try:
        resolved_symbol, info, hist = _resolve_symbol(normalized_symbol)
        if not resolved_symbol:
            return Response({'error': 'Stock symbol not found or not listed on the exchange.'}, status=404)

        stock, _ = Stock.objects.get_or_create(symbol=resolved_symbol, defaults={'name': resolved_symbol})
        stock.name = info.get('longName') or info.get('shortName') or resolved_symbol
        stock.current_price = info.get('currentPrice') or info.get('regularMarketPrice') or float(hist['Close'].dropna().iloc[-1])
        stock.volume = info.get('volume') or info.get('regularMarketVolume') or int(hist['Volume'].dropna().iloc[-1] or 0)
        stock.save()

        if not hist.empty:
            for date, row in hist.iterrows():
                StockHistory.objects.update_or_create(
                    stock=stock,
                    date=date.date(),
                    defaults={
                        'open_price': float(row.get('Open', 0) or 0),
                        'close_price': float(row.get('Close', 0) or 0),
                        'high': float(row.get('High', 0) or 0),
                        'low': float(row.get('Low', 0) or 0),
                        'volume': int(row.get('Volume', 0) or 0),
                    }
                )

        return Response({
            'message': f'{resolved_symbol} data fetched successfully',
            'price': stock.current_price,
            'symbol': _script_code(resolved_symbol),
            'script_code': _script_code(resolved_symbol),
        })

    except Exception as exc:
        return Response({'error': f'Unable to fetch data for {normalized_symbol}: {exc}'}, status=400)


@api_view(['GET'])
def get_stock(request, symbol):
    normalized_symbol = _normalize_symbol(symbol)
    try:
        stock = Stock.objects.filter(symbol__iexact=normalized_symbol).first()
        if not stock and '.' not in normalized_symbol:
            stock = Stock.objects.filter(symbol__iexact=f'{normalized_symbol}.NS').first()

        if not stock:
            raise Stock.DoesNotExist

        history = StockHistory.objects.filter(stock=stock).order_by('date').values(
            'date', 'open_price', 'close_price', 'high', 'low', 'volume'
        )
        return Response({
            'symbol': _script_code(stock.symbol),
            'script_code': _script_code(stock.symbol),
            'name': stock.name,
            'current_price': stock.current_price,
            'volume': stock.volume,
            'history': list(history),
        })
    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found. Fetch it first.'}, status=404)


@api_view(['GET'])
def analyze_stock(request, symbol):
    normalized_symbol = _normalize_symbol(symbol)
    try:
        stock = Stock.objects.filter(symbol__iexact=normalized_symbol).first()
        if not stock and '.' not in normalized_symbol:
            stock = Stock.objects.filter(symbol__iexact=f'{normalized_symbol}.NS').first()

        if not stock:
            raise Stock.DoesNotExist

        history = StockHistory.objects.filter(stock=stock).order_by('date')
        if history.exists():
            prices = pd.Series([h.close_price for h in history], dtype='float64')
        else:
            prices = pd.Series([stock.current_price or 100.0], dtype='float64')

        result = generate_recommendation(prices)
        # Add a lightweight linear regression prediction based on past year data
        try:
            from .analysis import generate_prediction
            prediction = generate_prediction(prices, days_forward=14)
        except Exception:
            prediction = {'predicted': [], 'direction': 'Unknown', 'slope': 0.0, 'r_squared': 0.0}

        Prediction.objects.create(
            stock=stock,
            recommendation=result['recommendation'],
            confidence=result['confidence'],
            rsi=result['rsi'],
            macd=result['macd'],
        )

        info = yf.Ticker(stock.symbol).info or {}
        fundamentals = {
            'roe': info.get('returnOnEquity') or info.get('returnOnEquityTTM'),
            'debt_to_equity': info.get('debtToEquity'),
            'eps': info.get('trailingEps') or info.get('epsTrailingTwelveMonths') or info.get('forwardEps'),
            'sales': info.get('totalRevenue') or info.get('revenue') or info.get('grossProfits'),
            'operating_profit': info.get('operatingIncome') or info.get('ebitda') or info.get('operatingMargins'),
            'net_profit': info.get('netIncomeToCommon') or info.get('netIncome') or info.get('netProfitToCommonStockholders'),
            'dividend_yield': info.get('dividendYield'),
            'pb': info.get('priceToBook'),
            'pe': info.get('trailingPE') or info.get('forwardPE'),
            'fifty_two_week_high': info.get('fiftyTwoWeekHigh'),
            'fifty_two_week_low': info.get('fiftyTwoWeekLow'),
            'fifty_day_ma': info.get('fiftyDayAverage'),
            'two_hundred_day_ma': info.get('twoHundredDayAverage'),
            'volume_avg': info.get('averageVolume') or info.get('averageVolume10days'),
            'beta': info.get('beta'),
        }

        return Response({
            'symbol': _script_code(stock.symbol),
            'script_code': _script_code(stock.symbol),
            'name': stock.name,
            'current_price': stock.current_price,
            'fundamentals': fundamentals,
            **result,
            'prediction': prediction,
        })

    except Stock.DoesNotExist:
        return Response({'error': 'Stock not found. Fetch it first.'}, status=404)
    except Exception as exc:
        return Response({'error': str(exc)}, status=400)
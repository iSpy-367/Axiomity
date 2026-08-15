import time
import math
import logging
import concurrent.futures
from rest_framework.decorators import api_view
from rest_framework.response import Response
import pandas as pd
import yfinance as yf
from yfinance import screener

from .models import Stock, StockHistory, Prediction
from .analysis import generate_recommendation
from .symbol_master import symbol_master

logger = logging.getLogger(__name__)


def _clean_float(val, default=0.0):
    """Safely converts a value to float, ensuring NaN and Infinity become default."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default


def _sanitize_val(val):
    """Converts NaN/Inf to None so DRF's JSON serializer does not crash with ValueError."""
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError):
        return val


def _normalize_symbol(symbol):
    value = (symbol or '').strip().upper()
    if not value:
        raise ValueError('A stock symbol is required.')
    return value


def _script_code(normalized_symbol):
    if not normalized_symbol:
        return ''
    return normalized_symbol.split('.')[0] if '.' in normalized_symbol else normalized_symbol


def _normalize_market_cap(value):
    try:
        if value is None:
            return None
        f = float(value)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _assign_market_cap_segments(quotes):
    crore = 10_000_000
    small_max = 22_000 * crore
    mid_max = 67_000 * crore

    for quote in quotes:
        cap = quote.get('market_cap')
        if cap is None:
            quote['cap_segment'] = 'unknown'
        elif cap < small_max:
            quote['cap_segment'] = 'small'
        elif cap <= mid_max:
            quote['cap_segment'] = 'mid'
        else:
            quote['cap_segment'] = 'large'


def _is_valid_stock_ticker(ticker, is_confirmed_symbol=False):
    """
    Validates that a ticker object returns realistic Indian stock data.
    If is_confirmed_symbol=True, relaxes minimum row constraints to prevent false negatives
    on valid Indian tickers (e.g. VBL / Varun Beverages) experiencing momentary thin windows.
    """
    try:
        history = ticker.history(period='1y', auto_adjust=False)
        if history.empty or len(history) < (1 if is_confirmed_symbol else 2):
            history = ticker.history(period='1mo', auto_adjust=False)

        info = {}
        try:
            info = ticker.info or {}
        except Exception:
            pass

        if history.empty:
            price = _sanitize_val(info.get('currentPrice') or info.get('regularMarketPrice') or info.get('previousClose'))
            if is_confirmed_symbol and price and float(price) > 0:
                import datetime
                today = datetime.date.today()
                p = float(price)
                history = pd.DataFrame([{
                    'Open': p, 'High': p, 'Low': p, 'Close': p, 'Volume': int(_clean_float(info.get('volume', 0)))
                }], index=pd.to_datetime([today]))
                return True, info, history
            return False, info, history

        # Clean NaN closes
        valid_closes = history['Close'].dropna()
        valid_closes = valid_closes[valid_closes > 0]
        if valid_closes.empty:
            return False, info, history

        return True, info, history
    except Exception as exc:
        logger.warning(f"Ticker validation error: {exc}")
        return False, {}, None


def _sanity_check_indian_stock(candidate, info, clean_sym):
    """
    Ensures the resolved ticker belongs to an Indian exchange (NSE/BSE) and has not collided
    with a foreign global ticker (e.g. US stock like VISL or NASDAQ/NYSE entity).
    """
    if not candidate.endswith('.NS') and not candidate.endswith('.BO'):
        return False

    currency = (info.get('currency') or info.get('financialCurrency') or '').upper()
    if currency and currency != 'INR':
        logger.warning(f"Sanity check rejected {candidate}: currency is {currency}, expected INR.")
        return False

    exchange = (info.get('exchange') or '').upper()
    # Acceptable Indian and Yahoo delayed quote identifiers
    valid_exchanges = {'NSI', 'NSE', 'BSE', 'BOM', 'BO', 'IN', 'INDIA', 'YHD', ''}
    if exchange and exchange not in valid_exchanges:
        logger.warning(f"Sanity check rejected {candidate}: foreign exchange '{exchange}'.")
        return False

    return True


def _resolve_symbol(symbol):
    """
    Canonical NSE/BSE Symbol Resolution:
    1. Normalizes symbol and strips user suffixes (.NS, .BO, etc.)
    2. Checks canonical NSE/BSE symbol master first.
    3. Queries ONLY .NS (NSE) and/or .BO (BSE) against yfinance.
    4. NEVER queries unsuffixed raw ticker (eliminates cross-market collision bug).
    5. Retries on temporary failures with backoff (eliminates VBL false negative bug).
    6. Validates currency (INR) and exchange (NSE/BSE).
    """
    clean_sym = symbol_master.clean_symbol(symbol)
    if not clean_sym:
        return None, None, None, None

    # Handle index symbols like ^NSEI or ^NSEBANK
    if clean_sym.startswith('^'):
        ticker = yf.Ticker(clean_sym)
        valid, info, history = _is_valid_stock_ticker(ticker, is_confirmed_symbol=True)
        if valid:
            return clean_sym, info, history, 'NSE'
        return None, None, None, None

    # Lookup in canonical Indian symbol master
    master_rec = symbol_master.lookup(clean_sym)
    is_confirmed = master_rec is not None

    candidates = []
    if master_rec:
        actual_sym = master_rec['symbol']
        bse_code = master_rec.get('bse_code')
        if bse_code:
            candidates.append(f"{bse_code}.BO")
        if master_rec['is_nse']:
            candidates.append(f"{actual_sym}.NS")
        if master_rec['is_bse']:
            candidates.append(f"{actual_sym}.BO")
    else:
        candidates = [f"{clean_sym}.NS", f"{clean_sym}.BO"]

    for candidate in candidates:
        exchange_used = 'BSE' if candidate.endswith('.BO') else 'NSE'
        max_attempts = 3
        for attempt in range(max_attempts):
            try:
                ticker = yf.Ticker(candidate)
                valid, info, history = _is_valid_stock_ticker(ticker, is_confirmed_symbol=is_confirmed)
                
                if valid:
                    if _sanity_check_indian_stock(candidate, info, clean_sym):
                        logger.info(f"Resolved '{symbol}' -> {candidate} ({exchange_used})")
                        return candidate, info, history, exchange_used
                    else:
                        break
                else:
                    if attempt < max_attempts - 1:
                        time.sleep(0.25 * (attempt + 1))
            except Exception as exc:
                logger.warning(f"Fetch attempt {attempt + 1} for {candidate} failed: {exc}")
                if attempt < max_attempts - 1:
                    time.sleep(0.25 * (attempt + 1))

    logger.warning(f"Could not resolve Indian ticker '{symbol}' (confirmed: {is_confirmed})")
    return None, None, None, None


@api_view(['GET'])
def search_stocks(request):
    """
    Autocomplete typeahead endpoint matching symbols and company names in the canonical master list.
    Query param: `q` (e.g. /api/stocks/search/?q=VARUN or /api/stocks/search/?q=VBL)
    """
    query = request.GET.get('q', '').strip()
    if not query:
        return Response({'results': []})

    results = symbol_master.search(query, limit=10)
    return Response({'results': results})


def _load_top_active_quotes(count=500):
    india_query = screener.query.EquityQuery('and', [
        screener.query.EquityQuery('eq', ['region', 'in']),
        screener.query.EquityQuery('is-in', ['exchange', 'BSE', 'NSI']),
    ])

    def fetch_page(page_idx):
        offset = page_idx * 25
        try:
            res = screener.screen(india_query, offset=offset, count=25, sortField='intradaymarketcap', sortAsc=False)
            return res.get('quotes', []) or []
        except Exception:
            return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        pages = list(executor.map(fetch_page, range(40)))

    raw_quotes = []
    for page in pages:
        raw_quotes.extend(page)

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
            existing_symbol = companies[base]['quote'].get('symbol') or ''
            is_nse = symbol.endswith('.NS')
            existing_is_nse = existing_symbol.endswith('.NS')

            if (is_nse and not existing_is_nse) or (market_cap > companies[base]['market_cap']):
                companies[base] = {
                    'quote': q,
                    'market_cap': max(market_cap, companies[base]['market_cap'])
                }

    sorted_companies = sorted(companies.values(), key=lambda x: x['market_cap'], reverse=True)

    active_quotes = []
    for idx, item in enumerate(sorted_companies):
        q = item['quote']

        if idx < 100:
            cap_segment = 'large'
        elif idx < 250:
            cap_segment = 'mid'
        else:
            cap_segment = 'small'

        price = _sanitize_val(q.get('regularMarketPrice'))
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
            'change': _clean_float(q.get('regularMarketChange')),
            'change_percent': _clean_float(q.get('regularMarketChangePercent')),
            'volume': int(_clean_float(q.get('regularMarketVolume'))),
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


def _is_history_stale(stock):
    """Checks if the stock's recorded history is older than the last 1-2 market trading sessions."""
    if not stock:
        return True
    latest = StockHistory.objects.filter(stock=stock).order_by('-date').first()
    if not latest or not latest.date:
        return True
    import datetime
    today = datetime.date.today()
    delta = (today - latest.date).days
    # On weekends or Mondays, max allowed lag from Friday is 4 days; on regular weekdays 2 days.
    max_lag = 4 if today.weekday() in (0, 5, 6) else 2
    return delta > max_lag


def _sync_stock_live_data(clean_sym):
    """Fetches latest 1y history from yfinance and updates Stock & StockHistory to the last trading day."""
    resolved_symbol, info, hist, exchange_used = _resolve_symbol(clean_sym)
    if not resolved_symbol:
        return None

    master_rec = symbol_master.lookup(clean_sym)
    official_name = master_rec['name'] if master_rec else (info.get('longName') or info.get('shortName') or _script_code(resolved_symbol))

    stock, _ = Stock.objects.get_or_create(symbol=resolved_symbol, defaults={'name': official_name})
    stock.name = official_name

    raw_price = info.get('currentPrice') or info.get('regularMarketPrice') or (hist['Close'].dropna().iloc[-1] if (hist is not None and not hist.empty) else None)
    stock.current_price = _clean_float(raw_price, default=100.0)

    raw_vol = info.get('volume') or info.get('regularMarketVolume') or (hist['Volume'].dropna().iloc[-1] if (hist is not None and not hist.empty) else 0)
    stock.volume = int(_clean_float(raw_vol, default=0))
    stock.save()

    if hist is not None and not hist.empty:
        valid_hist = hist.dropna(subset=['Close'])
        for date, row in valid_hist.iterrows():
            close_p = _clean_float(row.get('Close'))
            if close_p <= 0:
                continue
            open_p = _clean_float(row.get('Open'), default=close_p)
            high_p = _clean_float(row.get('High'), default=max(open_p, close_p))
            low_p = _clean_float(row.get('Low'), default=min(open_p, close_p))
            vol = int(_clean_float(row.get('Volume', 0), default=0))

            candle_date = date.date() if hasattr(date, 'date') else date
            StockHistory.objects.update_or_create(
                stock=stock,
                date=candle_date,
                defaults={
                    'open_price': open_p,
                    'close_price': close_p,
                    'high': high_p,
                    'low': low_p,
                    'volume': vol,
                }
            )

    return stock


def _get_or_sync_stock(symbol, force_refresh=False):
    """
    Finds the matching Stock record in the database.
    If the stock record is missing, has 0 history, or history is stale (older than last trading day),
    or force_refresh=True, fetches and updates it with fresh data up to the latest trading day.
    """
    clean_sym = symbol_master.clean_symbol(symbol)
    if clean_sym.startswith('^'):
        candidates = [clean_sym]
    else:
        candidates = [f"{clean_sym}.NS", f"{clean_sym}.BO", clean_sym]

    stock = None
    if not force_refresh:
        # 1. Look for existing stock that has fresh history up to last trading day
        for cand in candidates:
            s = Stock.objects.filter(symbol__iexact=cand).first()
            if s and StockHistory.objects.filter(stock=s).exists() and not _is_history_stale(s):
                stock = s
                break

    # 2. If no fresh stock found or force_refresh is requested, fetch live data
    if not stock:
        stock = _sync_stock_live_data(clean_sym)

    # 3. Fallback to any existing record if live fetch failed
    if not stock:
        for cand in candidates:
            s = Stock.objects.filter(symbol__iexact=cand).first()
            if s and StockHistory.objects.filter(stock=s).exists():
                stock = s
                break

    return stock


@api_view(['GET'])
def fetch_stock_data(request, symbol):
    normalized_symbol = _normalize_symbol(symbol)
    try:
        # fetch_stock_data always force refreshes live data up to latest trading day
        stock = _get_or_sync_stock(normalized_symbol, force_refresh=True)
        if not stock:
            return Response({
                'error': f"Stock symbol '{normalized_symbol}' is not listed on Indian exchanges (NSE/BSE) or data is temporarily unavailable."
            }, status=404)

        return Response({
            'message': f'{stock.symbol} data fetched successfully',
            'price': _sanitize_val(stock.current_price),
            'symbol': _script_code(stock.symbol),
            'script_code': _script_code(stock.symbol),
            'name': stock.name,
            'exchange': 'BSE' if stock.symbol.endswith('.BO') else 'NSE',
        })

    except Exception as exc:
        return Response({'error': f'Unable to fetch data for {normalized_symbol}: {exc}'}, status=400)


@api_view(['GET'])
def get_stock(request, symbol):
    normalized_symbol = _normalize_symbol(symbol)
    period = request.GET.get('period')
    interval = request.GET.get('interval')
    try:
        stock = _get_or_sync_stock(normalized_symbol)
        if not stock:
            return Response({'error': f"Stock symbol '{normalized_symbol}' is not listed on Indian exchanges (NSE/BSE)."}, status=404)

        if period == '1d':
            # Dynamic intraday 5m/15m fetch
            ticker = yf.Ticker(stock.symbol)
            intraday = ticker.history(period='1d', interval=interval or '5m')
            if not intraday.empty:
                history = []
                for dt, row in intraday.iterrows():
                    history.append({
                        'date': dt.strftime('%H:%M') if hasattr(dt, 'strftime') else str(dt),
                        'open_price': _clean_float(row.get('Open')),
                        'close_price': _clean_float(row.get('Close')),
                        'high': _clean_float(row.get('High')),
                        'low': _clean_float(row.get('Low')),
                        'volume': int(_clean_float(row.get('Volume'))),
                    })
                return Response({
                    'symbol': _script_code(stock.symbol),
                    'script_code': _script_code(stock.symbol),
                    'name': stock.name,
                    'current_price': _sanitize_val(stock.current_price),
                    'volume': int(_clean_float(stock.volume)),
                    'exchange': 'BSE' if stock.symbol.endswith('.BO') else 'NSE',
                    'history': history,
                })

        raw_history = StockHistory.objects.filter(stock=stock).order_by('date').values(
            'date', 'open_price', 'close_price', 'high', 'low', 'volume'
        )

        history = []
        for h in raw_history:
            history.append({
                'date': str(h['date']),
                'open_price': _clean_float(h['open_price']),
                'close_price': _clean_float(h['close_price']),
                'high': _clean_float(h['high']),
                'low': _clean_float(h['low']),
                'volume': int(_clean_float(h['volume'])),
            })

        return Response({
            'symbol': _script_code(stock.symbol),
            'script_code': _script_code(stock.symbol),
            'name': stock.name,
            'current_price': _sanitize_val(stock.current_price),
            'volume': int(_clean_float(stock.volume)),
            'exchange': 'BSE' if stock.symbol.endswith('.BO') else 'NSE',
            'history': history,
        })
    except Exception as exc:
        return Response({'error': str(exc)}, status=400)


@api_view(['GET'])
def analyze_stock(request, symbol):
    normalized_symbol = _normalize_symbol(symbol)
    try:
        stock = _get_or_sync_stock(normalized_symbol)
        if not stock:
            return Response({'error': f"Stock symbol '{normalized_symbol}' is not listed on Indian exchanges (NSE/BSE)."}, status=404)

        history = StockHistory.objects.filter(stock=stock).order_by('date')
        if history.exists():
            prices = pd.Series([_clean_float(h.close_price) for h in history], index=[h.date for h in history], dtype='float64')
            prices = prices[prices > 0]
        else:
            import datetime
            prices = pd.Series([_clean_float(stock.current_price, default=100.0)], index=[datetime.date.today()], dtype='float64')

        result = generate_recommendation(prices)
       
        try:
            from .analysis import generate_prediction
            prediction = generate_prediction(prices, days_forward=14)
        except Exception:
            prediction = {'predicted': [], 'direction': 'Unknown', 'slope': 0.0, 'r_squared': 0.0}

        Prediction.objects.create(
            stock=stock,
            recommendation=result['recommendation'],
            confidence=_clean_float(result['confidence'], default=50.0),
            rsi=_sanitize_val(result['rsi']),
            macd=_sanitize_val(result['macd']),
        )

        # Compute Prev Day High/Low and 1W / 1M / 3M (Quarter) Highs & Lows from history
        prev_day_high = None
        prev_day_low = None
        week_high = None
        week_low = None
        month_high = None
        month_low = None
        quarter_high = None
        quarter_low = None

        if history.exists():
            history_list = list(history)
            if len(history_list) >= 2:
                prev_day_high = _clean_float(history_list[-2].high or history_list[-2].close_price)
                prev_day_low = _clean_float(history_list[-2].low or history_list[-2].close_price)
            elif len(history_list) == 1:
                prev_day_high = _clean_float(history_list[-1].high or history_list[-1].close_price)
                prev_day_low = _clean_float(history_list[-1].low or history_list[-1].close_price)

            import datetime
            latest_date = history_list[-1].date
            if isinstance(latest_date, str):
                try:
                    latest_date = datetime.date.fromisoformat(latest_date)
                except Exception:
                    latest_date = datetime.date.today()
            elif not isinstance(latest_date, (datetime.date, datetime.datetime)):
                latest_date = datetime.date.today()

            week_start = latest_date - datetime.timedelta(days=7)
            month_start = latest_date - datetime.timedelta(days=30)
            quarter_start = latest_date - datetime.timedelta(days=90)

            def _get_h_date(h):
                d = h.date
                if isinstance(d, str):
                    try:
                        return datetime.date.fromisoformat(d)
                    except Exception:
                        return latest_date
                return d

            week_records = [h for h in history_list if _get_h_date(h) >= week_start]
            month_records = [h for h in history_list if _get_h_date(h) >= month_start]
            quarter_records = [h for h in history_list if _get_h_date(h) >= quarter_start]

            if week_records:
                week_high = max([_clean_float(h.high or h.close_price) for h in week_records])
                week_low = min([_clean_float(h.low or h.close_price) for h in week_records])
            if month_records:
                month_high = max([_clean_float(h.high or h.close_price) for h in month_records])
                month_low = min([_clean_float(h.low or h.close_price) for h in month_records])
            if quarter_records:
                quarter_high = max([_clean_float(h.high or h.close_price) for h in quarter_records])
                quarter_low = min([_clean_float(h.low or h.close_price) for h in quarter_records])

        info = {}
        try:
            ticker = yf.Ticker(stock.symbol)
            info = ticker.info or {}
        except Exception:
            info = {}

        fundamentals = {
            'roe': _sanitize_val(info.get('returnOnEquity') or info.get('returnOnEquityTTM')),
            'debt_to_equity': _sanitize_val(info.get('debtToEquity')),
            'eps': _sanitize_val(info.get('trailingEps') or info.get('epsTrailingTwelveMonths') or info.get('forwardEps')),
            'sales': _sanitize_val(info.get('totalRevenue') or info.get('revenue') or info.get('grossProfits')),
            'operating_profit': _sanitize_val(info.get('operatingIncome') or info.get('ebitda') or info.get('operatingMargins')),
            'net_profit': _sanitize_val(info.get('netIncomeToCommon') or info.get('netIncome') or info.get('netProfitToCommonStockholders')),
            'dividend_yield': _sanitize_val(info.get('dividendYield')),
            'pb': _sanitize_val(info.get('priceToBook')),
            'pe': _sanitize_val(info.get('trailingPE') or info.get('forwardPE')),
            'fifty_two_week_high': _sanitize_val(info.get('fiftyTwoWeekHigh')),
            'fifty_two_week_low': _sanitize_val(info.get('fiftyTwoWeekLow')),
            'fifty_day_ma': _sanitize_val(info.get('fiftyDayAverage')),
            'two_hundred_day_ma': _sanitize_val(info.get('twoHundredDayAverage')),
            'volume_avg': _sanitize_val(info.get('averageVolume') or info.get('averageVolume10days')),
            'beta': _sanitize_val(info.get('beta')),
            'prev_day_high': _sanitize_val(prev_day_high),
            'prev_day_low': _sanitize_val(prev_day_low),
            'week_high': _sanitize_val(week_high),
            'week_low': _sanitize_val(week_low),
            'month_high': _sanitize_val(month_high),
            'month_low': _sanitize_val(month_low),
            'quarter_high': _sanitize_val(quarter_high),
            'quarter_low': _sanitize_val(quarter_low),
        }

        # Sanitize prediction numbers
        if prediction:
            prediction['slope'] = _clean_float(prediction.get('slope'))
            prediction['r_squared'] = _clean_float(prediction.get('r_squared'))
            if 'predicted' in prediction and isinstance(prediction['predicted'], list):
                prediction['predicted'] = [
                    {'date': p.get('date'), 'predicted_price': _clean_float(p.get('predicted_price'))}
                    for p in prediction['predicted']
                ]

        return Response({
            'symbol': _script_code(stock.symbol),
            'script_code': _script_code(stock.symbol),
            'name': stock.name,
            'exchange': 'BSE' if stock.symbol.endswith('.BO') else 'NSE',
            'current_price': _sanitize_val(stock.current_price),
            'fundamentals': fundamentals,
            **result,
            'prediction': prediction,
        })

    except Exception as exc:
        return Response({'error': str(exc)}, status=400)


@api_view(['GET'])
def fii_dii_activity_view(request):
    """
    Returns day-wise FII and DII net institutional inflow/outflow data in ₹ Crores.
    """
    try:
        days = int(request.GET.get('days', 30))
        from .fii_dii import get_fii_dii_activity
        data = get_fii_dii_activity(days=days)
        return Response(data)
    except Exception as exc:
        logger.error(f"FII/DII API error: {exc}")
        return Response({'error': str(exc)}, status=500)
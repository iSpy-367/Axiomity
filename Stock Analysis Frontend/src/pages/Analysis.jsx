import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StockChart from '../components/StockChart';
import Recommendation from '../components/Recommendation';
import Navbar from '../components/Navbar';
import { analyzeStock, fetchStock, getStock, searchStocks } from '../services/api';

const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'technical', label: 'Technical Analysis' },
    { key: 'fundamental', label: 'Fundamental Analysis' },
    { key: 'actions', label: 'Corporate Actions & Splits' },
    { key: 'predicted', label: 'Predicted Direction' },
];

const POPULAR_TICKERS = [
    { symbol: 'RELIANCE', name: 'Reliance' },
    { symbol: 'TCS', name: 'TCS' },
    { symbol: 'INFY', name: 'Infosys' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'TMCV', name: 'Tata Motors' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank' },
];

function Analysis() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [symbol, setSymbol] = useState(searchParams.get('symbol') || '');
    const [stockData, setStockData] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const searchContainerRef = useRef(null);

    const loadStockData = useCallback(async (tickerSymbol) => {
        const input = (tickerSymbol || '').trim();
        if (!input) return;

        setLoading(true);
        setError('');

        try {
            await fetchStock(input);
            const [analysisRes, stockRes] = await Promise.all([
                analyzeStock(input),
                getStock(input),
            ]);

            setAnalysis(analysisRes.data);
            setStockData(stockRes.data);
        } catch (err) {
            setError(err.response?.data?.error || `Stock '${input}' not found on Indian exchanges (NSE/BSE).`);
            setAnalysis(null);
            setStockData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSearch = useCallback((overrideSymbol) => {
        const input = (overrideSymbol || symbol || '').trim();
        if (!input) return;
        setSymbol(input);
        setShowSuggestions(false);
        setSearchParams({ symbol: input });
    }, [symbol, setSearchParams]);

    const selectSuggestion = (item) => {
        setSymbol(item.symbol);
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        handleSearch(item.symbol);
    };

    useEffect(() => {
        const q = (symbol || '').trim();
        if (q.length < 1) {
            setSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await searchStocks(q);
                setSuggestions(res.data?.results || []);
            } catch {
                setSuggestions([]);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [symbol]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        if (!showSuggestions || suggestions.length === 0) {
            if (e.key === 'Enter') handleSearch();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                selectSuggestion(suggestions[highlightedIndex]);
            } else {
                handleSearch();
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    useEffect(() => {
        const input = searchParams.get('symbol')?.trim();
        if (input) {
            setSymbol(input);
            loadStockData(input);
        } else {
            const defaultSymbol = 'RELIANCE';
            setSymbol(defaultSymbol);
            loadStockData(defaultSymbol);
        }
    }, [loadStockData, searchParams]);

    const formatCurrency = (value) => {
        if (value == null || isNaN(value)) return <span className="data-na">N/A</span>;
        return `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatCrores = (value) => {
        if (value == null || isNaN(value)) return <span className="data-na">N/A</span>;
        const numVal = Number(value);
        if (numVal >= 10000000) {
            const inCrores = numVal / 10000000;
            return `₹${inCrores.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
        }
        return `₹${numVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    };

    const formatShares = (value) => {
        if (value == null || isNaN(value)) return <span className="data-na">N/A</span>;
        const numVal = Number(value);
        if (numVal >= 10000000) {
            return `${(numVal / 10000000).toFixed(2)} Cr shares`;
        }
        if (numVal >= 100000) {
            return `${(numVal / 100000).toFixed(2)} L shares`;
        }
        return `${numVal.toLocaleString('en-IN')} shares`;
    };

    const formatNumber = (value, decimals = 2) => {
        if (value == null || isNaN(value)) return <span className="data-na">N/A</span>;
        return Number(value).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const formatRatio = (value, suffix = 'x') => {
        if (value == null || isNaN(value)) return <span className="data-na">N/A</span>;
        return `${Number(value).toFixed(2)}${suffix}`;
    };

    const num = (v) => (v == null ? 0 : Number(v));

    const history = stockData?.history || [];
    const latestCandle = history.length > 0 ? history[history.length - 1] : null;
    const prevCandle = history.length > 1 ? history[history.length - 2] : null;

    let intradayChg = 0;
    let intradayPct = 0;
    if (latestCandle && prevCandle && prevCandle.close_price > 0) {
        intradayChg = latestCandle.close_price - prevCandle.close_price;
        intradayPct = (intradayChg / prevCandle.close_price) * 100;
    } else if (stockData && analysis && analysis.current_price) {
        intradayChg = 0;
        intradayPct = 0;
    }

    const rawDivYield = analysis?.fundamentals?.dividend_yield;
    const divYieldPct = rawDivYield != null ? Number(rawDivYield) : null;
    const isDividendOutlier = divYieldPct != null && divYieldPct > 15;

    const rawPE = analysis?.fundamentals?.pe;
    const peNum = rawPE != null ? Number(rawPE) : null;
    const isPEOutlier = peNum != null && (peNum > 150 || peNum < 0);

    return (
        <div className="app-shell fintech-workspace">
            <Navbar />
            <div className="analysis-page-container">
                <section className="terminal-header-card">
                    <div className="terminal-search-row">
                        <div className="search-input-group-wrapper" ref={searchContainerRef}>
                            <div className="search-input-group">
                                <span className="search-icon">🔍</span>
                                <input
                                    type="text"
                                    className="fintech-search-input"
                                    placeholder="Search Indian stock (e.g. VBL, RELIANCE, Varun Beverages)"
                                    value={symbol}
                                    onChange={(e) => {
                                        setSymbol(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onKeyDown={handleKeyDown}
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    className="fintech-search-btn"
                                    onClick={() => handleSearch()}
                                    disabled={loading}
                                >
                                    {loading ? 'Analyzing…' : 'Analyze'}
                                </button>
                            </div>

                            {showSuggestions && suggestions.length > 0 && (
                                <div className="typeahead-dropdown">
                                    <div className="dropdown-header">
                                        <span>MATCHING INDIAN STOCKS (NSE/BSE)</span>
                                    </div>
                                    <ul className="typeahead-list">
                                        {suggestions.map((item, idx) => (
                                            <li
                                                key={item.symbol}
                                                className={`typeahead-item ${idx === highlightedIndex ? 'highlighted' : ''}`}
                                                onClick={() => selectSuggestion(item)}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                            >
                                                <div className="typeahead-left">
                                                    <strong className="typeahead-sym">{item.symbol}</strong>
                                                    <span className="typeahead-name">{item.name}</span>
                                                </div>
                                                <div className="typeahead-right">
                                                    {item.sector && <span className="typeahead-sector">{item.sector}</span>}
                                                    <span className={`typeahead-badge ${item.exchange === 'BSE' ? 'bse' : 'nse'}`}>
                                                        {item.exchange}
                                                    </span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="quick-tickers-row">
                            <span className="quick-label">QUICK:</span>
                            {POPULAR_TICKERS.map((t) => (
                                <button
                                    key={t.symbol}
                                    type="button"
                                    className={`quick-chip ${symbol.toUpperCase() === t.symbol ? 'active' : ''}`}
                                    onClick={() => handleSearch(t.symbol)}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {analysis && (
                        <div className="stock-hero-strip">
                            <div className="stock-identity">
                                <div className="stock-title-row">
                                    <h1>{analysis.name}</h1>
                                    <span className="exchange-tag">
                                        {analysis.exchange || 'NSE'}: {analysis.script_code || analysis.symbol}
                                    </span>
                                    {(() => {
                                        // 1. Check for upcoming dividend
                                        if (analysis.upcoming_events?.upcoming_ex_dividend_date) {
                                            return (
                                                <span
                                                    className="action-pill dividend-pill"
                                                    style={{
                                                        background: 'rgba(16, 185, 129, 0.15)',
                                                        color: '#34d399',
                                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                                        padding: '3px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '700',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}
                                                >
                                                    💰 Upcoming Dividend Ex-Date: {analysis.upcoming_events.upcoming_ex_dividend_date}
                                                </span>
                                            );
                                        }
                                        // 2. Check for upcoming earnings announcement
                                        if (analysis.upcoming_events?.earnings_dates && analysis.upcoming_events.earnings_dates.length > 0) {
                                            const nextDate = analysis.upcoming_events.earnings_dates[0];
                                            return (
                                                <span
                                                    className="action-pill event-pill"
                                                    style={{
                                                        background: 'rgba(59, 130, 246, 0.15)',
                                                        color: '#60a5fa',
                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                        padding: '3px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '700',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}
                                                >
                                                    📅 Next Results: {nextDate}
                                                </span>
                                            );
                                        }
                                        // 3. Check for a very recent split (within last 7 days)
                                        const recentSplit = (analysis.corporate_actions || []).find(a => a.type === 'split');
                                        if (recentSplit) {
                                            const splitDate = new Date(recentSplit.date);
                                            const now = new Date();
                                            const diffDays = Math.round((now - splitDate) / (1000 * 60 * 60 * 24));
                                            if (diffDays >= 0 && diffDays <= 7) {
                                                return (
                                                    <span
                                                        className="action-pill split-pill"
                                                        style={{
                                                            background: 'rgba(168, 85, 247, 0.15)',
                                                            color: '#c084fc',
                                                            border: '1px solid rgba(168, 85, 247, 0.3)',
                                                            padding: '3px 10px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: '700',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '5px'
                                                        }}
                                                    >
                                                        ✂️ Recent {recentSplit.title} ({recentSplit.date})
                                                    </span>
                                                );
                                            }
                                        }
                                        return null;
                                    })()}
                                </div>
                                <p className="stock-subtext">
                                    Indian Markets ({analysis.exchange || 'NSE'}) • Real-time Technical & Quantitative Analysis Workspace
                                </p>
                            </div>

                            <div className="stock-price-block">
                                <div className="price-primary">
                                    <span className="price-currency">₹</span>
                                    <strong className="price-num">{formatNumber(analysis.current_price, 2)}</strong>
                                </div>
                                <div className={`price-delta-badge ${intradayChg >= 0 ? 'up' : 'down'}`}>
                                    <span>{intradayChg >= 0 ? '▲ +' : '▼ '}{Math.abs(intradayChg).toFixed(2)}</span>
                                    <span>({intradayPct >= 0 ? '+' : ''}{intradayPct.toFixed(2)}%) TODAY</span>
                                </div>
                            </div>
                        </div>
                    )}
                </section>

                {error && <div className="fintech-alert error">⚠️ {error}</div>}

                {!analysis && !loading && (
                    <section className="fintech-card empty-state-panel">
                        <div className="empty-graphic">📊</div>
                        <h2>Search for an Indian Stock</h2>
                        <p className="text-muted">Enter a symbol like RELIANCE, TCS, or HDFCBANK above to load real-time analytics.</p>
                        <Link className="fintech-secondary-btn" to="/">Back to Dashboard</Link>
                    </section>
                )}

                {analysis && (
                    <div className="analysis-content-shell">
                        <div className="fintech-tabs-bar">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={`fintech-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'overview' && (
                            <div className="overview-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className="overview-top-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.95fr)', gap: '20px', alignItems: 'stretch' }}>
                                    <div className="overview-left-col" style={{ minWidth: 0, height: '100%' }}>
                                        <Recommendation data={analysis} />
                                    </div>

                                    <div className="overview-right-col" style={{ minWidth: 0, height: '100%' }}>
                                        <div className="fintech-card chart-panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div className="chart-panel-header">
                                                <div>
                                                    <span className="fintech-eyebrow">TECHNICAL PRICE ACTION</span>
                                                    <h3 className="chart-panel-title">Interactive Price Action & Volume</h3>
                                                </div>
                                            </div>
                                            {stockData ? (
                                                <StockChart
                                                    data={stockData}
                                                    prediction={analysis?.prediction?.predicted}
                                                />
                                            ) : (
                                                <div className="chart-loading-box">Loading stock chart data…</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {analysis.fundamentals && (
                                    <div className="fintech-card range-volatility-card">
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">MARKET RANGE & VOLATILITY</span>
                                            <h3 className="card-title" style={{ marginTop: '2px' }}>52-Week Range & Historical Boundary Matrix</h3>
                                        </div>

                                        {analysis.fundamentals.fifty_two_week_low != null && analysis.fundamentals.fifty_two_week_high != null && (() => {
                                            const low = num(analysis.fundamentals.fifty_two_week_low);
                                            const high = num(analysis.fundamentals.fifty_two_week_high);
                                            const current = num(analysis.current_price);
                                            const rangePct = (high - low) > 0 ? ((current - low) / (high - low)) * 100 : 50;
                                            const prevHigh = analysis.fundamentals.prev_day_high != null ? num(analysis.fundamentals.prev_day_high) : null;
                                            const prevHighPct = prevHigh != null && (high - low) > 0 ? ((prevHigh - low) / (high - low)) * 100 : null;

                                            return (
                                                <div className="range-slider-wrapper" style={{ margin: '14px 0 20px' }}>
                                                    <div className="range-labels-row">
                                                        <div className="range-point">
                                                            <span className="range-sub">52W LOW</span>
                                                            <strong className="range-val-mono">₹{formatNumber(low, 2)}</strong>
                                                        </div>
                                                        <div className="range-point center">
                                                            <span className="range-sub">CURRENT POSITION ({rangePct.toFixed(0)}TH PCT)</span>
                                                            <strong className="range-val-mono highlight">₹{formatNumber(current, 2)}</strong>
                                                        </div>
                                                        <div className="range-point right">
                                                            <span className="range-sub">52W HIGH</span>
                                                            <strong className="range-val-mono">₹{formatNumber(high, 2)}</strong>
                                                        </div>
                                                    </div>
                                                    <div className="range-track-bg" style={{ position: 'relative' }}>
                                                        {prevHighPct != null && (
                                                            <div
                                                                className="range-prev-marker"
                                                                style={{ left: `${Math.min(98, Math.max(2, prevHighPct))}%` }}
                                                                title={`Prev Day High: ₹${formatNumber(prevHigh, 2)}`}
                                                            />
                                                        )}
                                                        <div
                                                            className="range-thumb-marker"
                                                            style={{ left: `${Math.min(98, Math.max(2, rangePct))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="prev-session-stats-row">
                                            <div className="prev-stat-box">
                                                <span className="risk-title">PREV DAY HIGH</span>
                                                <div className="risk-stat-row">
                                                    <strong className="risk-num-mono">
                                                        {analysis.fundamentals.prev_day_high != null ? `₹${formatNumber(analysis.fundamentals.prev_day_high, 2)}` : '—'}
                                                    </strong>
                                                    {analysis.fundamentals.prev_day_high != null && (() => {
                                                        const pdh = num(analysis.fundamentals.prev_day_high);
                                                        const cur = num(analysis.current_price);
                                                        const diff = ((cur - pdh) / pdh) * 100;
                                                        const isAbove = cur >= pdh;
                                                        return (
                                                            <span className={`signal-chip ${isAbove ? 'bullish' : 'neutral'}`}>
                                                                {isAbove ? 'Above PDH ▲' : `${diff.toFixed(2)}%`}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            <div className="prev-stat-box">
                                                <span className="risk-title">PREV DAY LOW</span>
                                                <div className="risk-stat-row">
                                                    <strong className="risk-num-mono">
                                                        {analysis.fundamentals.prev_day_low != null ? `₹${formatNumber(analysis.fundamentals.prev_day_low, 2)}` : '—'}
                                                    </strong>
                                                    {analysis.fundamentals.prev_day_low != null && (() => {
                                                        const pdl = num(analysis.fundamentals.prev_day_low);
                                                        const cur = num(analysis.current_price);
                                                        const diff = ((cur - pdl) / pdl) * 100;
                                                        const isAbove = cur >= pdl;
                                                        return (
                                                            <span className={`signal-chip ${isAbove ? 'bullish' : 'neutral'}`}>
                                                                {isAbove ? 'Above PDL ▲' : `${diff.toFixed(2)}%`}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="period-highs-matrix" style={{ marginTop: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <span className="risk-title" style={{ margin: 0 }}>PERIODIC RANGE & BOUNDARY MONITOR</span>
                                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>High / Low Proximity vs Current Price</span>
                                            </div>

                                            <div className="period-timeframe-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                                                {/* 1-WEEK TIMEFRAME */}
                                                {(() => {
                                                    const wh = num(analysis.fundamentals.week_high);
                                                    const wl = num(analysis.fundamentals.week_low);
                                                    const cur = num(analysis.current_price);
                                                    const isNewHigh = cur >= wh && wh > 0;
                                                    const isNewLow = cur <= wl && wl > 0;
                                                    const diffH = wh > 0 ? ((cur - wh) / wh) * 100 : 0;
                                                    const diffL = wl > 0 ? ((cur - wl) / wl) * 100 : 0;
                                                    const pct = (wh - wl) > 0 ? Math.min(100, Math.max(0, ((cur - wl) / (wh - wl)) * 100)) : 50;

                                                    return (
                                                        <div className="period-timeframe-card" style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.04em' }}>1-WEEK RANGE</span>
                                                                <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{pct.toFixed(0)}% of Range</span>
                                                            </div>

                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>High</span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#f1f5f9' }}>
                                                                            {analysis.fundamentals.week_high != null ? `₹${formatNumber(wh, 2)}` : '—'}
                                                                        </strong>
                                                                        {analysis.fundamentals.week_high != null && (
                                                                            <span className={`period-chip ${isNewHigh ? 'green' : 'red'}`}>
                                                                                {isNewHigh ? 'NEW HIGH ▲' : `${diffH.toFixed(2)}%`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', position: 'relative' }}>
                                                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius: '999px' }} />
                                                                </div>

                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Low</span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#f1f5f9' }}>
                                                                            {analysis.fundamentals.week_low != null ? `₹${formatNumber(wl, 2)}` : '—'}
                                                                        </strong>
                                                                        {analysis.fundamentals.week_low != null && (
                                                                            <span className={`period-chip ${isNewLow ? 'red' : 'green'}`}>
                                                                                {isNewLow ? 'NEW LOW ▼' : `+${diffL.toFixed(2)}%`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* 1-MONTH TIMEFRAME */}
                                                {(() => {
                                                    const mh = num(analysis.fundamentals.month_high);
                                                    const ml = num(analysis.fundamentals.month_low);
                                                    const cur = num(analysis.current_price);
                                                    const isNewHigh = cur >= mh && mh > 0;
                                                    const isNewLow = cur <= ml && ml > 0;
                                                    const diffH = mh > 0 ? ((cur - mh) / mh) * 100 : 0;
                                                    const diffL = ml > 0 ? ((cur - ml) / ml) * 100 : 0;
                                                    const pct = (mh - ml) > 0 ? Math.min(100, Math.max(0, ((cur - ml) / (mh - ml)) * 100)) : 50;

                                                    return (
                                                        <div className="period-timeframe-card" style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.04em' }}>1-MONTH RANGE</span>
                                                                <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{pct.toFixed(0)}% of Range</span>
                                                            </div>

                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>High</span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#f1f5f9' }}>
                                                                            {analysis.fundamentals.month_high != null ? `₹${formatNumber(mh, 2)}` : '—'}
                                                                        </strong>
                                                                        {analysis.fundamentals.month_high != null && (
                                                                            <span className={`period-chip ${isNewHigh ? 'green' : 'red'}`}>
                                                                                {isNewHigh ? 'NEW HIGH ▲' : `${diffH.toFixed(2)}%`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', position: 'relative' }}>
                                                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius: '999px' }} />
                                                                </div>

                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Low</span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#f1f5f9' }}>
                                                                            {analysis.fundamentals.month_low != null ? `₹${formatNumber(ml, 2)}` : '—'}
                                                                        </strong>
                                                                        {analysis.fundamentals.month_low != null && (
                                                                            <span className={`period-chip ${isNewLow ? 'red' : 'green'}`}>
                                                                                {isNewLow ? 'NEW LOW ▼' : `+${diffL.toFixed(2)}%`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* 1-QUARTER (3M) TIMEFRAME */}
                                                {(() => {
                                                    const qh = num(analysis.fundamentals.quarter_high);
                                                    const ql = num(analysis.fundamentals.quarter_low);
                                                    const cur = num(analysis.current_price);
                                                    const isNewHigh = cur >= qh && qh > 0;
                                                    const isNewLow = cur <= ql && ql > 0;
                                                    const diffH = qh > 0 ? ((cur - qh) / qh) * 100 : 0;
                                                    const diffL = ql > 0 ? ((cur - ql) / ql) * 100 : 0;
                                                    const pct = (qh - ql) > 0 ? Math.min(100, Math.max(0, ((cur - ql) / (qh - ql)) * 100)) : 50;

                                                    return (
                                                        <div className="period-timeframe-card" style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.04em' }}>1-QUARTER (3M) RANGE</span>
                                                                <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{pct.toFixed(0)}% of Range</span>
                                                            </div>

                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>High</span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#f1f5f9' }}>
                                                                            {analysis.fundamentals.quarter_high != null ? `₹${formatNumber(qh, 2)}` : '—'}
                                                                        </strong>
                                                                        {analysis.fundamentals.quarter_high != null && (
                                                                            <span className={`period-chip ${isNewHigh ? 'green' : 'red'}`}>
                                                                                {isNewHigh ? 'NEW HIGH ▲' : `${diffH.toFixed(2)}%`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', position: 'relative' }}>
                                                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius: '999px' }} />
                                                                </div>

                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Low</span>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: '#f1f5f9' }}>
                                                                            {analysis.fundamentals.quarter_low != null ? `₹${formatNumber(ql, 2)}` : '—'}
                                                                        </strong>
                                                                        {analysis.fundamentals.quarter_low != null && (
                                                                            <span className={`period-chip ${isNewLow ? 'red' : 'green'}`}>
                                                                                {isNewLow ? 'NEW LOW ▼' : `+${diffL.toFixed(2)}%`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        <div className="risk-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                                            <div className="risk-metric-box">
                                                <span className="risk-title">BETA (VOLATILITY)</span>
                                                {analysis.fundamentals.beta != null ? (() => {
                                                    const beta = num(analysis.fundamentals.beta);
                                                    const label = beta < 0.95 ? 'Low Beta (Defensive)' : beta <= 1.15 ? 'Market Neutral' : 'High Beta (Aggressive)';
                                                    const badgeClass = beta < 0.95 ? 'beta-low' : beta <= 1.15 ? 'beta-mid' : 'beta-high';
                                                    return (
                                                        <div className="risk-stat-row">
                                                            <strong className="risk-num-mono">{beta.toFixed(2)}</strong>
                                                            <span className={`risk-tag ${badgeClass}`}>{label}</span>
                                                        </div>
                                                    );
                                                })() : <span className="data-na">N/A</span>}
                                            </div>

                                            <div className="risk-metric-box">
                                                <span className="risk-title">50 / 200 DMA CROSS</span>
                                                {analysis.fundamentals.fifty_day_ma != null && analysis.fundamentals.two_hundred_day_ma != null ? (() => {
                                                    const fma = num(analysis.fundamentals.fifty_day_ma);
                                                    const thma = num(analysis.fundamentals.two_hundred_day_ma);
                                                    const isGolden = fma >= thma;
                                                    return (
                                                        <div className="risk-stat-row">
                                                            <strong className={`risk-num-mono ${isGolden ? 'text-up' : 'text-down'}`}>
                                                                {isGolden ? 'Golden Cross ▲' : 'Death Cross ▼'}
                                                            </strong>
                                                            <span className="risk-sub-detail">
                                                                50DMA {isGolden ? '>' : '<'} 200DMA
                                                            </span>
                                                        </div>
                                                    );
                                                })() : <span className="data-na">N/A</span>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'technical' && (
                            <div className="technical-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div className="fintech-card chart-panel-card">
                                    <div className="chart-panel-header">
                                        <div>
                                            <span className="fintech-eyebrow">MULTI-INDICATOR OVERLAY</span>
                                            <h3 className="chart-panel-title">Bollinger Bands, S/R & Volume Analysis</h3>
                                        </div>
                                    </div>
                                    {stockData ? (
                                        <StockChart
                                            data={stockData}
                                            initialToggles={{ bollinger: true, srLevels: true, volume: true, ma20: true, ma50: true }}
                                        />
                                    ) : (
                                        <div className="chart-loading-box">Loading technical chart data…</div>
                                    )}
                                </div>

                                <div className="technical-bottom-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'stretch' }}>
                                    <div className="fintech-card technical-matrix-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                                        <div>
                                            <div className="card-mini-head">
                                                <span className="fintech-eyebrow">MOMENTUM & TREND OSCILLATORS</span>
                                                <h3 className="card-title">Technical Parameter Matrix</h3>
                                            </div>

                                            <div className="tech-matrix-table" style={{ marginTop: '12px' }}>
                                                <div className="tech-row">
                                                    <div className="tech-meta">
                                                        <strong className="tech-name">RSI (14 Period)</strong>
                                                        <span className="tech-desc">Relative Strength Index</span>
                                                    </div>
                                                    <div className="tech-reading">
                                                        <strong className="reading-val-mono">{analysis.rsi != null ? Number(analysis.rsi).toFixed(2) : '—'}</strong>
                                                        <span className={`signal-chip ${analysis.rsi < 35 ? 'bullish' : analysis.rsi > 65 ? 'bearish' : 'neutral'}`}>
                                                            {analysis.rsi < 35 ? 'Oversold (<35)' : analysis.rsi > 65 ? 'Overbought (>65)' : 'Rangebound (35-65)'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="tech-row">
                                                    <div className="tech-meta">
                                                        <strong className="tech-name">MACD (12, 26)</strong>
                                                        <span className="tech-desc">Moving Average Convergence</span>
                                                    </div>
                                                    <div className="tech-reading">
                                                        <strong className="reading-val-mono">{analysis.macd != null ? Number(analysis.macd).toFixed(2) : '—'}</strong>
                                                        <span className={`signal-chip ${analysis.macd > 0 ? 'bullish' : 'bearish'}`}>
                                                            {analysis.macd > 0 ? 'Bullish (>0)' : 'Bearish (<0)'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="tech-row">
                                                    <div className="tech-meta">
                                                        <strong className="tech-name">20-Day SMA (MA20)</strong>
                                                        <span className="tech-desc">Short-term trend support</span>
                                                    </div>
                                                    <div className="tech-reading">
                                                        <strong className="reading-val-mono">{formatCurrency(analysis.ma20)}</strong>
                                                        <span className={`signal-chip ${analysis.current_price >= analysis.ma20 ? 'bullish' : 'bearish'}`}>
                                                            {analysis.current_price >= analysis.ma20 ? 'Price > MA20' : 'Price < MA20'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="tech-row">
                                                    <div className="tech-meta">
                                                        <strong className="tech-name">50-Day SMA (MA50)</strong>
                                                        <span className="tech-desc">Intermediate structural trend</span>
                                                    </div>
                                                    <div className="tech-reading">
                                                        <strong className="reading-val-mono">{formatCurrency(analysis.ma50)}</strong>
                                                        <span className={`signal-chip ${analysis.current_price >= analysis.ma50 ? 'bullish' : 'bearish'}`}>
                                                            {analysis.current_price >= analysis.ma50 ? 'Price > MA50' : 'Price < MA50'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {analysis.fundamentals?.two_hundred_day_ma && (
                                                    <div className="tech-row">
                                                        <div className="tech-meta">
                                                            <strong className="tech-name">200-Day SMA (MA200)</strong>
                                                            <span className="tech-desc">Long-term institutional baseline</span>
                                                        </div>
                                                        <div className="tech-reading">
                                                            <strong className="reading-val-mono">{formatCurrency(analysis.fundamentals.two_hundred_day_ma)}</strong>
                                                            <span className={`signal-chip ${analysis.current_price >= analysis.fundamentals.two_hundred_day_ma ? 'bullish' : 'bearish'}`}>
                                                                {analysis.current_price >= analysis.fundamentals.two_hundred_day_ma ? 'Above MA200' : 'Below MA200'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="fintech-card glossary-card" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">INDICATOR METHODOLOGY</span>
                                            <h3 className="card-title">Technical Reference Guide</h3>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                                            <div style={{ padding: '10px 12px', background: 'var(--bg-card-alt)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                                <strong style={{ color: '#60a5fa', fontSize: '0.85rem' }}>RSI (Relative Strength Index):</strong>
                                                <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.78rem', lineHeight: '1.4' }}>Measures velocity of directional price moves (0-100). &lt;35 indicates oversold; &gt;65 warns of overbought exhaustion.</p>
                                            </div>
                                            <div style={{ padding: '10px 12px', background: 'var(--bg-card-alt)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                                <strong style={{ color: '#34d399', fontSize: '0.85rem' }}>MACD Oscillator:</strong>
                                                <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.78rem', lineHeight: '1.4' }}>Spread between 12-day and 26-day exponential moving averages. Positive histogram signals bullish momentum expansion.</p>
                                            </div>
                                            <div style={{ padding: '10px 12px', background: 'var(--bg-card-alt)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                                <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}>Bollinger Bands (20, 2):</strong>
                                                <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.78rem', lineHeight: '1.4' }}>Standard deviation channels capturing 95% of expected volatility. Band squeezes typically precede sharp breakout volatility.</p>
                                            </div>
                                            <div style={{ padding: '10px 12px', background: 'var(--bg-card-alt)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                                <strong style={{ color: '#c084fc', fontSize: '0.85rem' }}>Support & Resistance:</strong>
                                                <p style={{ margin: '2px 0 0', color: '#94a3b8', fontSize: '0.78rem', lineHeight: '1.4' }}>Key horizontal price levels derived from 30-day swing highs and swing lows where market liquidity clusters.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'fundamental' && (
                            <div className="fundamental-quad-grid">
                                <div className="fintech-card fund-card">
                                    <div className="card-mini-head">
                                        <span className="fintech-eyebrow">VALUATION MULTIPLES</span>
                                        <h3 className="card-title">Pricing & Leverage</h3>
                                    </div>
                                    <ul className="fund-metric-list">
                                        <li>
                                            <div className="metric-title-group">
                                                <span>P/E Ratio (TTM)</span>
                                                <span className="metric-hint">Sector Median ~24.0x</span>
                                            </div>
                                            <div className="metric-val-group">
                                                <strong className="fund-val-mono">{formatRatio(analysis.fundamentals?.pe)}</strong>
                                                {isPEOutlier && <span className="warning-chip">⚠️ Outlier / High</span>}
                                            </div>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Price-to-Book (P/B)</span>
                                                <span className="metric-hint">Asset backing multiple</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatRatio(analysis.fundamentals?.pb)}</strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Debt-to-Equity (D/E)</span>
                                                <span className="metric-hint">&lt;1.0 considered safe leverage</span>
                                            </div>
                                            <div className="metric-val-group">
                                                <strong className="fund-val-mono">{formatRatio(analysis.fundamentals?.debt_to_equity)}</strong>
                                                {analysis.fundamentals?.debt_to_equity != null && Number(analysis.fundamentals.debt_to_equity) > 5.0 && (
                                                    <span className="warning-chip">⚠️ High Leverage</span>
                                                )}
                                                {analysis.fundamentals?.debt_to_equity != null && Number(analysis.fundamentals.debt_to_equity) <= 0.8 && (
                                                    <span className="good-chip">Low Debt</span>
                                                )}
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                <div className="fintech-card fund-card">
                                    <div className="card-mini-head">
                                        <span className="fintech-eyebrow">PROFITABILITY & RETURNS</span>
                                        <h3 className="card-title">Earnings & Returns</h3>
                                    </div>
                                    <ul className="fund-metric-list">
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Return on Equity (ROE)</span>
                                                <span className="metric-hint">Shareholder capital efficiency</span>
                                            </div>
                                            <strong className="fund-val-mono">
                                                {analysis.fundamentals?.roe != null ? `${(Number(analysis.fundamentals.roe) * 100).toFixed(2)}%` : <span className="data-na">N/A (Data Pending)</span>}
                                            </strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Dividend Yield</span>
                                                <span className="metric-hint">Annual cash payout yield</span>
                                            </div>
                                            <div className="metric-val-group">
                                                <strong className="fund-val-mono">
                                                    {divYieldPct != null ? `${divYieldPct.toFixed(2)}%` : <span className="data-na">N/A</span>}
                                                </strong>
                                                {isDividendOutlier && <span className="warning-chip">⚠️ Outlier / Check Scaling</span>}
                                            </div>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Trailing EPS</span>
                                                <span className="metric-hint">TTM Earnings Per Share</span>
                                            </div>
                                            <strong className="fund-val-mono">
                                                {analysis.fundamentals?.eps != null ? `₹${formatNumber(analysis.fundamentals.eps, 2)}` : <span className="data-na">N/A</span>}
                                            </strong>
                                        </li>
                                    </ul>
                                </div>

                                <div className="fintech-card fund-card">
                                    <div className="card-mini-head">
                                        <span className="fintech-eyebrow">OPERATING SCALE</span>
                                        <h3 className="card-title">Topline & Income</h3>
                                    </div>
                                    <ul className="fund-metric-list">
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Revenue / Sales (TTM)</span>
                                                <span className="metric-hint">Gross operational scale</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatCrores(analysis.fundamentals?.sales)}</strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Operating Profit</span>
                                                <span className="metric-hint">EBITDA / Core Operations</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatCrores(analysis.fundamentals?.operating_profit)}</strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Net Profit (PAT)</span>
                                                <span className="metric-hint">Bottom-line net income</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatCrores(analysis.fundamentals?.net_profit)}</strong>
                                        </li>
                                    </ul>
                                </div>

                                <div className="fintech-card fund-card">
                                    <div className="card-mini-head">
                                        <span className="fintech-eyebrow">LIQUIDITY & RISK</span>
                                        <h3 className="card-title">Market Profile</h3>
                                    </div>
                                    <ul className="fund-metric-list">
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Stock Beta</span>
                                                <span className="metric-hint">Relative volatility vs Nifty 50</span>
                                            </div>
                                            <strong className="fund-val-mono">
                                                {analysis.fundamentals?.beta != null ? `${Number(analysis.fundamentals.beta).toFixed(2)}x` : '1.00x (Baseline)'}
                                            </strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Average Daily Volume</span>
                                                <span className="metric-hint">Secondary market liquidity</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatShares(analysis.fundamentals?.volume_avg)}</strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>52W High / Low Range</span>
                                                <span className="metric-hint">Annual boundary band</span>
                                            </div>
                                            <strong className="fund-val-mono" style={{ fontSize: '0.82rem' }}>
                                                {analysis.fundamentals?.fifty_two_week_low && analysis.fundamentals?.fifty_two_week_high
                                                    ? `₹${formatNumber(analysis.fundamentals.fifty_two_week_low, 0)} – ₹${formatNumber(analysis.fundamentals.fifty_two_week_high, 0)}`
                                                    : 'Data Pending'}
                                            </strong>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {activeTab === 'actions' && (
                            <div className="tab-pane-grid corporate-actions-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

                                    <div className="fintech-card">
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">FORWARD CALENDAR</span>
                                            <h3 className="card-title">Upcoming Corporate Announcements</h3>
                                        </div>

                                        <div className="tech-matrix-table" style={{ marginTop: '12px' }}>
                                            <div className="tech-row" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '1.4rem' }}>📅</span>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <strong style={{ fontSize: '0.95rem', color: '#f1f5f9' }}>Next Quarterly Results Date</strong>
                                                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Board meeting for financial disclosures</span>
                                                    </div>
                                                </div>
                                                <div style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                    {analysis.upcoming_events?.earnings_dates && analysis.upcoming_events.earnings_dates.length > 0 ? (
                                                        <span
                                                            style={{
                                                                background: 'rgba(59, 130, 246, 0.15)',
                                                                color: '#60a5fa',
                                                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                                                padding: '4px 10px',
                                                                borderRadius: '6px',
                                                                fontFamily: 'var(--font-mono)',
                                                                fontWeight: '700',
                                                                fontSize: '0.85rem'
                                                            }}
                                                        >
                                                            {analysis.upcoming_events.earnings_dates[0]}
                                                        </span>
                                                    ) : (
                                                        <span className="data-na">Date Pending Notice</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {(analysis.upcoming_events?.earnings_avg != null || analysis.upcoming_events?.revenue_avg != null) && (
                                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                                                <span className="risk-title" style={{ display: 'block', marginBottom: '10px' }}>
                                                    FORWARD QUARTER ESTIMATES (ANALYST CONSENSUS)
                                                </span>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                                    {analysis.upcoming_events?.earnings_avg != null && (
                                                        <div className="period-high-item" style={{ padding: '12px' }}>
                                                            <span className="period-label">CONSENSUS EPS ESTIMATE</span>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                                                <strong style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: '#f1f5f9' }}>
                                                                    ₹{Number(analysis.upcoming_events.earnings_avg).toFixed(2)}
                                                                </strong>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {analysis.upcoming_events?.revenue_avg != null && (
                                                        <div className="period-high-item" style={{ padding: '12px' }}>
                                                            <span className="period-label">CONSENSUS REVENUE ESTIMATE</span>
                                                            <div style={{ marginTop: '4px' }}>
                                                                <strong style={{ fontSize: '1.2rem', fontFamily: 'var(--font-mono)', color: '#f1f5f9', whiteSpace: 'nowrap' }}>
                                                                    {formatCrores(analysis.upcoming_events.revenue_avg)}
                                                                </strong>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* ACTION MECHANICS */}
                                    <div className="fintech-card">
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">ACTION MECHANICS</span>
                                            <h3 className="card-title">How Corporate Actions Affect Prices</h3>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', fontSize: '0.86rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                                            <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                                <strong style={{ color: '#93c5fd', display: 'block', marginBottom: '2px' }}>✂️ Stock Splits & Bonus Issues:</strong>
                                                When a stock splits (e.g. 1:2), share count doubles and market price halves. Market cap remains unchanged and historical charts are split-adjusted.
                                            </div>
                                            <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                <strong style={{ color: '#6ee7b7', display: 'block', marginBottom: '2px' }}>💰 Cash Dividends:</strong>
                                                Cash payouts distributed per share to eligible shareholders on the record date. Price adjusts downward by dividend amount on the ex-date.
                                            </div>
                                            <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                                <strong style={{ color: '#c084fc', display: 'block', marginBottom: '2px' }}>📅 Quarterly Disclosures:</strong>
                                                Regular performance filings (Q1-Q4) with NSE/BSE. Forward consensus estimates represent market expectations before publication.
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
                                    {/* HISTORICAL ACTIONS */}
                                    <div className="fintech-card">
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">HISTORICAL TIMELINE</span>
                                            <h3 className="card-title">Past Stock Splits & Dividends</h3>
                                        </div>

                                        {analysis.corporate_actions && analysis.corporate_actions.length > 0 ? (
                                            <div className="tech-matrix-table" style={{ marginTop: '12px' }}>
                                                {analysis.corporate_actions.map((action, idx) => {
                                                    const isSplit = action.type === 'split';
                                                    return (
                                                        <div key={`${action.date}-${idx}`} className="tech-row" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <span style={{ fontSize: '1.2rem' }}>{isSplit ? '✂️' : '💰'}</span>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <strong className="tech-name" style={{ color: isSplit ? '#60a5fa' : '#34d399', fontSize: '0.9rem' }}>
                                                                        {action.title}
                                                                    </strong>
                                                                    <span className="tech-desc" style={{ fontSize: '0.76rem', color: '#94a3b8' }}>
                                                                        Ex-Date: {action.date}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="tech-reading" style={{ whiteSpace: 'nowrap' }}>
                                                                <span className={`signal-chip ${isSplit ? 'neutral' : 'bullish'}`} style={{ padding: '4px 8px' }}>
                                                                    {isSplit ? `Factor: ${action.value}x` : `₹${Number(action.value).toFixed(2)} / Share`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                                                No recent stock splits or dividends recorded for this symbol.
                                            </div>
                                        )}
                                    </div>


                                </div>
                            </div>
                        )}

                        {activeTab === 'predicted' && (
                            <div className="tab-pane-grid predicted-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', alignItems: 'stretch' }}>
                                <div className="predicted-left-col" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div className="fintech-card forecast-spec-card">
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">STATISTICAL FORECASTING</span>
                                            <h3 className="card-title">Linear Regression Drift</h3>
                                        </div>

                                        {analysis.prediction ? (() => {
                                            const slope = Number(analysis.prediction.slope || 0);
                                            const rSquared = Number(analysis.prediction.r_squared || 0);
                                            const isUp = slope >= 0;
                                            const fitLabel = rSquared >= 0.70 ? 'High Linear Fit' : rSquared >= 0.40 ? 'Moderate Fit' : 'Weak Fit (High Variance)';
                                            const fitClass = rSquared >= 0.70 ? 'fit-high' : rSquared >= 0.40 ? 'fit-mid' : 'fit-low';

                                            return (
                                                <div className="forecast-metrics-container">
                                                    <div className="forecast-verdict-box">
                                                        <span className="verdict-sub">DERIVED 14-DAY DRIFT</span>
                                                        <div className={`forecast-big-badge ${isUp ? 'up' : 'down'}`}>
                                                            {isUp ? '▲ Upward Drift (Bullish)' : '▼ Downward Drift (Bearish)'}
                                                        </div>
                                                    </div>

                                                    <div className="stat-param-list">
                                                        <div className="stat-row">
                                                            <span className="stat-label">Daily Delta</span>
                                                            <strong className="stat-val-mono">
                                                                {slope >= 0 ? '+' : ''}₹{slope.toFixed(3)} / day
                                                            </strong>
                                                        </div>
                                                        <div className="stat-row">
                                                            <span className="stat-label">Goodness of Fit (R²)</span>
                                                            <div className="r2-reading-group">
                                                                <strong className="stat-val-mono">{rSquared.toFixed(4)}</strong>
                                                                <span className={`fit-tag ${fitClass}`}>{fitLabel}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="forecast-disclaimer-box">
                                                        <div className="disclaimer-title">ℹ️ Model Assumptions</div>
                                                        <p>
                                                            This projection uses OLS linear regression on 30-day sequential price data. It assumes trend continuation and does not account for news shocks or gap risk.
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            <p className="text-muted">Prediction data is not available for this stock.</p>
                                        )}
                                    </div>

                                    <div className="fintech-card">
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">INTERPRETATION GUIDE</span>
                                            <h3 className="card-title">How to Use Drift Trajectory</h3>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.45', marginTop: '10px' }}>
                                            <p style={{ margin: 0 }}>• <strong>Drift Velocity:</strong> Indicates mathematical momentum slope across historical 30-day closings.</p>
                                            <p style={{ margin: 0 }}>• <strong>R² Goodness of Fit:</strong> Readings above 0.50 confirm consistent directional trends; lower values indicate rangebound market noise.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="predicted-right-col">
                                    <div className="fintech-card chart-panel-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div className="chart-panel-header">
                                            <div>
                                                <span className="fintech-eyebrow">14-DAY PROJECTION TRAJECTORY</span>
                                                <h3 className="chart-panel-title">Historical Price & Statistical Forward Path</h3>
                                            </div>
                                        </div>
                                        {stockData ? (
                                            <StockChart
                                                data={{
                                                    history: stockData.history || [],
                                                    prediction: (analysis && analysis.prediction) ? analysis.prediction.predicted : [],
                                                }}
                                            />
                                        ) : (
                                            <div className="chart-loading-box">Loading projection chart…</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Analysis;

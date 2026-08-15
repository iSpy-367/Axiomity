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
    { key: 'predicted', label: 'Predicted Direction' },
];

const POPULAR_TICKERS = [
    { symbol: 'RELIANCE', name: 'Reliance' },
    { symbol: 'TCS', name: 'TCS' },
    { symbol: 'INFY', name: 'Infosys' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors' },
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
    const [glossaryOpen, setGlossaryOpen] = useState(false);

    // Typeahead Autocomplete State
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

    // Debounced Autocomplete Fetch
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

    // Click outside to close typeahead dropdown
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

    // Financial Formatters
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

    const formatNumber = (value, decimals = 2) => {
        if (value == null || isNaN(value)) return <span className="data-na">N/A</span>;
        return Number(value).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    };

    const formatRatio = (value, suffix = 'x') => {
        if (value == null || isNaN(value)) return <span className="data-na">N/A</span>;
        return `${Number(value).toFixed(2)}${suffix}`;
    };

    const num = (v) => (v == null ? 0 : Number(v));

    // Calculate Intraday Delta if history is available
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

    // Defensive Check: Dividend Yield Outlier (>20%)
    const rawDivYield = analysis?.fundamentals?.dividend_yield;
    const divYieldPct = rawDivYield != null ? Number(rawDivYield) * (rawDivYield < 1 ? 100 : 1) : null;
    const isDividendOutlier = divYieldPct != null && divYieldPct > 20;

    // Defensive Check: P/E Outlier (>150 or < 0)
    const rawPE = analysis?.fundamentals?.pe;
    const peNum = rawPE != null ? Number(rawPE) : null;
    const isPEOutlier = peNum != null && (peNum > 150 || peNum < 0);

    return (
        <div className="app-shell fintech-workspace">
            <Navbar />
            <div className="analysis-page-container">
                {/* Top Terminal Search & Quick Ticker Bar */}
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

                            {/* Autocomplete Typeahead Dropdown Menu */}
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

                    {/* Stock Price & Ticker Meta Pill Header */}
                    {analysis && (
                        <div className="stock-hero-strip">
                            <div className="stock-identity">
                                <div className="stock-title-row">
                                    <h1>{analysis.name}</h1>
                                    <span className="exchange-tag">
                                        {analysis.exchange || 'NSE'}: {analysis.script_code || analysis.symbol}
                                    </span>
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
                        {/* 4 Tabs Bar */}
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

                        {/* TAB 1: OVERVIEW */}
                        {activeTab === 'overview' && (
                            <div className="tab-pane-grid overview-layout">
                                {/* Left Column: Signal Scorecard + Range Metrics */}
                                <div className="overview-left-col">
                                    <Recommendation data={analysis} />

                                    {/* 52-Week Range & Volatility Box */}
                                    {analysis.fundamentals && (
                                        <div className="fintech-card range-volatility-card">
                                            <div className="card-mini-head">
                                                <span className="fintech-eyebrow">MARKET RANGE & VOLATILITY</span>
                                            </div>

                                            {/* 52W Range Slider */}
                                            {analysis.fundamentals.fifty_two_week_low != null && analysis.fundamentals.fifty_two_week_high != null && (() => {
                                                const low = num(analysis.fundamentals.fifty_two_week_low);
                                                const high = num(analysis.fundamentals.fifty_two_week_high);
                                                const current = num(analysis.current_price);
                                                const rangePct = (high - low) > 0 ? ((current - low) / (high - low)) * 100 : 50;
                                                const prevHigh = analysis.fundamentals.prev_day_high != null ? num(analysis.fundamentals.prev_day_high) : null;
                                                const prevHighPct = prevHigh != null && (high - low) > 0 ? ((prevHigh - low) / (high - low)) * 100 : null;

                                                return (
                                                    <div className="range-slider-wrapper">
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

                                            {/* Previous Session Range (Prev Day High & Low) */}
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
                                                                <span className={`signal-chip ${isAbove ? 'bullish' : 'bearish'}`}>
                                                                    {isAbove ? `+${diff.toFixed(2)}%` : 'Below PDL ▼'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Periodic Range Monitor (1W / 1M / 3M Quarter Highs & Lows) */}
                                            <div className="period-highs-matrix">
                                                <span className="risk-title" style={{ marginBottom: '6px', display: 'block' }}>
                                                    PERIODIC RANGE MONITOR (HIGHS & LOWS)
                                                </span>
                                                <div className="period-highs-grid">
                                                    {/* 1-Week High */}
                                                    <div className="period-high-item">
                                                        <span className="period-label">1-WEEK HIGH</span>
                                                        <div className="period-val-row">
                                                            <strong className="period-num">
                                                                {analysis.fundamentals.week_high != null ? `₹${formatNumber(analysis.fundamentals.week_high, 2)}` : '—'}
                                                            </strong>
                                                            {analysis.fundamentals.week_high != null && (() => {
                                                                const wh = num(analysis.fundamentals.week_high);
                                                                const cur = num(analysis.current_price);
                                                                const isNewHigh = cur >= wh;
                                                                const diff = ((cur - wh) / wh) * 100;
                                                                return (
                                                                    <span className={`period-chip ${isNewHigh ? 'green' : 'red'}`}>
                                                                        {isNewHigh ? 'NEW HIGH ▲' : `${diff.toFixed(2)}%`}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* 1-Month High */}
                                                    <div className="period-high-item">
                                                        <span className="period-label">1-MONTH HIGH</span>
                                                        <div className="period-val-row">
                                                            <strong className="period-num">
                                                                {analysis.fundamentals.month_high != null ? `₹${formatNumber(analysis.fundamentals.month_high, 2)}` : '—'}
                                                            </strong>
                                                            {analysis.fundamentals.month_high != null && (() => {
                                                                const mh = num(analysis.fundamentals.month_high);
                                                                const cur = num(analysis.current_price);
                                                                const isNewHigh = cur >= mh;
                                                                const diff = ((cur - mh) / mh) * 100;
                                                                return (
                                                                    <span className={`period-chip ${isNewHigh ? 'green' : 'red'}`}>
                                                                        {isNewHigh ? 'NEW HIGH ▲' : `${diff.toFixed(2)}%`}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* 1-Quarter High (3M) */}
                                                    <div className="period-high-item">
                                                        <span className="period-label">1-QUARTER HIGH (3M)</span>
                                                        <div className="period-val-row">
                                                            <strong className="period-num">
                                                                {analysis.fundamentals.quarter_high != null ? `₹${formatNumber(analysis.fundamentals.quarter_high, 2)}` : '—'}
                                                            </strong>
                                                            {analysis.fundamentals.quarter_high != null && (() => {
                                                                const qh = num(analysis.fundamentals.quarter_high);
                                                                const cur = num(analysis.current_price);
                                                                const isNewHigh = cur >= qh;
                                                                const diff = ((cur - qh) / qh) * 100;
                                                                return (
                                                                    <span className={`period-chip ${isNewHigh ? 'green' : 'red'}`}>
                                                                        {isNewHigh ? 'NEW HIGH ▲' : `${diff.toFixed(2)}%`}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* 1-Week Low */}
                                                    <div className="period-high-item">
                                                        <span className="period-label">1-WEEK LOW</span>
                                                        <div className="period-val-row">
                                                            <strong className="period-num">
                                                                {analysis.fundamentals.week_low != null ? `₹${formatNumber(analysis.fundamentals.week_low, 2)}` : '—'}
                                                            </strong>
                                                            {analysis.fundamentals.week_low != null && (() => {
                                                                const wl = num(analysis.fundamentals.week_low);
                                                                const cur = num(analysis.current_price);
                                                                const isNewLow = cur <= wl;
                                                                const diff = ((cur - wl) / wl) * 100;
                                                                return (
                                                                    <span className={`period-chip ${isNewLow ? 'red' : 'green'}`}>
                                                                        {isNewLow ? 'NEW LOW ▼' : `+${diff.toFixed(2)}%`}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* 1-Month Low */}
                                                    <div className="period-high-item">
                                                        <span className="period-label">1-MONTH LOW</span>
                                                        <div className="period-val-row">
                                                            <strong className="period-num">
                                                                {analysis.fundamentals.month_low != null ? `₹${formatNumber(analysis.fundamentals.month_low, 2)}` : '—'}
                                                            </strong>
                                                            {analysis.fundamentals.month_low != null && (() => {
                                                                const ml = num(analysis.fundamentals.month_low);
                                                                const cur = num(analysis.current_price);
                                                                const isNewLow = cur <= ml;
                                                                const diff = ((cur - ml) / ml) * 100;
                                                                return (
                                                                    <span className={`period-chip ${isNewLow ? 'red' : 'green'}`}>
                                                                        {isNewLow ? 'NEW LOW ▼' : `+${diff.toFixed(2)}%`}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* 1-Quarter Low (3M) */}
                                                    <div className="period-high-item">
                                                        <span className="period-label">1-QUARTER LOW (3M)</span>
                                                        <div className="period-val-row">
                                                            <strong className="period-num">
                                                                {analysis.fundamentals.quarter_low != null ? `₹${formatNumber(analysis.fundamentals.quarter_low, 2)}` : '—'}
                                                            </strong>
                                                            {analysis.fundamentals.quarter_low != null && (() => {
                                                                const ql = num(analysis.fundamentals.quarter_low);
                                                                const cur = num(analysis.current_price);
                                                                const isNewLow = cur <= ql;
                                                                const diff = ((cur - ql) / ql) * 100;
                                                                return (
                                                                    <span className={`period-chip ${isNewLow ? 'red' : 'green'}`}>
                                                                        {isNewLow ? 'NEW LOW ▼' : `+${diff.toFixed(2)}%`}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Beta & 50/200 DMA Matrix */}
                                            <div className="risk-metrics-grid" style={{ marginTop: '14px' }}>
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

                                {/* Right Column: Interactive Stock Chart */}
                                <div className="overview-right-col">
                                    <div className="fintech-card chart-panel-card">
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
                        )}

                        {/* TAB 2: TECHNICAL ANALYSIS */}
                        {activeTab === 'technical' && (
                            <div className="tab-pane-grid technical-layout">
                                {/* Left Column: Technical Matrix & Parameters */}
                                <div className="technical-left-col">
                                    <div className="fintech-card technical-matrix-card">
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">MOMENTUM & TREND OSCILLATORS</span>
                                            <h3 className="card-title">Technical Parameter Matrix</h3>
                                        </div>

                                        <div className="tech-matrix-table">
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

                                    {/* Collapsible Indicator Methodology Glossary */}
                                    <div className="fintech-card glossary-collapsible-card">
                                        <button
                                            type="button"
                                            className="glossary-toggle-head"
                                            onClick={() => setGlossaryOpen(prev => !prev)}
                                        >
                                            <div className="glossary-head-left">
                                                <span className="glossary-icon">📘</span>
                                                <strong className="glossary-title">Indicator Reference & Methodology</strong>
                                            </div>
                                            <span className="glossary-chevron">{glossaryOpen ? '▲ Hide' : '▼ View Guide'}</span>
                                        </button>

                                        {glossaryOpen && (
                                            <div className="glossary-body-content">
                                                <div className="glossary-item">
                                                    <strong>RSI (Relative Strength Index):</strong>
                                                    <p>Measures momentum on a 0-100 scale. Readings &lt;30 indicate oversold buying opportunities; &gt;70 warn of extended overbought risk.</p>
                                                </div>
                                                <div className="glossary-item">
                                                    <strong>MACD (Moving Average Convergence Divergence):</strong>
                                                    <p>Calculates the spread between 12-day and 26-day EMAs. Values above zero signify positive trend acceleration.</p>
                                                </div>
                                                <div className="glossary-item">
                                                    <strong>Bollinger Bands:</strong>
                                                    <p>Envelopes 2 standard deviations above and below the 20-SMA. Price tagging the upper band indicates high volatility/overextension.</p>
                                                </div>
                                                <div className="glossary-item">
                                                    <strong>Support & Resistance (S/R):</strong>
                                                    <p>Key horizontal price levels derived from 30-day swing highs and swing lows where market liquidity clusters.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: Full Technical Chart with Overlays */}
                                <div className="technical-right-col">
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
                                </div>
                            </div>
                        )}

                        {/* TAB 3: FUNDAMENTAL ANALYSIS */}
                        {activeTab === 'fundamental' && (
                            <div className="fundamental-quad-grid">
                                {/* Card 1: Valuation Multiples */}
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
                                                {analysis.fundamentals?.debt_to_equity != null && Number(analysis.fundamentals.debt_to_equity) < 0.8 && (
                                                    <span className="good-chip">Low Debt</span>
                                                )}
                                            </div>
                                        </li>
                                    </ul>
                                </div>

                                {/* Card 2: Profitability & Margins */}
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
                                                <span>Earnings Per Share (EPS)</span>
                                                <span className="metric-hint">Trailing twelve months (TTM)</span>
                                            </div>
                                            <strong className="fund-val-mono">₹{formatNumber(analysis.fundamentals?.eps, 2)}</strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Average Volume</span>
                                                <span className="metric-hint">30-day liquidity depth</span>
                                            </div>
                                            <strong className="fund-val-mono">
                                                {analysis.fundamentals?.volume_avg ? (Number(analysis.fundamentals.volume_avg) >= 10000000 ? `${(Number(analysis.fundamentals.volume_avg) / 10000000).toFixed(2)} Cr shares` : `${(Number(analysis.fundamentals.volume_avg) / 100000).toFixed(2)} L shares`) : <span className="data-na">N/A</span>}
                                            </strong>
                                        </li>
                                    </ul>
                                </div>

                                {/* Card 3: Dividend & Yield */}
                                <div className="fintech-card fund-card">
                                    <div className="card-mini-head">
                                        <span className="fintech-eyebrow">DIVIDEND & CASH FLOW</span>
                                        <h3 className="card-title">Shareholder Returns</h3>
                                    </div>
                                    <ul className="fund-metric-list">
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Dividend Yield</span>
                                                <span className="metric-hint">Annual dividend / Price</span>
                                            </div>
                                            <div className="metric-val-group">
                                                <strong className="fund-val-mono">
                                                    {divYieldPct != null ? `${divYieldPct.toFixed(2)}%` : <span className="data-na">N/A</span>}
                                                </strong>
                                                {isDividendOutlier && (
                                                    <span className="warning-chip">⚠️ &gt;20% Special Div / Outlier</span>
                                                )}
                                            </div>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>50-Day Moving Average</span>
                                                <span className="metric-hint">Medium-term price floor</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatCurrency(analysis.fundamentals?.fifty_day_ma)}</strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>200-Day Moving Average</span>
                                                <span className="metric-hint">Long-term institutional support</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatCurrency(analysis.fundamentals?.two_hundred_day_ma)}</strong>
                                        </li>
                                    </ul>
                                </div>

                                {/* Card 4: Balance Sheet & Scale */}
                                <div className="fintech-card fund-card">
                                    <div className="card-mini-head">
                                        <span className="fintech-eyebrow">FINANCIAL SCALE</span>
                                        <h3 className="card-title">Scale & Operations (₹ Cr)</h3>
                                    </div>
                                    <ul className="fund-metric-list">
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Total Revenue (Sales)</span>
                                                <span className="metric-hint">Top-line turnover</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatCrores(analysis.fundamentals?.sales)}</strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Operating Profit</span>
                                                <span className="metric-hint">EBITDA / Operating surplus</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatCrores(analysis.fundamentals?.operating_profit)}</strong>
                                        </li>
                                        <li>
                                            <div className="metric-title-group">
                                                <span>Net Income (PAT)</span>
                                                <span className="metric-hint">Bottom-line profit after tax</span>
                                            </div>
                                            <strong className="fund-val-mono">{formatCrores(analysis.fundamentals?.net_profit)}</strong>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {/* TAB 4: PREDICTED DIRECTION (STATISTICAL FORECAST) */}
                        {activeTab === 'predicted' && (
                            <div className="tab-pane-grid predicted-layout">
                                {/* Left Column: Model Statistical Specification */}
                                <div className="predicted-left-col">
                                    <div className="fintech-card forecast-spec-card">
                                        <div className="card-mini-head">
                                            <span className="fintech-eyebrow">STATISTICAL FORECASTING</span>
                                            <h3 className="card-title">Linear Regression Drift</h3>
                                        </div>

                                        {analysis.prediction ? (() => {
                                            const slope = Number(analysis.prediction.slope || 0);
                                            const rSquared = Number(analysis.prediction.r_squared || 0);
                                            // Derived directly from the same slope
                                            const isUp = slope >= 0;
                                            const fitLabel = rSquared >= 0.70 ? 'High Linear Fit' : rSquared >= 0.40 ? 'Moderate Fit' : 'Weak Fit (High Variance)';
                                            const fitClass = rSquared >= 0.70 ? 'fit-high' : rSquared >= 0.40 ? 'fit-mid' : 'fit-low';

                                            return (
                                                <div className="forecast-metrics-container">
                                                    {/* Primary Direction Pill */}
                                                    <div className="forecast-verdict-box">
                                                        <span className="verdict-sub">DERIVED 14-DAY DRIFT</span>
                                                        <div className={`forecast-big-badge ${isUp ? 'up' : 'down'}`}>
                                                            {isUp ? '▲ Upward Drift (Bullish)' : '▼ Downward Drift (Bearish)'}
                                                        </div>
                                                    </div>

                                                    {/* Statistical Parameters Table */}
                                                    <div className="stat-param-list">
                                                        <div className="stat-row">
                                                            <span className="stat-label">Daily Delta (Slope Coefficient m)</span>
                                                            <strong className="stat-val-mono">
                                                                {slope >= 0 ? '+' : ''}₹{slope.toFixed(3)} / day
                                                            </strong>
                                                        </div>
                                                        <div className="stat-row">
                                                            <span className="stat-label">Goodness of Fit (R² Index)</span>
                                                            <div className="r2-reading-group">
                                                                <strong className="stat-val-mono">{rSquared.toFixed(4)}</strong>
                                                                <span className={`fit-tag ${fitClass}`}>{fitLabel}</span>
                                                            </div>
                                                        </div>
                                                        <div className="stat-row">
                                                            <span className="stat-label">Forecast Horizon</span>
                                                            <strong className="stat-val-mono">14 Calendar Days</strong>
                                                        </div>
                                                    </div>

                                                    {/* Honest Statistical Disclaimer Box */}
                                                    <div className="forecast-disclaimer-box">
                                                        <div className="disclaimer-title">ℹ️ Model Assumptions & Boundaries</div>
                                                        <p>
                                                            This projection uses Ordinary Least Squares (OLS) linear regression on sequential price data. It assumes continuation of the recent slope trajectory and does not price in earnings announcements, news shocks, or overnight gap risk.
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })() : (
                                            <p className="text-muted">Prediction data is not available for this stock.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column: 14-Day Projection SVG Chart */}
                                <div className="predicted-right-col">
                                    <div className="fintech-card chart-panel-card">
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

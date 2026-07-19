import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StockChart from '../components/StockChart';
import Recommendation from '../components/Recommendation';
import ReturnCalculator from '../components/ReturnCalculator';
import Navbar from '../components/Navbar';
import { analyzeStock, fetchStock, getStock } from '../services/api';

const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'technical', label: 'Technical Analysis' },
    { key: 'fundamental', label: 'Fundamental Analysis' },
    { key: 'predicted', label: 'Predicted Direction' },
];

function Analysis() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [symbol, setSymbol] = useState(searchParams.get('symbol') || '');
    const [stockData, setStockData] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

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
            setActiveTab('overview');
        } catch (err) {
            setError(err.response?.data?.error || 'Stock not found. Please check the symbol.');
            setAnalysis(null);
            setStockData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSearch = useCallback(() => {
        const input = (symbol || '').trim();
        if (!input) return;
        setSearchParams({ symbol: input });
    }, [symbol, setSearchParams]);

    useEffect(() => {
        const input = searchParams.get('symbol')?.trim();
        if (input) {
            setSymbol(input);
            loadStockData(input);
        } else {
            // Load a sensible default so the analysis page isn't empty
            const defaultSymbol = 'RELIANCE';
            setSymbol(defaultSymbol);
            loadStockData(defaultSymbol);
        }
    }, [loadStockData, searchParams]);

    const formatCurrency = (value) => {
        if (value == null || Number.isNaN(value)) return '—';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
            notation: 'compact',
        }).format(value);
    };

    const computeMonthOnMonth = (history = []) => {
        if (!history || history.length === 0) return [];
        // group by YYYY-MM and take last close of each month
        const map = {};
        for (const h of history) {
            const key = h.date.slice(0,7); // YYYY-MM
            // keep the latest date in that month
            if (!map[key] || new Date(map[key].date) < new Date(h.date)) map[key] = h;
        }
        const months = Object.keys(map).sort();
        const results = [];
        for (let i=1;i<months.length;i++){
            const prev = map[months[i-1]];
            const cur = map[months[i]];
            const pct = prev && prev.close_price ? ((cur.close_price / prev.close_price -1) * 100) : 0;
            results.push({ month: months[i], pct: Number(pct.toFixed(2)), close: cur.close_price });
        }
        return results.slice(-12); // last 12 months
    };

    const formatNumber = (value, decimals = 2) => {
        if (value == null || Number.isNaN(value)) return '—';
        return new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: decimals,
        }).format(value);
    };

    const formatPercent = (value) => {
        if (value == null || Number.isNaN(value)) return '—';
        return `${(Number(value) * 100).toFixed(2)}%`;
    };

    const formatRatio = (value) => {
        if (value == null || Number.isNaN(value)) return '—';
        return Number(value).toFixed(2);
    };

    const num = (v) => (v == null ? 0 : Number(v));

    return (
        <div className="app-shell">
            <Navbar />
            <div className="dashboard-page analysis-page">
                <section className="hero-card">
                    <div className="hero-copy">
                        <p className="eyebrow">Axiomity • analysis workspace</p>
                        <h1>Detailed stock analysis</h1>
                        <p>Review the current signal, technical indicators, and a fundamental snapshot for any ticker in one dedicated workspace.</p>
                    </div>
                    <div className="search-card">
                        <input
                            type="text"
                            placeholder="Enter a symbol like AAPL or RELIANCE"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <button onClick={() => handleSearch()} disabled={loading}>
                            {loading ? 'Analyzing…' : 'Analyze'}
                        </button>
                    </div>
                </section>

                {error && <div className="status error">{error}</div>}

                {!analysis && !loading && (
                    <section className="analysis-card empty-state-card">
                        <p className="eyebrow">Start here</p>
                        <h2>Search for a stock to open its analysis workspace.</h2>
                        <p className="muted">The overview, technical, and fundamental tabs will appear here once a symbol is loaded.</p>
                        <Link className="secondary-button" to="/">Back to dashboard</Link>
                    </section>
                )}

                {analysis && (
                    <section className="analysis-card">
                        <div className="card-header" style={{ marginBottom: '24px' }}>
                            <div>
                                <p className="eyebrow">Signal review</p>
                                <h2>{analysis.name} <span>({analysis.script_code || analysis.symbol})</span></h2>
                                <div style={{ color: '#64748b', marginTop: 6, fontSize: '0.9rem', fontWeight: 500 }}>
                                    {analysis.fundamentals?.pb ? `P/B Ratio: ${formatRatio(analysis.fundamentals.pb)}` : ''}
                                    {analysis.fundamentals?.pe ? ` · P/E Ratio: ${formatRatio(analysis.fundamentals.pe)}` : ''}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                                <div className="price-pill" style={{ fontSize: '1.25rem', padding: '10px 18px', margin: 0 }}>
                                    {formatCurrency(analysis.current_price)}
                                </div>
                            </div>
                        </div>

                        <div className="analysis-tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={`tab-button${activeTab === tab.key ? ' active' : ''}`}
                                    onClick={() => setActiveTab(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {activeTab === 'overview' && (
                            <div className="tab-panel">
                                <div className="results-grid">
                                    <div className="analysis-card inner-card">
                                        <Recommendation data={analysis} />
                                        <div style={{ marginTop: 12 }}>
                                            <ReturnCalculator history={stockData?.history || []} currentPrice={analysis?.current_price} />
                                        </div>
                                    </div>
                                    <div className="analysis-card inner-card chart-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        {stockData ? <StockChart data={stockData} /> : <p className="muted">Chart data will appear once the stock history is loaded.</p>}

                                        {/* Volatility & Range Analytics Card */}
                                        {analysis.fundamentals && (
                                            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px' }}>
                                                <p className="eyebrow" style={{ marginBottom: '14px' }}>Volatility & Market Range</p>
                                                
                                                {/* 52-Week Range Position */}
                                                {analysis.fundamentals.fifty_two_week_low != null && analysis.fundamentals.fifty_two_week_high != null && (() => {
                                                    const low = num(analysis.fundamentals.fifty_two_week_low);
                                                    const high = num(analysis.fundamentals.fifty_two_week_high);
                                                    const current = num(analysis.current_price);
                                                    const rangePct = (high - low) > 0 ? ((current - low) / (high - low)) * 100 : 50;
                                                    return (
                                                        <div style={{ marginBottom: '22px' }}>
                                                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>52-WEEK RANGE POSITION</span>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#344054', fontWeight: 600, marginBottom: '8px' }}>
                                                                <span>₹{formatNumber(low)}</span>
                                                                <span style={{ color: '#2357d8' }}>Current: ₹{formatNumber(current)}</span>
                                                                <span>₹{formatNumber(high)}</span>
                                                            </div>
                                                            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '999px', position: 'relative' }}>
                                                                <div style={{ position: 'absolute', top: '-3px', left: `${Math.min(100, Math.max(0, rangePct))}%`, width: '12px', height: '12px', background: '#2357d8', borderRadius: '50%', transform: 'translateX(-50%)', border: '2px solid #ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* MA Cross and Beta Risk metrics */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px' }}>
                                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>BETA RISK MATRIX</span>
                                                        <strong style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                                                            {analysis.fundamentals.beta != null ? (() => {
                                                                const beta = num(analysis.fundamentals.beta);
                                                                const label = beta < 0.95 ? 'Low Beta' : beta <= 1.15 ? 'Market Beta' : 'High Beta';
                                                                const color = beta < 0.95 ? '#15803d' : beta <= 1.15 ? '#b45309' : '#dc2626';
                                                                return <span style={{ color }}>{beta.toFixed(2)} ({label})</span>;
                                                            })() : '—'}
                                                        </strong>
                                                    </div>
                                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>MA TREND BIAS</span>
                                                        <strong style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                                                            {analysis.fundamentals.fifty_day_ma != null && analysis.fundamentals.two_hundred_day_ma != null ? (() => {
                                                                const fma = num(analysis.fundamentals.fifty_day_ma);
                                                                const thma = num(analysis.fundamentals.two_hundred_day_ma);
                                                                const bullish = fma > thma;
                                                                return bullish ? (
                                                                    <span style={{ color: '#15803d' }}>Golden Cross</span>
                                                                ) : (
                                                                    <span style={{ color: '#dc2626' }}>Death Cross</span>
                                                                );
                                                            })() : '—'}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'predicted' && (
                            <div className="tab-panel">
                                <div className="results-grid">
                                    <div className="analysis-card inner-card">
                                        <p className="eyebrow">Trend Forecasting</p>
                                        <h3>AI Prediction Model</h3>
                                        {analysis ? (
                                            <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
                                                <div className="metric-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                                    <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Forecast Direction</span>
                                                    <strong className={analysis.prediction?.direction === 'Up' ? 'positive' : 'negative'} style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                                                        {analysis.prediction?.direction === 'Up' ? 'Bullish (UP)' : 'Bearish (DOWN)'}
                                                    </strong>
                                                </div>
                                                <div className="metric-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                                    <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Trend Slope (Daily Delta)</span>
                                                    <strong style={{ color: '#0f172a', fontSize: '1.05rem', fontWeight: 700 }}>
                                                        {analysis.prediction?.slope != null ? (analysis.prediction.slope >= 0 ? '+' : '') + formatRatio(analysis.prediction.slope, 4) : '—'}
                                                    </strong>
                                                </div>
                                                <div className="metric-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                                    <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Model R² (Stability Index)</span>
                                                    <strong style={{ color: '#0f172a', fontSize: '1.05rem', fontWeight: 700 }}>
                                                        {analysis.prediction?.r_squared != null ? formatRatio(analysis.prediction.r_squared, 4) : '—'}
                                                    </strong>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="muted">Load a stock to view predictions.</p>
                                        )}
                                    </div>
                                    <div className="analysis-card inner-card chart-card">
                                        {stockData ? (
                                            <StockChart data={{ history: stockData.history || [], prediction: (analysis && analysis.prediction) ? analysis.prediction.predicted : [] }} />
                                        ) : (
                                            <p className="muted">Chart data will appear once the stock history is loaded.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'technical' && (
                            <div className="tab-panel">
                                <div className="tab-grid">
                                    <div className="metric-card">
                                        <p className="eyebrow">Technical Summary</p>
                                        <h3>Trend & Momentum Analysis</h3>
                                        <div className="technical-grade-box">
                                            <div className={`rec-badge ${analysis.recommendation?.toLowerCase()}`}>
                                                {analysis.recommendation?.toUpperCase()}
                                            </div>
                                            <div className="confidence-wrapper">
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475467' }}>Confidence: {analysis.confidence}%</span>
                                                <div className="progress-bar-bg">
                                                    <div className="progress-bar-fill" style={{ width: `${analysis.confidence}%` }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="metric-list" style={{ marginTop: '16px' }}>
                                            <div>
                                                <span>RSI (14)</span>
                                                <strong className={analysis.rsi < 30 ? "positive" : analysis.rsi > 70 ? "negative" : "muted"}>
                                                    {analysis.rsi} ({analysis.rsi < 30 ? "Oversold" : analysis.rsi > 70 ? "Overbought" : "Neutral"})
                                                </strong>
                                            </div>
                                            <div>
                                                <span>MACD (12, 26)</span>
                                                <strong className={analysis.macd > 0 ? "positive" : "negative"}>
                                                    {analysis.macd} ({analysis.macd > 0 ? "Bullish" : "Bearish"})
                                                </strong>
                                            </div>
                                            <div>
                                                <span>MA20 Trend</span>
                                                <strong className={analysis.current_price > analysis.ma20 ? "positive" : "negative"}>
                                                    {formatCurrency(analysis.ma20)} ({analysis.current_price > analysis.ma20 ? "Price > MA20" : "Price < MA20"})
                                                </strong>
                                            </div>
                                            <div>
                                                <span>MA50 Trend</span>
                                                <strong className={analysis.current_price > analysis.ma50 ? "positive" : "negative"}>
                                                    {formatCurrency(analysis.ma50)} ({analysis.current_price > analysis.ma50 ? "Price > MA50" : "Price < MA50"})
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="metric-card">
                                        <p className="eyebrow">Interpretations</p>
                                        <h3>Indicator Details</h3>
                                        <div style={{ display: 'grid', gap: '14px', marginTop: '16px' }}>
                                            <p className="muted" style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                                                <strong>RSI:</strong> Evaluates overbought (&gt;70) or oversold (&lt;30) zones. Oversold status indicates positive value buying setups, whereas overbought readings warn of a potential pullback.
                                            </p>
                                            <p className="muted" style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                                                <strong>MACD:</strong> Tracks trend direction and strength. Values above 0 support long-term bullish trend persistence, whereas values below 0 imply bearish momentum.
                                            </p>
                                            <p className="muted" style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                                                <strong>MA20 & MA50:</strong> Serves as key support/resistance boundaries. Trading above moving averages validates an upward structural trend.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'fundamental' && (
                            <div className="tab-panel">
                                <div className="tab-grid">
                                    <div className="metric-card">
                                        <p className="eyebrow">Valuation & Leverage</p>
                                        <h3>Ratios & Balance Sheet</h3>
                                        <ul className="info-list" style={{ marginTop: '16px' }}>
                                            <li><span>P/E Ratio</span><strong>{formatRatio(analysis.fundamentals?.pe)}</strong></li>
                                            <li><span>P/B Ratio</span><strong>{formatRatio(analysis.fundamentals?.pb)}</strong></li>
                                            <li><span>Debt to Equity (D/E)</span><strong>{formatRatio(analysis.fundamentals?.debt_to_equity)}</strong></li>
                                            <li><span>Dividend Yield</span><strong>{formatPercent(analysis.fundamentals?.dividend_yield)}</strong></li>
                                        </ul>
                                    </div>
                                    <div className="metric-card">
                                        <p className="eyebrow">Profitability & Operations</p>
                                        <h3>Earnings & Margins</h3>
                                        <ul className="info-list" style={{ marginTop: '16px' }}>
                                            <li><span>Return on Equity (ROE)</span><strong>{formatPercent(analysis.fundamentals?.roe)}</strong></li>
                                            <li><span>Earnings Per Share (EPS)</span><strong>{formatNumber(analysis.fundamentals?.eps, 2)}</strong></li>
                                            <li><span>Total Revenue (Sales)</span><strong>{formatCurrency(analysis.fundamentals?.sales)}</strong></li>
                                            <li><span>Operating Profit</span><strong>{formatCurrency(analysis.fundamentals?.operating_profit)}</strong></li>
                                            <li><span>Net Income</span><strong>{formatCurrency(analysis.fundamentals?.net_profit)}</strong></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'overview' && analysis && (
                            <div className="tab-panel">
                                <div className="tab-grid">
                                    <div className="metric-card">
                                        <p className="eyebrow">Month-on-Month</p>
                                        <h3>Last 12 months growth</h3>
                                        {stockData && stockData.history && stockData.history.length ? (
                                            (() => {
                                                const mom = computeMonthOnMonth(stockData.history);
                                                return (
                                                    <ul className="info-list">
                                                        {mom.map((m) => (
                                                            <li key={m.month}><span>{m.month}</span><strong className={m.pct>=0 ? 'positive' : 'negative'}>{m.pct}%</strong></li>
                                                        ))}
                                                    </ul>
                                                );
                                            })()
                                        ) : (
                                            <p className="muted">Not enough history to compute month-on-month growth.</p>
                                        )}
                                    </div>
                                    <div className="metric-card">
                                        <p className="eyebrow">Quick returns</p>
                                        <h3>Snapshot</h3>
                                        <div style={{ display: 'grid', gap: 8 }}>
                                            <div><strong>Current:</strong> {analysis ? formatCurrency(analysis.current_price) : '—'}</div>
                                            <div><strong>Recommendation:</strong> {analysis ? analysis.recommendation : '—'}</div>
                                            <div><strong>Confidence:</strong> {analysis ? `${analysis.confidence}%` : '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}

export default Analysis;

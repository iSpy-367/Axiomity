import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { getPortfolio, deletePortfolioItem, addPortfolioItem, searchStocks } from '../services/api';

const ALLOC_COLORS = [
    '#2563eb', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#f97316', '#64748b'
];

function Portfolio() {
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [scriptSymbol, setScriptSymbol] = useState('');
    const [scriptQty, setScriptQty] = useState(1);
    const [scriptBuyPrice, setScriptBuyPrice] = useState('');
    const [filterQuery, setFilterQuery] = useState('');
    const [expandedItemId, setExpandedItemId] = useState(null);

    // Typeahead state for Quick Entry
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const symbolInputRef = useRef(null);

    const totalInvested = portfolio.reduce((sum, item) => sum + (item.buy_price || 0) * item.quantity, 0);
    const totalCurrent = portfolio.reduce((sum, item) => sum + (item.current_price || 0) * item.quantity, 0);
    const totalGrossPnl = totalCurrent - totalInvested;
    const totalBrokerage = portfolio.reduce((sum, item) => {
        if (item.brokerage_cost != null) return sum + Number(item.brokerage_cost);
        const buyVal = (item.buy_price || 0) * item.quantity;
        const currVal = (item.current_price || item.buy_price || 0) * item.quantity;
        return sum + 0.003 * (buyVal + currVal);
    }, 0);
    const totalNetPnl = totalGrossPnl - totalBrokerage;
    const totalNetPnlPercent = totalInvested ? (totalNetPnl / totalInvested) * 100 : 0;

    const totalDayChange = portfolio.reduce((sum, item) => {
        const qty = item.quantity || 0;
        const price = item.current_price || 0;
        const changePct = item.daily_change_percent || 0;
        const value = price * qty;
        const changeAmount = value * (changePct / (100 + changePct));
        return sum + (Number.isNaN(changeAmount) ? 0 : changeAmount);
    }, 0);

    const totalPrevCurrent = totalCurrent - totalDayChange;
    const totalDayChangePercent = totalPrevCurrent > 0 ? (totalDayChange / totalPrevCurrent) * 100 : 0;

    const filteredPortfolio = portfolio.filter(item =>
        item.symbol.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (item.display_name && item.display_name.toLowerCase().includes(filterQuery.toLowerCase()))
    );

    const loadPortfolio = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await getPortfolio();
            setPortfolio(response.data || []);
        } catch (err) {
            setError('Unable to load portfolio data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPortfolio();
    }, []);

    // Debounced typeahead search for Quick Entry
    useEffect(() => {
        const q = scriptSymbol.trim();
        if (q.length < 2) {
            setSuggestions([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await searchStocks(q);
                if (res.data?.results) {
                    setSuggestions(res.data.results.slice(0, 5));
                    setShowSuggestions(true);
                }
            } catch {
                setSuggestions([]);
            }
        }, 220);

        return () => clearTimeout(timer);
    }, [scriptSymbol]);

    const handleDelete = async (id) => {
        setMessage('');
        try {
            await deletePortfolioItem(id);
            setMessage('Position removed successfully.');
            await loadPortfolio();
        } catch {
            setError('Unable to remove this position right now.');
        }
    };

    const handleSelectSuggestion = (item) => {
        setScriptSymbol(item.symbol);
        setShowSuggestions(false);
    };

    const formatCurrency = (value) => {
        if (value == null || Number.isNaN(value)) return '—';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(value);
    };

    return (
        <div className="app-shell">
            <Navbar />
            <div className="portfolio-page-container">

                {/* Header Strip */}
                <div className="portfolio-header-strip">
                    <div>
                        <span className="fintech-eyebrow">EQUITY HOLDINGS</span>
                        <h1>Portfolio & Capital Allocation</h1>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="market-sync-tag">
                            {portfolio.length} {portfolio.length === 1 ? 'Position' : 'Positions'} Active
                        </span>
                    </div>
                </div>

                {message && <div className="status success" style={{ marginBottom: '20px' }}>{message}</div>}
                {error && <div className="status error" style={{ marginBottom: '20px' }}>{error}</div>}

                {/* 4 Summary Stat Cards Grid */}
                <section className="portfolio-stats-grid">
                    {/* Invested */}
                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Total Invested</span>
                        <div className="stat-card-value">{formatCurrency(totalInvested)}</div>
                        <div className="stat-card-delta-row" style={{ color: '#64748b' }}>
                            Base capital deployed
                        </div>
                    </div>

                    {/* Current Value */}
                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Current Value</span>
                        <div className="stat-card-value">{formatCurrency(totalCurrent)}</div>
                        <div className="stat-card-delta-row" style={{ color: '#64748b' }}>
                            Market evaluation
                        </div>
                    </div>

                    {/* Net P&L (After Brokerage) */}
                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Net P&L</span>
                        <div className="stat-card-value" style={{ color: totalNetPnl >= 0 ? 'var(--emerald-green-text)' : 'var(--crimson-red-text)' }}>
                            {totalNetPnl >= 0 ? '+' : ''}{formatCurrency(totalNetPnl)}
                        </div>
                        <div className="stat-card-delta-row">
                            <span className={`mover-pct-badge ${totalNetPnl >= 0 ? 'positive' : 'negative'}`} style={{ padding: '2px 8px', fontSize: '0.78rem' }}>
                                {totalNetPnl >= 0 ? '+' : ''}{totalNetPnlPercent.toFixed(2)}%
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                Gross: {formatCurrency(totalGrossPnl)} · Chgs: -{formatCurrency(totalBrokerage)}
                            </span>
                        </div>
                    </div>

                    {/* Day's P&L */}
                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Day's Profit / Loss</span>
                        <div className="stat-card-value" style={{ color: totalDayChange >= 0 ? 'var(--emerald-green-text)' : 'var(--crimson-red-text)' }}>
                            {totalDayChange >= 0 ? '+' : ''}{formatCurrency(totalDayChange)}
                        </div>
                        <div className="stat-card-delta-row">
                            <span className={`mover-pct-badge ${totalDayChange >= 0 ? 'positive' : 'negative'}`} style={{ padding: '2px 8px', fontSize: '0.78rem' }}>
                                {totalDayChange >= 0 ? '+' : ''}{totalDayChangePercent.toFixed(2)}%
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Today's movement</span>
                        </div>
                    </div>
                </section>

                {/* Main Content Layout Grid */}
                <div className="portfolio-layout-grid">

                    {/* Left Column: Holdings & Empty State */}
                    <div>
                        <div className="portfolio-holdings-card">
                            <div className="holdings-head-toolbar">
                                <div>
                                    <span className="fintech-eyebrow">ACTIVE ASSETS</span>
                                    <h2 style={{ margin: '2px 0 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        Holdings Book
                                    </h2>
                                </div>

                                <div className="holding-search-box">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input
                                        type="text"
                                        placeholder="Filter holdings..."
                                        value={filterQuery}
                                        onChange={(e) => setFilterQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {loading ? (
                                <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    Loading your portfolio positions…
                                </div>
                            ) : portfolio.length === 0 ? (
                                /* Intentional Fintech Empty State */
                                <div className="empty-state-fintech">
                                    <div className="empty-icon-circle">💼</div>
                                    <h3>No Open Positions Yet</h3>
                                    <p>
                                        Your portfolio is currently empty. Add your first stock position using the Quick Position Entry form to track real-time P&L and technical analytics.
                                    </p>
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={() => symbolInputRef.current?.focus()}
                                        style={{ padding: '10px 22px', fontSize: '0.85rem', fontWeight: 800, borderRadius: '8px' }}
                                    >
                                        + Add First Position
                                    </button>
                                </div>
                            ) : filteredPortfolio.length === 0 ? (
                                <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No holdings match "{filterQuery}".
                                </div>
                            ) : (
                                <div className="holdings-list-shell">
                                    {filteredPortfolio.map((item) => {
                                        const invested = (item.buy_price || 0) * item.quantity;
                                        const currentValue = (item.current_price || 0) * item.quantity;
                                        const grossPnl = item.gross_pnl != null ? Number(item.gross_pnl) : (currentValue - invested);
                                        const brokerage = item.brokerage_cost != null ? Number(item.brokerage_cost) : (0.003 * (invested + currentValue));
                                        const netPnl = item.net_pnl != null ? Number(item.net_pnl) : (grossPnl - brokerage);
                                        const netPnlPercent = invested ? (netPnl / invested) * 100 : 0;
                                        const isExpanded = expandedItemId === item.id;
                                        return (
                                            <div key={item.id} className="holding-card-item">
                                                {/* Summary Row */}
                                                <div
                                                    className="holding-summary-head"
                                                    onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                                    title="Click to view details & actions"
                                                >
                                                    <div className="holding-left-col">
                                                        <div className="holding-sym-row">
                                                            <span className="holding-sym-title">{item.symbol}</span>
                                                            <span className="typeahead-badge nse">{item.exchange || 'NSE'}</span>
                                                        </div>
                                                        <div className="holding-qty-sub">
                                                            Qty: <strong>{item.quantity}</strong> · Avg: <strong>{formatCurrency(item.buy_price)}</strong> · Invested: <strong>{formatCurrency(invested)}</strong>
                                                        </div>
                                                    </div>

                                                    <div className="holding-right-col">
                                                        <div className="holding-pnl-block">
                                                            <span className={`holding-pnl-num ${netPnl >= 0 ? 'up' : 'down'}`}>
                                                                {netPnl >= 0 ? '+' : ''}{formatCurrency(netPnl)}
                                                            </span>
                                                            <span className="holding-ltp-sub">
                                                                LTP: {formatCurrency(item.current_price)}
                                                            </span>
                                                        </div>
                                                        <div className={`mover-pct-badge ${netPnl >= 0 ? 'positive' : 'negative'}`}>
                                                            {netPnlPercent >= 0 ? '+' : ''}{netPnlPercent.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded Details & Actions Panel */}
                                                {isExpanded && (
                                                    <div className="holding-expanded-actions">
                                                        <div className="holding-expanded-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                {item.display_name || item.name || item.symbol}
                                                            </div>
                                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                                <span>Current Value: <strong>{formatCurrency(currentValue)}</strong></span>
                                                                <span>Gross P&L: <strong style={{ color: grossPnl >= 0 ? 'var(--emerald-green-text)' : 'var(--crimson-red-text)' }}>{grossPnl >= 0 ? '+' : ''}{formatCurrency(grossPnl)}</strong></span>
                                                                <span>Brokerage (0.30%): <strong style={{ color: 'var(--crimson-red-text)' }}>-{formatCurrency(brokerage)}</strong></span>
                                                                <span>Net P&L: <strong style={{ color: netPnl >= 0 ? 'var(--emerald-green-text)' : 'var(--crimson-red-text)' }}>{netPnl >= 0 ? '+' : ''}{formatCurrency(netPnl)}</strong></span>
                                                            </div>
                                                        </div>
                                                        <div className="holding-expanded-btns">
                                                            <Link
                                                                to={`/analysis?symbol=${item.symbol}`}
                                                                className="btn-analyze-holding"
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <line x1="18" y1="20" x2="18" y2="10"></line>
                                                                    <line x1="12" y1="20" x2="12" y2="4"></line>
                                                                    <line x1="6" y1="20" x2="6" y2="14"></line>
                                                                </svg>
                                                                Analyze Stock
                                                            </Link>
                                                            <button
                                                                type="button"
                                                                className="btn-delete-holding"
                                                                onClick={() => handleDelete(item.id)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Portfolio Allocation Visualizer Card */}
                        {portfolio.length > 0 && totalCurrent > 0 && (
                            <div className="portfolio-allocation-card">
                                <span className="fintech-eyebrow">CAPITAL DIVERSIFICATION</span>
                                <h3 style={{ margin: '2px 0 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                    Portfolio Allocation Breakdown
                                </h3>

                                <div className="allocation-bar-segmented">
                                    {portfolio.map((item, idx) => {
                                        const val = (item.current_price || 0) * item.quantity;
                                        const pct = totalCurrent ? (val / totalCurrent) * 100 : 0;
                                        const color = ALLOC_COLORS[idx % ALLOC_COLORS.length];
                                        return (
                                            <div
                                                key={item.id}
                                                className="allocation-seg-item"
                                                style={{ width: `${pct}%`, background: color }}
                                                title={`${item.symbol}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                                            />
                                        );
                                    })}
                                </div>

                                <div className="allocation-legend-grid">
                                    {portfolio.map((item, idx) => {
                                        const val = (item.current_price || 0) * item.quantity;
                                        const pct = totalCurrent ? (val / totalCurrent) * 100 : 0;
                                        const color = ALLOC_COLORS[idx % ALLOC_COLORS.length];
                                        return (
                                            <div key={item.id} className="alloc-legend-chip">
                                                <span className="alloc-color-dot" style={{ background: color }} />
                                                <span><strong>{item.symbol}</strong> ({pct.toFixed(1)}%)</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Quick Position Entry Form */}
                    <div className="quick-entry-card">
                        <span className="fintech-eyebrow">ORDER DESK</span>
                        <h2 style={{ margin: '2px 0 16px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                            Quick Position Entry
                        </h2>

                        <div style={{ display: 'grid', gap: '16px' }}>
                            {/* Symbol with Autocomplete Dropdown */}
                            <div style={{ position: 'relative' }}>
                                <label className="fintech-input-label">Script Symbol</label>
                                <input
                                    ref={symbolInputRef}
                                    type="text"
                                    placeholder="e.g. RELIANCE, TCS, VBL, LTM"
                                    value={scriptSymbol}
                                    onChange={(e) => setScriptSymbol(e.target.value.toUpperCase())}
                                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                                    className="fintech-form-input"
                                    style={{ fontFamily: 'JetBrains Mono, monospace' }}
                                />

                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="typeahead-dropdown" style={{ top: '100%', left: 0, right: 0 }}>
                                        {suggestions.map((item) => (
                                            <div
                                                key={item.symbol}
                                                className="typeahead-item"
                                                onClick={() => handleSelectSuggestion(item)}
                                            >
                                                <div className="typeahead-sym-row">
                                                    <span className="typeahead-sym">{item.symbol}</span>
                                                    <span className={`typeahead-badge ${item.is_nse ? 'nse' : 'bse'}`}>
                                                        {item.exchange}
                                                    </span>
                                                </div>
                                                <div className="typeahead-name">{item.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quantity and Buy Price Inputs */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                                <div>
                                    <label className="fintech-input-label">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={scriptQty}
                                        onChange={(e) => setScriptQty(Number(e.target.value))}
                                        className="fintech-form-input"
                                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                                    />
                                </div>
                                <div>
                                    <label className="fintech-input-label">Buy Price (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={scriptBuyPrice}
                                        onChange={(e) => setScriptBuyPrice(e.target.value)}
                                        className="fintech-form-input"
                                        style={{ fontFamily: 'JetBrains Mono, monospace' }}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="button"
                                className="btn-add-position"
                                onClick={async () => {
                                    setMessage('');
                                    setError('');
                                    if (!scriptSymbol.trim() || !scriptQty || !scriptBuyPrice) {
                                        setError('Symbol, quantity and buy price are required.');
                                        return;
                                    }
                                    try {
                                        await addPortfolioItem({
                                            symbol: scriptSymbol.trim().toUpperCase(),
                                            quantity: Number(scriptQty),
                                            buy_price: Number(scriptBuyPrice),
                                        });
                                        setMessage(`${scriptSymbol.trim().toUpperCase()} successfully added to your holdings.`);
                                        setScriptSymbol('');
                                        setScriptQty(1);
                                        setScriptBuyPrice('');
                                        await loadPortfolio();
                                    } catch (err) {
                                        setError(err.response?.data?.symbol || err.response?.data?.detail || 'Unable to add this script.');
                                    }
                                }}
                            >
                                + Add Position
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default Portfolio;


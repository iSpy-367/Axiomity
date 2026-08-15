import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
    getPortfolio,
    deletePortfolioItem,
    addPortfolioItem,
    exitPortfolioItem,
    updatePortfolioItem,
    searchStocks
} from '../services/api';

const BUY_BROKERAGE_RATE = 0.0015;   // 0.15% buying brokerage rate on buy turnover
const SELL_BROKERAGE_RATE = 0.0015;  // 0.15% selling brokerage rate on LTP / exit turnover

const ALLOC_COLORS = [
    '#2563eb', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#f97316', '#64748b'
];

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const formatDateDisplay = (dateStr) => {
    if (!dateStr) return null;
    try {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return dateStr;
    }
};

const calcItemBrokerage = (buyPrice, currentOrExitPrice, qty) => {
    const buyVal = (buyPrice || 0) * qty;
    const sellVal = (currentOrExitPrice || buyPrice || 0) * qty;
    const buyChg = BUY_BROKERAGE_RATE * buyVal;
    const sellChg = SELL_BROKERAGE_RATE * sellVal;
    return {
        buyChg,
        sellChg,
        total: buyChg + sellChg
    };
};

function Portfolio() {
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [scriptSymbol, setScriptSymbol] = useState('');
    const [scriptQty, setScriptQty] = useState(1);
    const [scriptBuyPrice, setScriptBuyPrice] = useState('');
    const [buyDate, setBuyDate] = useState(getTodayDateStr());
    const [filterQuery, setFilterQuery] = useState('');
    const [expandedItemId, setExpandedItemId] = useState(null);
    const [activeHoldingsTab, setActiveHoldingsTab] = useState('active'); // 'active' | 'exited'

    // Manual Edit State
    const [editingItemId, setEditingItemId] = useState(null);
    const [editForm, setEditForm] = useState({
        quantity: 1,
        buy_price: '',
        buy_date: '',
        sell_date: '',
        exit_price: ''
    });

    // Typeahead state for Quick Entry
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const symbolInputRef = useRef(null);

    // Split active vs exited positions
    const activePositions = portfolio.filter(item => item.status !== 'exited');
    const exitedPositions = portfolio.filter(item => item.status === 'exited');

    // 1. Active Portfolio Calculations
    const totalInvested = activePositions.reduce((sum, item) => sum + (item.buy_price || 0) * item.quantity, 0);
    const totalCurrent = activePositions.reduce((sum, item) => sum + (item.current_price || 0) * item.quantity, 0);
    const totalActiveGrossPnl = totalCurrent - totalInvested;
    const totalActiveBrokerage = activePositions.reduce((sum, item) => {
        if (item.brokerage_cost != null) return sum + Number(item.brokerage_cost);
        return sum + calcItemBrokerage(item.buy_price, item.current_price, item.quantity).total;
    }, 0);
    const totalActiveNetPnl = totalActiveGrossPnl - totalActiveBrokerage;
    const totalActiveNetPnlPercent = totalInvested > 0 ? (totalActiveNetPnl / totalInvested) * 100 : 0;

    // 2. Exited Positions Realized Calculations
    const totalExitedRealizedNetPnl = exitedPositions.reduce((sum, item) => {
        if (item.realized_net_pnl != null) return sum + Number(item.realized_net_pnl);
        if (item.net_pnl != null) return sum + Number(item.net_pnl);
        const inv = (item.buy_price || 0) * item.quantity;
        const exitVal = (item.exit_price || item.buy_price || 0) * item.quantity;
        const gross = exitVal - inv;
        const brokerage = calcItemBrokerage(item.buy_price, item.exit_price, item.quantity).total;
        return sum + (gross - brokerage);
    }, 0);


    // 3. Absolute P&L = Sum(Exited Realized P&L) + Sum(Active Unrealized P&L)
    const absolutePnl = totalActiveNetPnl + totalExitedRealizedNetPnl;

    // 4. Day's Profit / Loss
    const totalDayChange = activePositions.reduce((sum, item) => {
        const qty = item.quantity || 0;
        const price = item.current_price || 0;
        const changePct = item.daily_change_percent || 0;
        const value = price * qty;
        const changeAmount = value * (changePct / (100 + changePct));
        return sum + (Number.isNaN(changeAmount) ? 0 : changeAmount);
    }, 0);

    const totalPrevCurrent = totalCurrent - totalDayChange;
    const totalDayChangePercent = totalPrevCurrent > 0 ? (totalDayChange / totalPrevCurrent) * 100 : 0;

    // Filter positions based on activeHoldingsTab ('active' vs 'exited') and filterQuery
    const displayedPositions = (activeHoldingsTab === 'active' ? activePositions : exitedPositions).filter(item =>
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
        setError('');
        try {
            await deletePortfolioItem(id);
            setMessage('Position removed successfully.');
            await loadPortfolio();
        } catch (err) {
            setError('Unable to delete position.');
        }
    };

    const handleExit = async (id) => {
        setMessage('');
        setError('');
        try {
            await exitPortfolioItem(id);
            setMessage('Position exited and realized P&L locked successfully.');
            await loadPortfolio();
        } catch (err) {
            setError(err.response?.data?.detail || 'Unable to exit position.');
        }
    };

    const handleStartEdit = (item) => {
        setEditingItemId(item.id);
        setEditForm({
            quantity: item.quantity,
            buy_price: item.buy_price,
            buy_date: item.buy_date || getTodayDateStr(),
            sell_date: item.sell_date || '',
            exit_price: item.exit_price || ''
        });
    };

    const handleSaveEdit = async (id) => {
        setMessage('');
        setError('');
        try {
            const payload = {
                quantity: Number(editForm.quantity),
                buy_price: Number(editForm.buy_price),
                buy_date: editForm.buy_date || null
            };
            if (editForm.sell_date) {
                payload.sell_date = editForm.sell_date;
            }
            if (editForm.exit_price) {
                payload.exit_price = Number(editForm.exit_price);
            }
            await updatePortfolioItem(id, payload);
            setMessage('Position updated successfully.');
            setEditingItemId(null);
            await loadPortfolio();
        } catch (err) {
            setError(err.response?.data?.detail || 'Unable to update position.');
        }
    };

    const handleSelectSuggestion = (item) => {
        setScriptSymbol(item.symbol);
        if (item.current_price) {
            setScriptBuyPrice(item.current_price.toString());
        }
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const formatCurrency = (val) => {
        const n = Number(val || 0);
        return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="app-shell">
            <Navbar />
            <div className="portfolio-page">

                {/* Hero Title Bar */}
                <section className="hero-card portfolio-hero-card">
                    <div className="hero-copy">
                        <p className="eyebrow">PORTFOLIO MANAGEMENT • LIVE POSITIONS</p>
                        <h1>Your Holdings Desk</h1>
                        <p>Track real-time market value, capital allocation, active P&L, realized performance, and absolute P&L.</p>
                    </div>
                </section>

                {message && <div className="status success" style={{ marginBottom: '16px' }}>{message}</div>}
                {error && <div className="status error" style={{ marginBottom: '16px' }}>{error}</div>}

                {/* Portfolio Summary KPI Cards Grid */}
                <section className="portfolio-stats-grid">
                    {/* Invested Capital */}
                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Invested Capital</span>
                        <div className="stat-card-value">{formatCurrency(totalInvested)}</div>
                        <div className="stat-card-delta-row" style={{ color: 'var(--text-muted)' }}>
                            {activePositions.length} active position(s)
                        </div>
                    </div>

                    {/* Current Portfolio Value */}
                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Current Value</span>
                        <div className="stat-card-value">{formatCurrency(totalCurrent)}</div>
                        <div className="stat-card-delta-row">
                            <span className={`mover-pct-badge ${totalActiveGrossPnl >= 0 ? 'positive' : 'negative'}`} style={{ padding: '2px 8px', fontSize: '0.78rem' }}>
                                {totalActiveGrossPnl >= 0 ? '+' : ''}{totalInvested > 0 ? ((totalActiveGrossPnl / totalInvested) * 100).toFixed(2) : '0.00'}% Gross
                            </span>
                        </div>
                    </div>

                    {/* Active Net P&L (Unrealized) */}
                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Active Net P&L</span>
                        <div className="stat-card-value" style={{ color: totalActiveNetPnl >= 0 ? 'var(--emerald-green-text)' : 'var(--crimson-red-text)' }}>
                            {totalActiveNetPnl >= 0 ? '+' : ''}{formatCurrency(totalActiveNetPnl)}
                        </div>
                        <div className="stat-card-delta-row">
                            <span className={`mover-pct-badge ${totalActiveNetPnl >= 0 ? 'positive' : 'negative'}`} style={{ padding: '2px 8px', fontSize: '0.78rem' }}>
                                {totalActiveNetPnl >= 0 ? '+' : ''}{totalActiveNetPnlPercent.toFixed(2)}%
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                Chgs: -{formatCurrency(totalActiveBrokerage)}
                            </span>
                        </div>
                    </div>

                    {/* Absolute P&L = Realized P&L + Active P&L */}
                    <div className="portfolio-stat-card highlight">
                        <span className="stat-card-label">Absolute P&L</span>
                        <div className="stat-card-value" style={{ color: absolutePnl >= 0 ? 'var(--emerald-green-text)' : 'var(--crimson-red-text)' }}>
                            {absolutePnl >= 0 ? '+' : ''}{formatCurrency(absolutePnl)}
                        </div>
                        <div className="stat-card-delta-row">
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                                Realized: {formatCurrency(totalExitedRealizedNetPnl)} · Active: {formatCurrency(totalActiveNetPnl)}
                            </span>
                        </div>
                    </div>

                    {/* Day's Profit / Loss */}
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

                    {/* Left Column: Holdings Book */}
                    <div>
                        <div className="portfolio-holdings-card">
                            <div className="holdings-head-toolbar">
                                <div>
                                    <span className="fintech-eyebrow">PORTFOLIO POSITIONS</span>
                                    <h2 style={{ margin: '2px 0 8px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                        Holdings Book
                                    </h2>

                                    {/* Active vs Exited Tabs */}
                                    <div className="holdings-tabs-bar">
                                        <button
                                            type="button"
                                            className={`holding-tab-btn ${activeHoldingsTab === 'active' ? 'active' : ''}`}
                                            onClick={() => setActiveHoldingsTab('active')}
                                        >
                                            Active Holdings ({activePositions.length})
                                        </button>
                                        <button
                                            type="button"
                                            className={`holding-tab-btn ${activeHoldingsTab === 'exited' ? 'active' : ''}`}
                                            onClick={() => setActiveHoldingsTab('exited')}
                                        >
                                            Past Exited Holdings ({exitedPositions.length})
                                        </button>
                                    </div>
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
                                <div className="empty-state-fintech">
                                    <div className="empty-icon-circle">💼</div>
                                    <h3>No Positions Yet</h3>
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
                            ) : displayedPositions.length === 0 ? (
                                <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {activeHoldingsTab === 'active'
                                        ? (filterQuery ? `No active holdings match "${filterQuery}".` : 'No active holdings currently open.')
                                        : (filterQuery ? `No exited holdings match "${filterQuery}".` : 'No past exited holdings recorded yet. Clicking "Exit Position" on an active position moves it here with locked realized P&L.')}
                                </div>
                            ) : (
                                <div className="holdings-list-shell">
                                    {displayedPositions.map((item) => {
                                        const isExited = item.status === 'exited';
                                        const isEditingThisItem = editingItemId === item.id;
                                        const invested = (item.buy_price || 0) * item.quantity;
                                        const currentValue = isExited
                                            ? (item.exit_price || item.buy_price || 0) * item.quantity
                                            : (item.current_price || 0) * item.quantity;

                                        const grossPnl = item.gross_pnl != null
                                            ? Number(item.gross_pnl)
                                            : (currentValue - invested);

                                        const itemBrk = calcItemBrokerage(item.buy_price, isExited ? item.exit_price : item.current_price, item.quantity);
                                        const brokerage = item.brokerage_cost != null
                                            ? Number(item.brokerage_cost)
                                            : itemBrk.total;

                                        const netPnl = item.net_pnl != null
                                            ? Number(item.net_pnl)
                                            : (grossPnl - brokerage);

                                        const netPnlPercent = invested ? (netPnl / invested) * 100 : 0;
                                        const isExpanded = expandedItemId === item.id;

                                        return (
                                            <div key={item.id} className={`holding-card-item ${isExited ? 'exited-holding-item' : ''}`}>
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
                                                            {isExited ? (
                                                                <span className="exited-status-pill">EXITED</span>
                                                            ) : (
                                                                <span className="active-status-pill">ACTIVE</span>
                                                            )}
                                                        </div>
                                                        <div className="holding-qty-sub">
                                                            Qty: <strong>{item.quantity}</strong> · Avg: <strong>{formatCurrency(item.buy_price)}</strong> · Invested: <strong>{formatCurrency(invested)}</strong>
                                                            {item.buy_date && (
                                                                <span> · Bought: <strong>{formatDateDisplay(item.buy_date)}</strong></span>
                                                            )}
                                                            {isExited && item.sell_date && (
                                                                <span> · Exit Date: <strong>{formatDateDisplay(item.sell_date)}</strong></span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="holding-right-col">
                                                        <div className="holding-pnl-block">
                                                            <span className={`holding-pnl-num ${netPnl >= 0 ? 'up' : 'down'}`}>
                                                                {netPnl >= 0 ? '+' : ''}{formatCurrency(netPnl)}
                                                            </span>
                                                            <span className="holding-ltp-sub">
                                                                {isExited ? `Exit: ${formatCurrency(item.exit_price || item.current_price)}` : `LTP: ${formatCurrency(item.current_price)}`}
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
                                                        {isEditingThisItem ? (
                                                            /* Inline Edit Form */
                                                            <div className="inline-edit-panel" style={{ width: '100%', padding: '10px 0' }}>
                                                                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary-blue)', marginBottom: '10px' }}>
                                                                    Edit Position — {item.symbol}
                                                                </div>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                                                                    <div>
                                                                        <label className="fintech-input-label">Quantity</label>
                                                                        <input
                                                                            type="number"
                                                                            min="1"
                                                                            value={editForm.quantity}
                                                                            onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                                                            className="fintech-form-input"
                                                                            style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="fintech-input-label">Buy Price (₹)</label>
                                                                        <input
                                                                            type="number"
                                                                            step="0.01"
                                                                            value={editForm.buy_price}
                                                                            onChange={(e) => setEditForm({ ...editForm, buy_price: e.target.value })}
                                                                            className="fintech-form-input"
                                                                            style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="fintech-input-label">Buy Date</label>
                                                                        <input
                                                                            type="date"
                                                                            value={editForm.buy_date}
                                                                            onChange={(e) => setEditForm({ ...editForm, buy_date: e.target.value })}
                                                                            className="fintech-form-input"
                                                                            style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                                                        />
                                                                    </div>
                                                                    {isExited && (
                                                                        <>
                                                                            <div>
                                                                                <label className="fintech-input-label">Exit Price (₹)</label>
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    value={editForm.exit_price}
                                                                                    onChange={(e) => setEditForm({ ...editForm, exit_price: e.target.value })}
                                                                                    className="fintech-form-input"
                                                                                    style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="fintech-input-label">Sell / Exit Date</label>
                                                                                <input
                                                                                    type="date"
                                                                                    value={editForm.sell_date}
                                                                                    onChange={(e) => setEditForm({ ...editForm, sell_date: e.target.value })}
                                                                                    className="fintech-form-input"
                                                                                    style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                                                                                />
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-save-edit"
                                                                        onClick={() => handleSaveEdit(item.id)}
                                                                    >
                                                                        Save Changes
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn-cancel-edit"
                                                                        onClick={() => setEditingItemId(null)}
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="holding-expanded-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                        {item.display_name || item.name || item.symbol}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                                        <span>{isExited ? 'Realized Exit Value' : 'Current Value'}: <strong>{formatCurrency(currentValue)}</strong></span>
                                                                        <span>Gross P&L: <strong style={{ color: grossPnl >= 0 ? 'var(--emerald-green-text)' : 'var(--crimson-red-text)' }}>{grossPnl >= 0 ? '+' : ''}{formatCurrency(grossPnl)}</strong></span>
                                                                        <span>Buy Chg (0.15%): <strong style={{ color: 'var(--crimson-red-text)' }}>-{formatCurrency(itemBrk.buyChg)}</strong></span>
                                                                        <span>Sell Chg (0.15%): <strong style={{ color: 'var(--crimson-red-text)' }}>-{formatCurrency(itemBrk.sellChg)}</strong></span>
                                                                        <span>Total Charges: <strong style={{ color: 'var(--crimson-red-text)' }}>-{formatCurrency(brokerage)}</strong></span>
                                                                        <span>Net P&L: <strong style={{ color: netPnl >= 0 ? 'var(--emerald-green-text)' : 'var(--crimson-red-text)' }}>{netPnl >= 0 ? '+' : ''}{formatCurrency(netPnl)}</strong></span>
                                                                        <span>Buy Date: <strong>{formatDateDisplay(item.buy_date) || '—'}</strong></span>
                                                                        {isExited && (
                                                                            <span>Sell / Exit Date: <strong>{formatDateDisplay(item.sell_date) || '—'}</strong></span>
                                                                        )}
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
                                                                        className="btn-edit-holding"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleStartEdit(item);
                                                                        }}
                                                                        title="Edit buy date, buy price, quantity, or sell date"
                                                                    >
                                                                        Edit Entry
                                                                    </button>

                                                                    {!isExited && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn-exit-holding"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleExit(item.id);
                                                                            }}
                                                                            title="Exit position and lock in realized P&L"
                                                                        >
                                                                            Exit Position
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        className="btn-delete-holding"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDelete(item.id);
                                                                        }}
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Capital Allocation Visualizer Card */}
                        {activePositions.length > 0 && totalCurrent > 0 && (
                            <div className="portfolio-allocation-card" style={{ marginTop: '20px' }}>
                                <span className="fintech-eyebrow">CAPITAL DIVERSIFICATION</span>
                                <h3 style={{ margin: '2px 0 12px', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                    Portfolio Allocation Breakdown
                                </h3>

                                <div className="allocation-segmented-bar">
                                    {activePositions.map((item, idx) => {
                                        const val = (item.current_price || 0) * item.quantity;
                                        const pct = totalCurrent ? (val / totalCurrent) * 100 : 0;
                                        const color = ALLOC_COLORS[idx % ALLOC_COLORS.length];
                                        return (
                                            <div
                                                key={item.id}
                                                className="alloc-segment"
                                                style={{ width: `${pct}%`, background: color }}
                                                title={`${item.symbol}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                                            />
                                        );
                                    })}
                                </div>

                                <div className="alloc-legend-row">
                                    {activePositions.map((item, idx) => {
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
                        <h2 style={{ margin: '2px 0 16px', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Quick Position Entry
                        </h2>

                        <div style={{ display: 'grid', gap: '16px' }}>
                            {/* Symbol with Autocomplete Dropdown */}
                            <div style={{ position: 'relative' }}>
                                <label className="fintech-input-label">Script Symbol</label>
                                <input
                                    ref={symbolInputRef}
                                    type="text"
                                    placeholder="Enter Symbol"
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

                            {/* Buy Date Input */}
                            <div>
                                <label className="fintech-input-label">Buy Date</label>
                                <input
                                    type="date"
                                    value={buyDate}
                                    onChange={(e) => setBuyDate(e.target.value)}
                                    className="fintech-form-input"
                                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem' }}
                                />
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
                                            buy_date: buyDate || getTodayDateStr(),
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

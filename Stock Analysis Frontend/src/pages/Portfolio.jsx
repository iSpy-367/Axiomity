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

const BUY_BROKERAGE_RATE = 0.0015;
const SELL_BROKERAGE_RATE = 0.0015;

const ALLOC_COLORS = [
    '#2563eb', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#f97316', '#64748b'
];

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
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
    const [activeHoldingsTab, setActiveHoldingsTab] = useState('active');
    const [showAddModal, setShowAddModal] = useState(false);

    // Modals
    const [exitModalItem, setExitModalItem] = useState(null);
    const [exitPriceInput, setExitPriceInput] = useState('');
    const [exitDateInput, setExitDateInput] = useState(getTodayDateStr());
    const [submittingExit, setSubmittingExit] = useState(false);

    const [editModalItem, setEditModalItem] = useState(null);
    const [editForm, setEditForm] = useState({
        quantity: 1,
        buy_price: '',
        buy_date: '',
        sell_date: '',
        exit_price: ''
    });
    const [submittingEdit, setSubmittingEdit] = useState(false);

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const symbolInputRef = useRef(null);

    // Position Groups
    const activePositions = portfolio.filter(item => item.status !== 'exited');
    const exitedPositions = portfolio.filter(item => item.status === 'exited');

    // 100% Original Financial Calculations
    const totalInvested = activePositions.reduce((sum, item) => sum + (item.buy_price || 0) * item.quantity, 0);
    const totalCurrent = activePositions.reduce((sum, item) => sum + (item.current_price || 0) * item.quantity, 0);
    const totalActiveGrossPnl = totalCurrent - totalInvested;
    const totalActiveBrokerage = activePositions.reduce((sum, item) => {
        if (item.brokerage_cost != null) return sum + Number(item.brokerage_cost);
        return sum + calcItemBrokerage(item.buy_price, item.current_price, item.quantity).total;
    }, 0);
    const totalActiveNetPnl = totalActiveGrossPnl - totalActiveBrokerage;
    const totalActiveNetPnlPercent = totalInvested > 0 ? (totalActiveNetPnl / totalInvested) * 100 : 0;

    const totalExitedRealizedNetPnl = exitedPositions.reduce((sum, item) => {
        if (item.realized_net_pnl != null) return sum + Number(item.realized_net_pnl);
        if (item.net_pnl != null) return sum + Number(item.net_pnl);
        const inv = (item.buy_price || 0) * item.quantity;
        const exitVal = (item.exit_price || item.buy_price || 0) * item.quantity;
        const gross = exitVal - inv;
        const brokerage = calcItemBrokerage(item.buy_price, item.exit_price, item.quantity).total;
        return sum + (gross - brokerage);
    }, 0);

    const absolutePnl = totalActiveNetPnl + totalExitedRealizedNetPnl;

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
        } catch {
            setError('Unable to load portfolio data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPortfolio();
    }, []);

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

    const handleSelectSuggestion = (item) => {
        setScriptSymbol(item.symbol);
        if (item.current_price) {
            setScriptBuyPrice(item.current_price.toString());
        }
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleAddSubmit = async (e) => {
        if (e) e.preventDefault();
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
            setShowAddModal(false);
            await loadPortfolio();
        } catch (err) {
            setError(err.response?.data?.symbol || err.response?.data?.detail || 'Unable to add this script.');
        }
    };

    const handleDelete = async (id, sym) => {
        if (!window.confirm(`Are you sure you want to delete ${sym || 'this position'}?`)) return;
        setMessage('');
        setError('');
        try {
            await deletePortfolioItem(id);
            setMessage('Position removed successfully.');
            await loadPortfolio();
        } catch (err) {
            setError(err.response?.data?.detail || 'Unable to delete position.');
        }
    };

    const handleOpenExitModal = (item) => {
        setExitModalItem(item);
        setExitPriceInput(item.current_price ? item.current_price.toString() : item.buy_price.toString());
        setExitDateInput(getTodayDateStr());
    };

    const handleConfirmExit = async (e) => {
        e.preventDefault();
        if (!exitModalItem) return;
        setSubmittingExit(true);
        try {
            await exitPortfolioItem(exitModalItem.id, {
                exit_price: Number(exitPriceInput),
                sell_date: exitDateInput || getTodayDateStr()
            });
            setMessage(`${exitModalItem.symbol} position exited and realized P&L locked.`);
            setExitModalItem(null);
            await loadPortfolio();
        } catch (err) {
            setError(err.response?.data?.detail || 'Unable to exit position.');
        } finally {
            setSubmittingExit(false);
        }
    };

    const handleOpenEditModal = (item) => {
        setEditModalItem(item);
        setEditForm({
            quantity: item.quantity,
            buy_price: item.buy_price,
            buy_date: item.buy_date || getTodayDateStr(),
            sell_date: item.sell_date || '',
            exit_price: item.exit_price || ''
        });
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editModalItem) return;
        setSubmittingEdit(true);
        try {
            const payload = {
                quantity: Number(editForm.quantity),
                buy_price: Number(editForm.buy_price),
                buy_date: editForm.buy_date || null
            };
            if (editModalItem.status === 'exited') {
                payload.sell_date = editForm.sell_date || null;
                if (editForm.exit_price) {
                    payload.exit_price = Number(editForm.exit_price);
                }
            }
            await updatePortfolioItem(editModalItem.id, payload);
            setMessage('Position updated successfully.');
            setEditModalItem(null);
            await loadPortfolio();
        } catch (err) {
            setError(err.response?.data?.detail || 'Unable to update position.');
        } finally {
            setSubmittingEdit(false);
        }
    };

    const formatCurrency = (val) => {
        const n = Number(val || 0);
        return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="app-shell">
            <Navbar />

            {/* Ambient Background Glows */}
            <div className="ambient-glow-top-right"></div>
            <div className="ambient-glow-mid-left"></div>

            <div className="portfolio-page">

                {/* 1. ORIGINAL HERO CARD ON TOP WITH SLEEK ADD POSITION BUTTON */}
                <section className="hero-card portfolio-hero-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="hero-copy">
                        <p className="eyebrow">PORTFOLIO MANAGEMENT • LIVE POSITIONS</p>
                        <h1>Your Holdings Desk</h1>
                        <p>Track real-time market value, capital allocation, active P&L, realized performance, and absolute P&L.</p>
                    </div>
                    <button
                        type="button"
                        className="btn-add-position-primary"
                        onClick={() => {
                            setShowAddModal(true);
                            setTimeout(() => symbolInputRef.current?.focus(), 100);
                        }}
                    >
                        Add Position
                    </button>
                </section>

                {message && <div className="status success" style={{ marginBottom: '16px' }}>{message}</div>}
                {error && <div className="status error" style={{ marginBottom: '16px' }}>{error}</div>}

                {/* 2. ORIGINAL 5 STATS CARDS GRID ON TOP */}
                <section className="portfolio-stats-grid">
                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Invested Capital</span>
                        <div className="stat-card-value">{formatCurrency(totalInvested)}</div>
                        <div className="stat-card-delta-row" style={{ color: 'var(--text-muted)' }}>
                            {activePositions.length} active position(s)
                        </div>
                    </div>

                    <div className="portfolio-stat-card">
                        <span className="stat-card-label">Current Value</span>
                        <div className="stat-card-value">{formatCurrency(totalCurrent)}</div>
                        <div className="stat-card-delta-row">
                            <span className={`mover-pct-badge ${totalActiveGrossPnl >= 0 ? 'positive' : 'negative'}`} style={{ padding: '2px 8px', fontSize: '0.78rem' }}>
                                {totalActiveGrossPnl >= 0 ? '+' : ''}{totalInvested > 0 ? ((totalActiveGrossPnl / totalInvested) * 100).toFixed(2) : '0.00'}% Gross
                            </span>
                        </div>
                    </div>

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

                {/* 4. EXACT REQUESTED ENTRIES SECTION (AS PER SCREENSHOT) */}
                {/* Active / Exited Position Tabs */}
                <div className="portfolio-tabs-container">
                    <button
                        type="button"
                        className={`portfolio-tab-link ${activeHoldingsTab === 'active' ? 'active' : ''}`}
                        onClick={() => setActiveHoldingsTab('active')}
                    >
                        Active Positions
                    </button>
                    <button
                        type="button"
                        className={`portfolio-tab-link ${activeHoldingsTab === 'exited' ? 'active' : ''}`}
                        onClick={() => setActiveHoldingsTab('exited')}
                    >
                        Exited Positions
                    </button>
                </div>

                {/* Portfolio Holdings Table Card */}
                <div className="portfolio-table-card">
                    <div className="portfolio-table-header-row">
                        <h2 className="portfolio-table-title">Portfolio Holdings</h2>
                        <div className="portfolio-table-search">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input
                                type="text"
                                placeholder="Filter stocks..."
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="portfolio-empty-state">
                            <p style={{ color: 'var(--text-muted)' }}>Loading live portfolio holdings...</p>
                        </div>
                    ) : portfolio.length === 0 ? (
                        <div className="portfolio-empty-state">
                            <div className="empty-icon-bubble">💼</div>
                            <h3>No Positions Yet</h3>
                            <p>Your portfolio is currently empty. Use the Quick Position Entry above to add your first stock.</p>
                        </div>
                    ) : displayedPositions.length === 0 ? (
                        <div className="portfolio-empty-state" style={{ padding: '36px 20px' }}>
                            <p style={{ color: 'var(--text-muted)' }}>
                                {activeHoldingsTab === 'active'
                                    ? (filterQuery ? `No active stocks match "${filterQuery}".` : 'No active holdings currently open.')
                                    : (filterQuery ? `No exited stocks match "${filterQuery}".` : 'No past exited holdings recorded yet.')}
                            </p>
                        </div>
                    ) : (
                        <div className="portfolio-table-wrapper">
                            <table className="portfolio-holdings-table">
                                <thead>
                                    <tr>
                                        <th>Stock</th>
                                        <th>Qty</th>
                                        <th>Buy Price</th>
                                        <th>Current Price</th>
                                        <th>Total Value</th>
                                        <th>Gross P&L</th>
                                        <th>Brokerage</th>
                                        <th>Net P&L</th>
                                        <th>Daily%</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedPositions.map((item) => {
                                        const isExited = item.status === 'exited';
                                        const invested = (item.buy_price || 0) * item.quantity;
                                        const currentPrice = isExited 
                                            ? (item.exit_price || item.current_price || item.buy_price) 
                                            : (item.current_price || item.buy_price);
                                        const totalVal = currentPrice * item.quantity;

                                        const grossPnl = item.gross_pnl != null
                                            ? Number(item.gross_pnl)
                                            : (totalVal - invested);

                                        const itemBrk = calcItemBrokerage(item.buy_price, currentPrice, item.quantity);
                                        const brokerage = item.brokerage_cost != null
                                            ? Number(item.brokerage_cost)
                                            : itemBrk.total;

                                        const netPnl = item.net_pnl != null
                                            ? Number(item.net_pnl)
                                            : (grossPnl - brokerage);

                                        const dailyPct = item.daily_change_percent != null
                                            ? Number(item.daily_change_percent)
                                            : 0;

                                        return (
                                            <tr key={item.id} className="portfolio-row">
                                                <td className="cell-stock">
                                                    <Link to={`/analysis?symbol=${item.symbol}`} className="stock-sym-link" title={`Bought on ${formatDateDisplay(item.buy_date)}`}>
                                                        <span className="stock-sym-text">{item.symbol}</span>
                                                    </Link>
                                                </td>
                                                <td className="cell-qty">{item.quantity} shares</td>
                                                <td className="cell-price">{formatCurrency(item.buy_price)}</td>
                                                <td className="cell-price">{formatCurrency(currentPrice)}</td>
                                                <td className="cell-total">{formatCurrency(totalVal)}</td>
                                                <td className={`cell-pnl ${grossPnl >= 0 ? 'positive' : 'negative'}`}>
                                                    {grossPnl >= 0 ? '+' : ''}{formatCurrency(grossPnl)}
                                                </td>
                                                <td className="cell-brokerage">{formatCurrency(brokerage)}</td>
                                                <td className={`cell-pnl ${netPnl >= 0 ? 'positive' : 'negative'}`}>
                                                    {netPnl >= 0 ? '+' : ''}{formatCurrency(netPnl)}
                                                </td>
                                                <td className={`cell-daily ${isExited ? '' : dailyPct > 0 ? 'positive' : dailyPct < 0 ? 'negative' : ''}`}>
                                                    {isExited ? '—' : `${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%`}
                                                </td>
                                                <td className="cell-actions" style={{ textAlign: 'right' }}>
                                                    <div className="action-buttons-group">
                                                        {!isExited ? (
                                                            <button
                                                                type="button"
                                                                className="btn-table-exit"
                                                                onClick={() => handleOpenExitModal(item)}
                                                                title="Exit Position and lock in realized P&L"
                                                            >
                                                                Exit
                                                            </button>
                                                        ) : (
                                                            <span className="exited-badge">Exited</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="btn-table-icon"
                                                            onClick={() => handleOpenEditModal(item)}
                                                            title="Edit Entry"
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-table-icon delete"
                                                            onClick={() => handleDelete(item.id, item.symbol)}
                                                            title="Delete Entry"
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 5. CAPITAL DIVERSIFICATION BREAKDOWN (AS PER SCREENSHOT) */}
                {activePositions.length > 0 && totalCurrent > 0 && (
                    <div className="portfolio-allocation-box">
                        <span className="allocation-eyebrow">CAPITAL DIVERSIFICATION</span>
                        <h3 className="allocation-title">Portfolio Allocation Breakdown</h3>
                        <div className="allocation-bar-wrapper">
                            {activePositions.map((item, idx) => {
                                const val = (item.current_price || 0) * item.quantity;
                                const pct = totalCurrent ? (val / totalCurrent) * 100 : 0;
                                const color = ALLOC_COLORS[idx % ALLOC_COLORS.length];
                                return (
                                    <div
                                        key={item.id}
                                        className="allocation-bar-segment"
                                        style={{ width: `${pct}%`, background: color }}
                                        title={`${item.symbol}: ${pct.toFixed(1)}% (${formatCurrency(val)})`}
                                    />
                                );
                            })}
                        </div>
                        <div className="allocation-chips-row">
                            {activePositions.map((item, idx) => {
                                const val = (item.current_price || 0) * item.quantity;
                                const pct = totalCurrent ? (val / totalCurrent) * 100 : 0;
                                const color = ALLOC_COLORS[idx % ALLOC_COLORS.length];
                                return (
                                    <div key={item.id} className="allocation-chip">
                                        <span className="allocation-dot" style={{ background: color }}></span>
                                        <span className="allocation-chip-text">
                                            <strong>{item.symbol}</strong> ({pct.toFixed(1)}%)
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ADD POSITION MODAL */}
            {showAddModal && (
                <div className="modal-backdrop-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-card-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Stock Position</h3>
                            <button type="button" className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit} className="modal-form-body">
                            <div className="modal-input-group" style={{ position: 'relative' }}>
                                <label className="modal-label">Stock Symbol / Company</label>
                                <input
                                    ref={symbolInputRef}
                                    type="text"
                                    placeholder="Enter Symbol (e.g. RELIANCE, TCS, INFY)"
                                    value={scriptSymbol}
                                    onChange={(e) => setScriptSymbol(e.target.value.toUpperCase())}
                                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                                    className="modal-input"
                                    required
                                    autoComplete="off"
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="typeahead-dropdown">
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

                            <div className="modal-grid-2">
                                <div className="modal-input-group">
                                    <label className="modal-label">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={scriptQty}
                                        onChange={(e) => setScriptQty(Number(e.target.value))}
                                        className="modal-input"
                                        required
                                    />
                                </div>
                                <div className="modal-input-group">
                                    <label className="modal-label">Buy Price (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={scriptBuyPrice}
                                        onChange={(e) => setScriptBuyPrice(e.target.value)}
                                        className="modal-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="modal-input-group">
                                <label className="modal-label">Purchase Date</label>
                                <input
                                    type="date"
                                    value={buyDate}
                                    onChange={(e) => setBuyDate(e.target.value)}
                                    className="modal-input"
                                />
                            </div>

                            <div className="modal-footer-actions">
                                <button
                                    type="button"
                                    className="btn-modal-cancel"
                                    onClick={() => setShowAddModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-modal-submit"
                                >
                                    Add to Holdings
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EXIT POSITION MODAL */}
            {exitModalItem && (
                <div className="modal-backdrop-overlay" onClick={() => setExitModalItem(null)}>
                    <div className="modal-card-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Exit Position — {exitModalItem.symbol}</h3>
                            <button type="button" className="modal-close-btn" onClick={() => setExitModalItem(null)}>
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleConfirmExit} className="modal-form-body">
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: '0 0 16px' }}>
                                Closing {exitModalItem.quantity} shares of {exitModalItem.symbol} (Bought @ {formatCurrency(exitModalItem.buy_price)}).
                            </p>

                            <div className="modal-input-group">
                                <label className="modal-label">Exit Selling Price (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={exitPriceInput}
                                    onChange={(e) => setExitPriceInput(e.target.value)}
                                    className="modal-input"
                                    required
                                />
                            </div>

                            <div className="modal-input-group">
                                <label className="modal-label">Exit / Sell Date</label>
                                <input
                                    type="date"
                                    value={exitDateInput}
                                    onChange={(e) => setExitDateInput(e.target.value)}
                                    className="modal-input"
                                />
                            </div>

                            <div className="modal-footer-actions">
                                <button
                                    type="button"
                                    className="btn-modal-cancel"
                                    onClick={() => setExitModalItem(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-modal-submit danger"
                                    disabled={submittingExit}
                                >
                                    {submittingExit ? 'Processing...' : 'Confirm Exit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT POSITION MODAL */}
            {editModalItem && (
                <div className="modal-backdrop-overlay" onClick={() => setEditModalItem(null)}>
                    <div className="modal-card-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Edit Entry — {editModalItem.symbol}</h3>
                            <button type="button" className="modal-close-btn" onClick={() => setEditModalItem(null)}>
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="modal-form-body">
                            <div className="modal-grid-2">
                                <div className="modal-input-group">
                                    <label className="modal-label">Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editForm.quantity}
                                        onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                        className="modal-input"
                                        required
                                    />
                                </div>
                                <div className="modal-input-group">
                                    <label className="modal-label">Buy Price (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editForm.buy_price}
                                        onChange={(e) => setEditForm({ ...editForm, buy_price: e.target.value })}
                                        className="modal-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="modal-input-group">
                                <label className="modal-label">Purchase Date</label>
                                <input
                                    type="date"
                                    value={editForm.buy_date}
                                    onChange={(e) => setEditForm({ ...editForm, buy_date: e.target.value })}
                                    className="modal-input"
                                />
                            </div>

                            {editModalItem.status === 'exited' && (
                                <div className="modal-grid-2">
                                    <div className="modal-input-group">
                                        <label className="modal-label">Exit Price (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editForm.exit_price}
                                            onChange={(e) => setEditForm({ ...editForm, exit_price: e.target.value })}
                                            className="modal-input"
                                        />
                                    </div>
                                    <div className="modal-input-group">
                                        <label className="modal-label">Sell Date</label>
                                        <input
                                            type="date"
                                            value={editForm.sell_date}
                                            onChange={(e) => setEditForm({ ...editForm, sell_date: e.target.value })}
                                            className="modal-input"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="modal-footer-actions">
                                <button
                                    type="button"
                                    className="btn-modal-cancel"
                                    onClick={() => setEditModalItem(null)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-modal-submit"
                                    disabled={submittingEdit}
                                >
                                    {submittingEdit ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Portfolio;

import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import { getPortfolio, deletePortfolioItem, addPortfolioItem } from '../services/api';

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

    const totalInvested = portfolio.reduce((sum, item) => sum + (item.buy_price || 0) * item.quantity, 0);
    const totalCurrent = portfolio.reduce((sum, item) => sum + (item.current_price || 0) * item.quantity, 0);
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPercent = totalInvested ? (totalPnl / totalInvested) * 100 : 0;

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
            setError('Unable to load portfolio.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPortfolio();
    }, []);

    const handleDelete = async (id) => {
        setMessage('');
        try {
            await deletePortfolioItem(id);
            setMessage('Portfolio entry removed successfully.');
            await loadPortfolio();
        } catch {
            setError('Unable to remove this position right now.');
        }
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
            <div className="dashboard-page portfolio-page" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
                
                {/* Title and Open Positions count */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Portfolio</h1>
                    <div style={{ background: '#edf4ff', color: '#2357d8', fontSize: '0.8rem', fontWeight: 700, padding: '6px 12px', borderRadius: '20px' }}>
                        {portfolio.length} Positions
                    </div>
                </div>

                {message && <div className="status success" style={{ marginBottom: '20px' }}>{message}</div>}
                {error && <div className="status error" style={{ marginBottom: '20px' }}>{error}</div>}

                {/* Two-Column Responsive Layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1.2fr)', gap: '24px', alignItems: 'start' }} className="portfolio-content-grid">
                    
                    {/* Left Column: Summary and Holdings */}
                    <div>
                        {/* Summary Card (Kite Holdings Style) */}
                        <div style={{ background: '#ffffff', border: '1px solid #eef2f6', borderRadius: '16px', padding: '20px', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)', marginBottom: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f3f6' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>Invested</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalInvested)}</span>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>Current Value</span>
                                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalCurrent)}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Total P&L</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <strong style={{ fontSize: '1.25rem', color: totalPnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                                        {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
                                    </strong>
                                    <span style={{ 
                                        fontSize: '0.76rem', 
                                        fontWeight: 800, 
                                        padding: '4px 8px', 
                                        borderRadius: '8px', 
                                        background: totalPnl >= 0 ? '#ecfdf5' : '#fff1f2', 
                                        color: totalPnl >= 0 ? '#10b981' : '#ef4444' 
                                    }}>
                                        {totalInvested ? `${totalPnl >= 0 ? '+' : ''}${totalPnlPercent.toFixed(2)}%` : '0.00%'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Kite Toolbar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '10px 14px', borderRadius: '14px', border: '1px solid #eef2f6' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '10px', maxWidth: '240px', flex: 1 }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="11" cy="11" r="8"></circle>
                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                    </svg>
                                    <input 
                                        type="text" 
                                        placeholder="Search holdings..." 
                                        value={filterQuery}
                                        onChange={(e) => setFilterQuery(e.target.value)}
                                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', color: '#1e293b', width: '100%', padding: 0 }}
                                    />
                                </div>
                                <button title="Filters" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="4" y1="21" x2="4" y2="14"></line>
                                        <line x1="4" y1="10" x2="4" y2="3"></line>
                                        <line x1="12" y1="21" x2="12" y2="12"></line>
                                        <line x1="12" y1="8" x2="12" y2="3"></line>
                                        <line x1="20" y1="21" x2="20" y2="16"></line>
                                        <line x1="20" y1="12" x2="20" y2="3"></line>
                                        <line x1="1" y1="14" x2="7" y2="14"></line>
                                        <line x1="9" y1="8" x2="15" y2="8"></line>
                                        <line x1="17" y1="16" x2="23" y2="16"></line>
                                    </svg>
                                </button>
                                <button title="Analytical view" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: '4px' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                    </svg>
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.82rem', fontWeight: 700, color: '#2357d8' }} className="kite-links">
                                <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="9" cy="7" r="4"></circle>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                    </svg>
                                    Family
                                </span>
                                <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
                                    <span style={{ width: '6px', height: '6px', background: '#2357d8', borderRadius: '50%', display: 'inline-block' }}></span>
                                    Analytics
                                </span>
                            </div>
                        </div>

                        {/* Holdings List */}
                        <div style={{ background: '#ffffff', border: '1px solid #eef2f6', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.02)' }}>
                            {loading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading your portfolio…</div>
                            ) : filteredPortfolio.length === 0 ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                    {filterQuery ? 'No matching assets found.' : 'Your portfolio is empty. Add a position to get started.'}
                                </div>
                            ) : (
                                filteredPortfolio.map((item) => {
                                    const invested = (item.buy_price || 0) * item.quantity;
                                    const currentValue = (item.current_price || 0) * item.quantity;
                                    const pnl = currentValue - invested;
                                    const pnlPercent = invested ? (pnl / invested) * 100 : 0;
                                    const isExpanded = expandedItemId === item.id;
                                    return (
                                        <div key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            {/* Summary Row */}
                                            <div 
                                                style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', background: isExpanded ? '#f8fbff' : '#ffffff', transition: 'background 0.2s' }}
                                                onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                                className="kite-holding-row"
                                            >
                                                {/* Left section */}
                                                <div>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>
                                                        Qty. <strong style={{ color: '#0f172a' }}>{item.quantity}</strong> · Avg. <strong style={{ color: '#0f172a' }}>{formatCurrency(item.buy_price)}</strong>
                                                    </div>
                                                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>{item.symbol}</div>
                                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                                        Invested <strong style={{ color: '#475467' }}>{formatCurrency(invested)}</strong>
                                                    </div>
                                                </div>
                                                {/* Right section */}
                                                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: pnl >= 0 ? '#10b981' : '#ef4444' }}>
                                                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                                                    </span>
                                                    <span style={{ fontSize: '0.96rem', fontWeight: 800, color: pnl >= 0 ? '#10b981' : '#ef4444', margin: '4px 0' }}>
                                                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                                                    </span>
                                                    <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>
                                                        LTP <strong style={{ color: '#1e293b' }}>{formatCurrency(item.current_price)}</strong>{' '}
                                                        <span style={{ color: item.daily_change_percent >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                            ({item.daily_change_percent >= 0 ? '+' : ''}{item.daily_change_percent?.toFixed(2)}%)
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Options panel */}
                                            {isExpanded && (
                                                <div style={{ background: '#f8fafc', padding: '12px 16px', borderTop: '1px dashed #e2e8f0', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{item.display_name || item.symbol}</span>
                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                        <a href={`/analysis?symbol=${item.symbol}`} className="secondary-button" style={{ fontSize: '0.75rem', padding: '6px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', borderRadius: '10px', fontWeight: 700 }}>
                                                            Analyze Stock
                                                        </a>
                                                        <button 
                                                            onClick={() => handleDelete(item.id)} 
                                                            style={{ background: '#fff1f2', color: '#dc2626', border: '1px solid #fecdd3', padding: '6px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                                        >
                                                            Delete Position
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Day's P&L Summary Block */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', background: '#f8fafc', padding: '16px 20px', borderRadius: '16px', border: '1px solid #eef2f6', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Day's P&L</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ fontSize: '1.05rem', color: totalDayChange >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                                    {totalDayChange >= 0 ? '+' : ''}{formatCurrency(totalDayChange)}
                                </strong>
                                <span style={{ fontSize: '0.85rem', color: totalDayChange >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                                    ({totalDayChange >= 0 ? '+' : ''}{totalDayChangePercent.toFixed(2)}%)
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Quick Entry Form */}
                    <div style={{ background: '#ffffff', border: '1px solid #eef2f6', borderRadius: '16px', padding: '24px', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)' }}>
                        <p className="eyebrow" style={{ marginBottom: '14px' }}>ADD ASSET</p>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 16px' }}>Quick Position Entry</h2>
                        
                        <div style={{ display: 'grid', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475467', marginBottom: '6px' }}>Ticker Symbol</label>
                                <input
                                    type="text"
                                    placeholder="e.g. RELIANCE"
                                    value={scriptSymbol}
                                    onChange={(e) => setScriptSymbol(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #d7def0', background: '#ffffff', fontSize: '0.9rem', fontWeight: 600 }}
                                />
                            </div>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475467', marginBottom: '6px' }}>Quantity</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={scriptQty}
                                        onChange={(e) => setScriptQty(Number(e.target.value))}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #d7def0', background: '#ffffff', fontSize: '0.9rem', fontWeight: 600 }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475467', marginBottom: '6px' }}>Buy Price (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={scriptBuyPrice}
                                        onChange={(e) => setScriptBuyPrice(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #d7def0', background: '#ffffff', fontSize: '0.9rem', fontWeight: 600 }}
                                    />
                                </div>
                            </div>

                            <button 
                                type="button" 
                                className="primary-button" 
                                onClick={async () => {
                                    setMessage('');
                                    setError('');
                                    if (!scriptSymbol.trim() || !scriptQty || !scriptBuyPrice) {
                                        setError('Symbol, quantity and buy price are required.');
                                        return;
                                    }
                                    try {
                                        await addPortfolioItem({
                                            symbol: scriptSymbol.trim(),
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
                                style={{ padding: '12px 24px', borderRadius: '10px', fontWeight: 800, marginTop: '8px', cursor: 'pointer', width: '100%' }}
                            >
                                Add Position
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default Portfolio;

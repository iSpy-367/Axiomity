import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StockChart from '../components/StockChart';
import Navbar from '../components/Navbar';
import { fetchStock, getStock, getTopMovers } from '../services/api';

function Dashboard() {
    const [topMovers, setTopMovers] = useState({ top_active: [], most_gained: [], most_lost: [] });
    const [selectedCap, setSelectedCap] = useState('all');
    const [marketError, setMarketError] = useState('');
    const [nifty50Data, setNifty50Data] = useState(null);
    const [bankNiftyData, setBankNiftyData] = useState(null);
    const [indexError, setIndexError] = useState('');
    const [indexLoading, setIndexLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [currentTime, setCurrentTime] = useState(new Date());
    const [lastRefreshed, setLastRefreshed] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const normalizedCap = (cap) => (cap || '').toString().trim().toLowerCase();
    const num = (v) => (v == null ? 0 : Number(v));

    const filteredTopGainers = (topMovers.top_active || [])
        .filter((item) => {
            const matchesCap = selectedCap === 'all' || normalizedCap(item.cap_segment) === String(selectedCap).toLowerCase();
            return matchesCap && num(item.change_percent) > 0;
        })
        .sort((a, b) => num(b.change_percent) - num(a.change_percent))
        .slice(0, 10);

    const filteredTopLosers = (topMovers.top_active || [])
        .filter((item) => {
            const matchesCap = selectedCap === 'all' || normalizedCap(item.cap_segment) === String(selectedCap).toLowerCase();
            return matchesCap && num(item.change_percent) < 0;
        })
        .sort((a, b) => num(a.change_percent) - num(b.change_percent))
        .slice(0, 10);

    const loadIndexData = async () => {
        setIndexError('');
        setIndexLoading(true);
        try {
            await fetchStock('^NSEI');
            await fetchStock('^NSEBANK');
            const [niftyRes, bankRes] = await Promise.all([
                getStock('^NSEI'),
                getStock('^NSEBANK'),
            ]);
            setNifty50Data(niftyRes.data);
            setBankNiftyData(bankRes.data);
        } catch (err) {
            setIndexError('Unable to load Nifty index data.');
        } finally {
            setIndexLoading(false);
        }
    };

    const loadTopMovers = async () => {
        setMarketError('');
        try {
            const response = await getTopMovers();
            setTopMovers(response.data || { top_active: [], most_gained: [], most_lost: [] });
        } catch {
            setMarketError('Unable to load live market movers.');
        }
    };

    const handleRefreshAll = async () => {
        setRefreshing(true);
        try {
            await Promise.all([loadTopMovers(), loadIndexData()]);
            setLastRefreshed(new Date());
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadTopMovers();
        loadIndexData();
    }, []);

    const isMarketOpen = () => {
        const day = currentTime.getDay();
        if (day === 0 || day === 6) return false;

        const mins = currentTime.getHours() * 60 + currentTime.getMinutes();
        return mins >= (9 * 60 + 15) && mins <= (15 * 60 + 30);
    };

    const marketOpen = isMarketOpen();

    const formatCurrency = (val) => {
        if (val == null || Number.isNaN(val)) return '—';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(val);
    };

    const formatClockTime = (date) => {
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
        });
    };

    const formatFullDate = (date) => {
        return date.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const getIndexPoints = (indexData) => {
        if (!indexData) return null;
        const history = Array.isArray(indexData) ? indexData : (indexData.history || []);
        if (!history || history.length === 0) return null;

        const latest = history[history.length - 1];
        const prev = history.length > 1 ? history[history.length - 2] : null;

        const currentPrice = Number(latest.close_price != null ? latest.close_price : (indexData.current_price || 0));
        const prevPrice = prev ? Number(prev.close_price) : currentPrice;
        const changeAmt = currentPrice - prevPrice;
        const changePct = prevPrice > 0 ? (changeAmt / prevPrice) * 100 : 0;

        return {
            points: currentPrice,
            change: changeAmt,
            changePct: changePct
        };
    };

    return (
        <div className="app-shell">
            <Navbar />
            <div className="dashboard-page">

                <section className="hero-card dashboard-hero-card">
                    <div className="hero-copy">
                        <p className="eyebrow">AXIOMITY • INTELLIGENT INVESTING</p>
                        <h1>Trade with clarity.</h1>
                        <p>Review live market movers, Nifty index trends, and manage your portfolio.</p>
                    </div>

                    <div className="dashboard-clock-widget">
                        <div className="clock-market-status-row">
                            <div className={`market-live-pill ${marketOpen ? 'open' : 'closed'}`}>
                                <span className={`live-pulse-dot ${marketOpen ? 'pulse' : ''}`}></span>
                                <span>{marketOpen ? 'NSE/BSE MARKET OPEN' : 'NSE/BSE MARKET CLOSED'}</span>
                            </div>

                            <button
                                type="button"
                                className="dashboard-refresh-btn"
                                onClick={handleRefreshAll}
                                disabled={refreshing || indexLoading}
                                title="Refresh live market feeds"
                            >
                                <span className={`refresh-icon ${refreshing ? 'spinning' : ''}`}>↺</span>
                                <span>{refreshing ? 'Refreshing…' : 'Refresh'}</span>
                            </button>
                        </div>

                        <div className="clock-time-display">
                            <div className="clock-main-time">
                                <span className="clock-time-mono">{formatClockTime(currentTime)}</span>
                                <span className="clock-tz-badge">IST</span>
                            </div>
                            <div className="clock-date-sub">
                                {formatFullDate(currentTime)}
                            </div>
                        </div>

                        <div className="clock-last-refreshed-bar">
                            <span className="refreshed-label">Last Refreshed:</span>
                            <strong className="refreshed-val-mono">{formatClockTime(lastRefreshed)}</strong>
                        </div>
                    </div>
                </section>

                {marketError && <div className="status error">{marketError}</div>}
                {indexError && <div className="status error">{indexError}</div>}

                <section className="index-graphs-grid">
                    <div className="index-card">
                        <div className="card-header index-card-header">
                            <div>
                                <p className="eyebrow">NIFTY 50</p>
                                <h2>Market benchmark</h2>
                            </div>

                            {(() => {
                                const stats = getIndexPoints(nifty50Data);
                                if (!stats) return null;
                                const isUp = stats.change >= 0;
                                return (
                                    <div className="index-header-points">
                                        <strong className="index-points-num">
                                            {stats.points.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </strong>
                                        <span className={`index-points-badge ${isUp ? 'bullish' : 'bearish'}`}>
                                            {isUp ? '▲ +' : '▼ '}
                                            {stats.change.toFixed(2)} ({stats.changePct.toFixed(2)}%)
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                        {indexLoading ? (
                            <div style={{ height: '320px', display: 'grid', placeItems: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                Loading Nifty 50 chart…
                            </div>
                        ) : nifty50Data ? (
                            <StockChart data={nifty50Data} compact={true} />
                        ) : (
                            <p style={{ color: '#94a3b8', padding: '24px 0', textAlign: 'center' }}>
                                Nifty 50 data is temporarily unavailable.
                            </p>
                        )}
                    </div>

                    <div className="index-card">
                        <div className="card-header index-card-header">
                            <div>
                                <p className="eyebrow">NIFTY BANK</p>
                                <h2>Banking index</h2>
                            </div>

                            {(() => {
                                const stats = getIndexPoints(bankNiftyData);
                                if (!stats) return null;
                                const isUp = stats.change >= 0;
                                return (
                                    <div className="index-header-points">
                                        <strong className="index-points-num">
                                            {stats.points.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </strong>
                                        <span className={`index-points-badge ${isUp ? 'bullish' : 'bearish'}`}>
                                            {isUp ? '▲ +' : '▼ '}
                                            {stats.change.toFixed(2)} ({stats.changePct.toFixed(2)}%)
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                        {indexLoading ? (
                            <div style={{ height: '320px', display: 'grid', placeItems: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                Loading Bank Nifty chart…
                            </div>
                        ) : bankNiftyData ? (
                            <StockChart data={bankNiftyData} compact={true} />
                        ) : (
                            <p style={{ color: '#94a3b8', padding: '24px 0', textAlign: 'center' }}>
                                Bank Nifty data is temporarily unavailable.
                            </p>
                        )}
                    </div>
                </section>

                <section className="top-movers-filter">
                    <div className="cap-selector">
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'large', label: 'Large Cap' },
                            { key: 'mid', label: 'Mid Cap' },
                            { key: 'small', label: 'Small Cap' },
                        ].map((cap) => (
                            <button
                                key={cap.key}
                                type="button"
                                className={`cap-button ${selectedCap === cap.key ? 'active' : ''}`}
                                onClick={() => setSelectedCap(cap.key)}
                            >
                                {cap.label}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="top-movers-grid">
                    <div className="movers-card">
                        <div className="card-header">
                            <div>
                                <p className="eyebrow">TOP GAINERS</p>
                            </div>
                        </div>

                        <div className="movers-list">
                            {filteredTopGainers.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                                    No gainers found for this cap today.
                                </div>
                            ) : (
                                filteredTopGainers.map((item) => {
                                    const chgPct = num(item.change_percent);
                                    const chgAmt = num(item.change);
                                    const ltp = num(item.current_price);
                                    return (
                                        <Link
                                            to={`/analysis?symbol=${item.symbol}`}
                                            key={`${item.symbol}-${item.exchange || 'x'}`}
                                            className="mover-row"
                                            title={`Click to analyze ${item.symbol}`}
                                        >
                                            <div>
                                                <strong>{item.name || item.display_name || item.symbol} ({item.symbol})</strong>
                                                <p className="muted">
                                                    {item.exchange || 'NSE'} · {(item.cap_segment || 'MID').toUpperCase()}
                                                </p>
                                            </div>

                                            <div className="mover-value">
                                                <span className="positive">
                                                    ▲ {formatCurrency(Math.abs(chgAmt))} (+{chgPct.toFixed(2)}%)
                                                </span>
                                                <span>{formatCurrency(ltp)}</span>
                                            </div>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="movers-card">
                        <div className="card-header">
                            <div>
                                <p className="eyebrow">TOP LOSERS</p>
                            </div>
                        </div>

                        <div className="movers-list">
                            {filteredTopLosers.length === 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                                    No losers found for this cap today.
                                </div>
                            ) : (
                                filteredTopLosers.map((item) => {
                                    const chgPct = num(item.change_percent);
                                    const chgAmt = num(item.change);
                                    const ltp = num(item.current_price);
                                    return (
                                        <Link
                                            to={`/analysis?symbol=${item.symbol}`}
                                            key={`${item.symbol}-${item.exchange || 'x'}`}
                                            className="mover-row"
                                            title={`Click to analyze ${item.symbol}`}
                                        >
                                            <div>
                                                <strong>{item.name || item.display_name || item.symbol} ({item.symbol})</strong>
                                                <p className="muted">
                                                    {item.exchange || 'NSE'} · {(item.cap_segment || 'MID').toUpperCase()}
                                                </p>
                                            </div>

                                            <div className="mover-value">
                                                <span className="negative">
                                                    ▼ {formatCurrency(Math.abs(chgAmt))} ({chgPct.toFixed(2)}%)
                                                </span>
                                                <span>{formatCurrency(ltp)}</span>
                                            </div>
                                        </Link>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}

export default Dashboard;
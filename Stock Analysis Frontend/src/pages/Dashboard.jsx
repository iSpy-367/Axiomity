import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StockChart from '../components/StockChart';
import Navbar from '../components/Navbar';
import { fetchStock, getStock, getTopMovers } from '../services/api';

function Dashboard() {
    const [error, setError] = useState('');
    const [topMovers, setTopMovers] = useState({ top_active: [], most_gained: [], most_lost: [] });
    const [selectedCap, setSelectedCap] = useState('all');
    const [marketError, setMarketError] = useState('');
    const [nifty50Data, setNifty50Data] = useState(null);
    const [bankNiftyData, setBankNiftyData] = useState(null);
    const [indexError, setIndexError] = useState('');

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

    // Debug logs to diagnose misclassification (remove in production)
    console.log('SELECTED_CAP', selectedCap);
    console.log('FILTERED_GAINERS', (filteredTopGainers || []).map(i => ({ symbol: i.symbol, cap: i.cap_segment, change: num(i.change_percent) })));
    console.log('FILTERED_LOSERS', (filteredTopLosers || []).map(i => ({ symbol: i.symbol, cap: i.cap_segment, change: num(i.change_percent) })));
    const [indexLoading, setIndexLoading] = useState(false);

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

    useEffect(() => {
        const loadTopMovers = async () => {
            setMarketError('');
            try {
                const response = await getTopMovers();
                // Log the raw movers payload for debugging misclassification issues
                console.log('TOP_MOVERS_PAYLOAD', response.data);
                setTopMovers(response.data || { top_active: [], most_gained: [], most_lost: [] });
            } catch {
                setMarketError('Unable to load live market movers.');
            }
        };

        loadTopMovers();
        loadIndexData();
    }, []);

    return (
        <div className="app-shell">
            <Navbar />
            <div className="dashboard-page">
                <section className="hero-card">
                    <div className="hero-copy">
                        <p className="eyebrow">Axiomity • intelligent investing</p>
                        <h1>Trade with clarity.</h1>
                        <p>Review live market movers, Nifty index trends, and manage your portfolio from one premium trading workspace.</p>
                    </div>
                    <div className="search-card">

                    </div>
                </section>

                {error && <div className="status error">{error}</div>}
                {marketError && <div className="status error">{marketError}</div>}
                {indexError && <div className="status error">{indexError}</div>}

                <section className="index-graphs-grid">
                    <div className="index-card">
                        <div className="card-header">
                            <div>
                                <p className="eyebrow">Nifty 50</p>
                                <h2>Market benchmark</h2>
                            </div>
                        </div>
                        {indexLoading ? (
                            <p>Loading Nifty 50 chart…</p>
                        ) : nifty50Data ? (
                            <StockChart data={nifty50Data} />
                        ) : (
                            <p className="muted">Nifty 50 data is not available.</p>
                        )}
                    </div>

                    <div className="index-card">
                        <div className="card-header">
                            <div>
                                <p className="eyebrow">Nifty Bank</p>
                                <h2>Banking index</h2>
                            </div>
                        </div>
                        {indexLoading ? (
                            <p>Loading Bank Nifty chart…</p>
                        ) : bankNiftyData ? (
                            <StockChart data={bankNiftyData} />
                        ) : (
                            <p className="muted">Bank Nifty data is not available.</p>
                        )}
                    </div>
                </section>

                <section className="top-movers-filter">
                    <div className="cap-selector">
                        {['all', 'large', 'mid', 'small'].map((cap) => (
                            <button
                                key={cap}
                                type="button"
                                className={`cap-button ${selectedCap === cap ? 'active' : ''}`}
                                onClick={() => setSelectedCap(cap)}
                            >
                                {cap === 'all' ? 'All' : cap === 'large' ? 'Large Cap' : cap === 'mid' ? 'Mid Cap' : 'Small Cap'}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="top-movers-grid">
                    <div className="movers-card">
                        <div className="card-header">
                            <div>
                                <p className="eyebrow">Top Gainers</p>
                            </div>
                        </div>
                        <div className="movers-list">
                            {filteredTopGainers.map((item) => (
                                <div key={`${item.symbol}-${item.exchange || item.currency || 'x'}`} className="mover-row">
                                    <div>
                                        <strong>{item.display_name || `${item.name} (${item.symbol})`}</strong>
                                        <p className="muted">
                                            {item.exchange || item.currency} · {(item.cap_segment || 'unknown').toUpperCase()}
                                        </p>
                                    </div>
                                    <div className="mover-value">
                                        <span className="positive">₹{Math.abs(num(item.change)).toFixed(2)} ({Math.abs(num(item.change_percent)).toFixed(2)}%)</span>
                                        <span>₹{num(item.current_price).toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="movers-card">
                        <div className="card-header">
                            <div>
                                <p className="eyebrow">Top Losers</p>
                            </div>
                        </div>
                        <div className="movers-list">
                            {filteredTopLosers.length === 0 ? (
                                <div className="portfolio-empty">No losers found for this cap today.</div>
                            ) : (
                                filteredTopLosers.map((item) => (
                                    <div key={`${item.symbol}-${item.exchange || item.currency || 'x'}`} className="mover-row">
                                        <div>
                                            <strong>{item.display_name || `${item.name} (${item.symbol})`}</strong>
                                            <p className="muted">
                                                {item.exchange || item.currency} · {item.cap_segment.toUpperCase()}
                                            </p>
                                        </div>
                                        <div className="mover-value">
                                            <span className="negative">₹{Math.abs(num(item.change)).toFixed(2)} ({Math.abs(num(item.change_percent)).toFixed(2)}%)</span>
                                            <span>₹{num(item.current_price).toFixed(2)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}

export default Dashboard;
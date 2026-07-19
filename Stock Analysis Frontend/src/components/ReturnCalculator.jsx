import React, { useState, useMemo } from 'react';

function findClosestByDate(history, dateStr) {
    if (!history || !history.length) return null;
    const target = new Date(dateStr);
    // find the record with date <= target (closest previous) or the earliest after
    let best = null;
    for (const h of history) {
        const d = new Date(h.date);
        if (!best) best = h;
        if (d <= target) {
            if (!best || new Date(best.date) < d) best = h;
        }
    }
    return best;
}

export default function ReturnCalculator({ history = [], currentPrice }) {
    const [quantity, setQuantity] = useState(1);
    const [buyPrice, setBuyPrice] = useState('');
    const [buyDate, setBuyDate] = useState('');

    const resolvedBuy = useMemo(() => {
        if (buyPrice) return { price: Number(buyPrice), date: null };
        if (buyDate) {
            const rec = findClosestByDate(history, buyDate);
            if (rec) return { price: Number(rec.close_price), date: rec.date };
        }
        return null;
    }, [buyPrice, buyDate, history]);

    const result = useMemo(() => {
        const q = Number(quantity) || 0;
        const cp = Number(currentPrice) || 0;
        if (!resolvedBuy || !q || !resolvedBuy.price) return null;
        const bp = Number(resolvedBuy.price) || 0;
        const profit = (cp - bp) * q;
        const returnPct = bp > 0 ? ((cp / bp - 1) * 100) : 0;
        let years = null;
        if (resolvedBuy.date) {
            const d0 = new Date(resolvedBuy.date);
            const d1 = new Date();
            years = Math.max(1/365, (d1 - d0) / (365 * 24 * 3600 * 1000));
        }
        const cagr = years ? (Math.pow(cp / bp, 1 / years) - 1) * 100 : null;
        return { profit, returnPct, cagr };
    }, [resolvedBuy, quantity, currentPrice]);

    return (
        <div className="metric-card" style={{ marginTop: '16px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px' }}>
            <p className="eyebrow" style={{ marginBottom: '12px' }}>Return Calculator</p>
            <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                    <label>Shares Quantity</label>
                    <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <label>Buy Price (₹)</label>
                        <input type="number" step="0.01" placeholder="e.g. 2500.00" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} />
                    </div>
                    <div>
                        <label>Or Buy Date</label>
                        <input type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} style={{ padding: '8px 12px' }} />
                    </div>
                </div>

                {!result ? (
                    <div className="muted" style={{ fontSize: '0.85rem', marginTop: '10px', textAlign: 'center', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px dashed #cfe0ff' }}>
                        Enter quantity and buy price/date to calculate projection returns.
                    </div>
                ) : (
                    <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>PROFIT</span>
                            <strong className={result.profit >= 0 ? "positive" : "negative"} style={{ fontSize: '0.98rem', fontWeight: 700 }}>
                                ₹{result.profit.toFixed(2)}
                            </strong>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>RETURNS</span>
                            <strong className={result.returnPct >= 0 ? "positive" : "negative"} style={{ fontSize: '0.98rem', fontWeight: 700 }}>
                                {result.returnPct.toFixed(2)}%
                            </strong>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, marginBottom: '4px' }}>CAGR</span>
                            <strong style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                                {result.cagr != null ? `${result.cagr.toFixed(2)}%` : '—'}
                            </strong>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

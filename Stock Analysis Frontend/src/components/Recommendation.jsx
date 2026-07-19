import React from 'react';

function Recommendation({ data = {} }) {
    const rec = data.recommendation || 'Hold';

    return (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '20px' }}>
            <div className="recommendation-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 className="eyebrow" style={{ margin: 0 }}>Analysis Result</h3>
                <div className={`rec-badge ${rec.toLowerCase()}`} style={{ margin: 0 }}>
                    {rec.toUpperCase()}
                </div>
            </div>

            <div className="technical-grade-box" style={{ margin: '14px 0', border: 'none', background: '#f8fafc', padding: '14px 16px' }}>
                <div className="confidence-wrapper">
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475467' }}>Model Confidence: {data.confidence ?? '—'}%</span>
                    <div className="progress-bar-bg" style={{ background: '#e2e8f0' }}>
                        <div className="progress-bar-fill" style={{ width: `${data.confidence ?? 50}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="metric-list" style={{ marginTop: '14px', border: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.88rem', fontWeight: 500 }}>RSI (14)</span>
                    <strong style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>{data.rsi ?? '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.88rem', fontWeight: 500 }}>MACD</span>
                    <strong style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>{data.macd ?? '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.88rem', fontWeight: 500 }}>MA20 Trend</span>
                    <strong style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>{data.ma20 ?? '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: 'none' }}>
                    <span style={{ color: '#64748b', fontSize: '0.88rem', fontWeight: 500 }}>MA50 Trend</span>
                    <strong style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: 700 }}>{data.ma50 ?? '—'}</strong>
                </div>
            </div>
        </div>
    );
}

export default Recommendation;
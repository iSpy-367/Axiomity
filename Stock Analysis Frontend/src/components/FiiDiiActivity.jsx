import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getFiiDiiActivity } from '../services/api';

function formatCr(val) {
    if (val == null || Number.isNaN(val)) return '₹0.00 Cr';
    const num = Number(val);
    const sign = num > 0 ? '+' : num < 0 ? '-' : '';
    return `${sign}₹${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
}

function FiiDiiActivity() {
    const [days, setDays] = useState(30);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const loadData = useCallback(() => {
        setLoading(true);
        setError('');

        getFiiDiiActivity(days)
            .then((res) => {
                setData(res.data);
                setLoading(false);
            })
            .catch(() => {
                setError('Unable to load institutional flow data.');
                setLoading(false);
            });
    }, [days]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const rawRecords = data?.data;
    const records = useMemo(() => rawRecords || [], [rawRecords]);
    const summary = data?.summary || {};
    const asOf = data?.as_of || 'Today';

    const latestRecord = records[0] || {};
    const latestFii = latestRecord.fii_net_value || 0;
    const latestDii = latestRecord.dii_net_value || 0;
    const latestTotal = latestFii + latestDii;

    const chartWidth = 960;
    const chartHeight = 260;
    const padding = { top: 20, right: 24, bottom: 40, left: 64 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const { maxAbsVal, zeroY, barWidth, chartPoints } = useMemo(() => {
        if (!records.length) {
            return { maxAbsVal: 1000, zeroY: innerHeight / 2, barWidth: 8, chartPoints: [] };
        }

        const chrono = [...records].reverse();
        let maxVal = 1000;
        chrono.forEach((r) => {
            maxVal = Math.max(maxVal, Math.abs(r.fii_net_value || 0), Math.abs(r.dii_net_value || 0));
        });

        maxVal = Math.ceil(maxVal * 1.15);

        const zero = padding.top + innerHeight / 2;
        const slotWidth = innerWidth / chrono.length;
        const bWidth = Math.max(3, Math.min(14, slotWidth * 0.36));

        const points = chrono.map((r, i) => {
            const centerX = padding.left + i * slotWidth + slotWidth / 2;
            const fiiNet = r.fii_net_value || 0;
            const diiNet = r.dii_net_value || 0;

            const scaleVal = (val) => (val / maxVal) * (innerHeight / 2);

            const fiiH = Math.abs(scaleVal(fiiNet));
            const fiiY = fiiNet >= 0 ? zero - fiiH : zero;

            const diiH = Math.abs(scaleVal(diiNet));
            const diiY = diiNet >= 0 ? zero - diiH : zero;

            return {
                record: r,
                fiiX: centerX - bWidth - 1,
                fiiY,
                fiiH: Math.max(2, fiiH),
                fiiNet,
                diiX: centerX + 1,
                diiY,
                diiH: Math.max(2, diiH),
                diiNet,
                centerX,
                dateLabel: r.date ? r.date.split('-').slice(1).join('/') : '',
            };
        });

        return { maxAbsVal: maxVal, zeroY: zero, barWidth: bWidth, chartPoints: points };
    }, [records, innerHeight, innerWidth, padding.left, padding.top]);

    return (
        <section className="fii-dii-section-card">
            <div className="fii-dii-header">
                <div>
                    <span className="fintech-eyebrow">INSTITUTIONAL LIQUIDITY</span>
                    <h2 className="card-title">FII & DII Inflow / Outflow Analytics</h2>
                    <p className="fii-dii-subtitle">
                        Daily net buying and selling turnover of Foreign & Domestic Institutional Investors in Indian Equities (₹Cr)
                    </p>
                </div>
                <div className="fii-dii-toolbar">
                    <div className="fii-dii-days-pill">
                        {[7, 15, 30].map((d) => (
                            <button
                                key={d}
                                className={`pill-btn ${days === d ? 'active' : ''}`}
                                onClick={() => setDays(d)}
                            >
                                {d} Days
                            </button>
                        ))}
                    </div>
                    <button
                        className="fii-refresh-btn"
                        onClick={loadData}
                        disabled={loading}
                        title="Refresh FII/DII Data"
                    >
                        {loading ? 'Refreshing…' : '↻ Refresh'}
                    </button>
                </div>
            </div>

            <div className="fii-dii-kpi-grid">
                <div className="fii-dii-kpi-card">
                    <span className="kpi-label">Latest FII Net Inflow</span>
                    <div className={`kpi-val ${latestFii >= 0 ? 'text-up' : 'text-down'}`}>
                        {formatCr(latestFii)}
                    </div>
                </div>

                <div className="fii-dii-kpi-card">
                    <span className="kpi-label">Latest DII Net Inflow</span>
                    <div className={`kpi-val ${latestDii >= 0 ? 'text-up' : 'text-down'}`}>
                        {formatCr(latestDii)}
                    </div>
                </div>

                <div className="fii-dii-kpi-card">
                    <span className="kpi-label">Combined Daily Net</span>
                    <div className={`kpi-val ${latestTotal >= 0 ? 'text-up' : 'text-down'}`}>
                        {formatCr(latestTotal)}
                    </div>
                </div>

                <div className="fii-dii-kpi-card">
                    <span className="kpi-label">30-Day Cumulative Net</span>
                    <div className={`kpi-val ${summary.cumulative_net_30d >= 0 ? 'text-up' : 'text-down'}`}>
                        {formatCr(summary.cumulative_net_30d)}
                    </div>
                </div>
            </div>

            <div className="fii-dii-chart-container">
                <div className="fii-dii-legend-bar">
                    <div className="legend-items">
                        <span className="legend-item">
                            <span className="legend-box fii-buy" /> FII Net Inflow (+)
                        </span>
                        <span className="legend-item">
                            <span className="legend-box fii-sell" /> FII Net Outflow (-)
                        </span>
                        <span className="legend-item">
                            <span className="legend-box dii-buy" /> DII Net Inflow (+)
                        </span>
                        <span className="legend-item">
                            <span className="legend-box dii-sell" /> DII Net Outflow (-)
                        </span>
                    </div>
                    <div className="as-of-tag">Data updated: {asOf}</div>
                </div>

                {loading ? (
                    <div className="fii-chart-loading">Loading institutional flow charts…</div>
                ) : error ? (
                    <div className="fii-chart-error">{error}</div>
                ) : (
                    <div className="fii-svg-chart-wrapper">
                        <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            width="100%"
                            height="240"
                            className="fii-dii-svg"
                        >
                            <rect
                                x="0"
                                y="0"
                                width={chartWidth}
                                height={chartHeight}
                                rx="10"
                                fill="var(--chart-bg, #ffffff)"
                                stroke="var(--chart-border, #e2e8f0)"
                                strokeWidth="1"
                            />

                            <line
                                x1={padding.left}
                                x2={chartWidth - padding.right}
                                y1={padding.top + 10}
                                y2={padding.top + 10}
                                stroke="var(--chart-grid, #f1f5f9)"
                                strokeDasharray="3 3"
                            />
                            <text
                                x={padding.left - 8}
                                y={padding.top + 14}
                                textAnchor="end"
                                fontSize="10"
                                fontWeight="700"
                                fill="var(--chart-text, #64748b)"
                                className="axis-mono-label"
                            >
                                +₹{(maxAbsVal / 1000).toFixed(1)}k Cr
                            </text>

                            <line
                                x1={padding.left}
                                x2={chartWidth - padding.right}
                                y1={zeroY}
                                y2={zeroY}
                                stroke="var(--border-strong, #cbd5e1)"
                                strokeWidth="1.5"
                            />
                            <text
                                x={padding.left - 8}
                                y={zeroY + 4}
                                textAnchor="end"
                                fontSize="10"
                                fontWeight="800"
                                fill="var(--chart-text, #64748b)"
                                className="axis-mono-label"
                            >
                                ₹0
                            </text>

                            <line
                                x1={padding.left}
                                x2={chartWidth - padding.right}
                                y1={padding.top + innerHeight - 10}
                                y2={padding.top + innerHeight - 10}
                                stroke="var(--chart-grid, #f1f5f9)"
                                strokeDasharray="3 3"
                            />
                            <text
                                x={padding.left - 8}
                                y={padding.top + innerHeight - 6}
                                textAnchor="end"
                                fontSize="10"
                                fontWeight="700"
                                fill="var(--chart-text, #64748b)"
                                className="axis-mono-label"
                            >
                                -₹{(maxAbsVal / 1000).toFixed(1)}k Cr
                            </text>

                            {chartPoints.map((pt, idx) => {
                                const isHovered = hoveredIndex === idx;
                                return (
                                    <g
                                        key={pt.record.date || idx}
                                        onMouseEnter={() => setHoveredIndex(idx)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {isHovered && (
                                            <rect
                                                x={pt.centerX - barWidth * 1.6}
                                                y={padding.top}
                                                width={barWidth * 3.2}
                                                height={innerHeight}
                                                fill="var(--primary-blue-soft)"
                                                rx="4"
                                            />
                                        )}

                                        <rect
                                            x={pt.fiiX}
                                            y={pt.fiiY}
                                            width={barWidth}
                                            height={pt.fiiH}
                                            rx="2"
                                            fill={pt.fiiNet >= 0 ? 'var(--emerald-green, #10b981)' : 'var(--crimson-red, #ef4444)'}
                                            opacity={isHovered ? 1 : 0.88}
                                        />

                                        <rect
                                            x={pt.diiX}
                                            y={pt.diiY}
                                            width={barWidth}
                                            height={pt.diiH}
                                            rx="2"
                                            fill={pt.diiNet >= 0 ? '#06b6d4' : '#f59e0b'}
                                            opacity={isHovered ? 1 : 0.88}
                                        />

                                        {(chartPoints.length <= 15 || idx % 2 === 0) && (
                                            <text
                                                x={pt.centerX}
                                                y={padding.top + innerHeight + 16}
                                                textAnchor="middle"
                                                fontSize="9.5"
                                                fontWeight="600"
                                                fill="var(--chart-text, #64748b)"
                                                className="axis-mono-label"
                                            >
                                                {pt.dateLabel}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>

                        {hoveredIndex != null && chartPoints[hoveredIndex] && (
                            <div className="fii-hover-hud">
                                <strong>{chartPoints[hoveredIndex].record.date}</strong>
                                <span>
                                    FII Net: <strong className={chartPoints[hoveredIndex].fiiNet >= 0 ? 'text-up' : 'text-down'}>
                                        {formatCr(chartPoints[hoveredIndex].fiiNet)}
                                    </strong>
                                </span>
                                <span>
                                    DII Net: <strong className={chartPoints[hoveredIndex].diiNet >= 0 ? 'text-up' : 'text-down'}>
                                        {formatCr(chartPoints[hoveredIndex].diiNet)}
                                    </strong>
                                </span>
                                <span>
                                    Total Net: <strong className={chartPoints[hoveredIndex].record.total_net_value >= 0 ? 'text-up' : 'text-down'}>
                                        {formatCr(chartPoints[hoveredIndex].record.total_net_value)}
                                    </strong>
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="fii-dii-table-shell">
                <div className="table-head-row">
                    <h3 className="table-title">Day-Wise Institutional Breakdown (₹ Cr)</h3>
                </div>
                <div className="fii-table-scroll">
                    <table className="fii-dii-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>FII Buy (₹ Cr)</th>
                                <th>FII Sell (₹ Cr)</th>
                                <th>FII Net (₹ Cr)</th>
                                <th>DII Buy (₹ Cr)</th>
                                <th>DII Sell (₹ Cr)</th>
                                <th>DII Net (₹ Cr)</th>
                                <th>Combined Net</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((r, idx) => (
                                <tr key={r.date || idx}>
                                    <td className="date-cell">{r.date}</td>
                                    <td className="mono-num">{Number(r.fii_buy_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="mono-num">{Number(r.fii_sell_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        <span className={`fii-net-pill ${r.fii_net_value >= 0 ? 'up' : 'down'}`}>
                                            {formatCr(r.fii_net_value)}
                                        </span>
                                    </td>
                                    <td className="mono-num">{Number(r.dii_buy_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="mono-num">{Number(r.dii_sell_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td>
                                        <span className={`fii-net-pill ${r.dii_net_value >= 0 ? 'up' : 'down'}`}>
                                            {formatCr(r.dii_net_value)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`fii-net-pill combined ${r.total_net_value >= 0 ? 'up' : 'down'}`}>
                                            {formatCr(r.total_net_value)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

export default FiiDiiActivity;

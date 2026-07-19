import React from 'react';

function StockChart({ data }) {
    const history = data.history || [];
    const prediction = data.prediction || [];
    const chartData = history.slice(-30);
    const combined = [...chartData, ...prediction.map(p => ({ date: p.date, predicted_price: p.predicted_price }))];

    const [hoveredIndex, setHoveredIndex] = React.useState(null);

    if (!chartData.length && !prediction.length) {
        return <p className="muted">No chart or prediction data available.</p>;
    }

    const width = 800;
    const height = 450;
    const padding = { top: 20, right: 25, bottom: 45, left: 80 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    // determine min/max across history candles and predicted prices
    const historyLows = chartData.map((item) => item.low);
    const historyHighs = chartData.map((item) => item.high);
    const predictedPrices = prediction.map(p => p.predicted_price);
    const allPrices = [...historyLows, ...historyHighs, ...predictedPrices.filter(v => v != null)];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const range = maxPrice - minPrice || 1;
    const totalPoints = Math.max(1, chartData.length + prediction.length);
    const step = innerWidth / totalPoints;
    const candleWidth = Math.max(6, Math.min(12, step * 0.55));

    const yScale = (price) => innerHeight - ((price - minPrice) / range) * innerHeight;
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
        value: Number((maxPrice - ratio * range).toFixed(2)),
        y: yScale(maxPrice - ratio * range),
    }));

    const activeIndex = hoveredIndex !== null ? hoveredIndex : (chartData.length > 0 ? chartData.length - 1 : 0);
    const activePoint = combined[activeIndex] || {};
    const isPrediction = activePoint.predicted_price !== undefined && activePoint.close_price === undefined;

    return (
        <div style={{ marginTop: '20px' }}>
            <div className="chart-hud">
                <div className="hud-date">{activePoint.date}</div>
                {isPrediction ? (
                    <div className="hud-metric prediction">
                        <span className="hud-label">FORECAST</span>
                        <span className="hud-value">{activePoint.predicted_price?.toFixed(2)}</span>
                    </div>
                ) : (
                    <div className="hud-metrics">
                        <div className="hud-metric">
                            <span className="hud-label">O</span>
                            <span className="hud-value">{activePoint.open_price?.toFixed(2)}</span>
                        </div>
                        <div className="hud-metric">
                            <span className="hud-label">H</span>
                            <span className="hud-value">{activePoint.high?.toFixed(2)}</span>
                        </div>
                        <div className="hud-metric">
                            <span className="hud-label">L</span>
                            <span className="hud-value">{activePoint.low?.toFixed(2)}</span>
                        </div>
                        <div className="hud-metric">
                            <span className="hud-label">C</span>
                            <span className={activePoint.close_price >= activePoint.open_price ? "hud-value positive-val" : "hud-value negative-val"}>
                                {activePoint.close_price?.toFixed(2)}
                            </span>
                        </div>
                        <div className="hud-metric">
                            <span className="hud-label">V</span>
                            <span className="hud-value">{activePoint.volume ? (activePoint.volume / 1000000).toFixed(2) + 'M' : '0.00M'}</span>
                        </div>
                    </div>
                )}
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
                <defs>
                    <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2357d8" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#2357d8" stopOpacity="0.00" />
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width={width} height={height} rx="18" fill="#ffffff" />
                <g transform={`translate(${padding.left},${padding.top})`}>
                    {yTicks.map((tick) => (
                        <g key={tick.value}>
                            <line x1="0" x2={innerWidth} y1={tick.y} y2={tick.y} stroke="#e2e8f0" strokeDasharray="4 4" />
                            <text x="-14" y={tick.y + 4} textAnchor="end" fontSize="13" fontWeight="600" fill="#475467">
                                {tick.value}
                            </text>
                        </g>
                    ))}

                    {/* Gradient Area Path */}
                    {chartData.length > 0 && (() => {
                        const firstX = step / 2;
                        const lastX = (chartData.length - 1) * step + step / 2;
                        const linePoints = chartData.map((item, index) => {
                            const x = index * step + step / 2;
                            const y = yScale(item.close_price);
                            return `${x},${y}`;
                        }).join(' L ');
                        const d = `M ${firstX},${innerHeight} L ${linePoints} L ${lastX},${innerHeight} Z`;
                        return <path d={d} fill="url(#chart-gradient)" pointerEvents="none" />;
                    })()}

                    {/* Historical Trend Line */}
                    {chartData.length > 0 && (() => {
                        const pointsStr = chartData.map((item, index) => {
                            const x = index * step + step / 2;
                            const y = yScale(item.close_price);
                            return `${x},${y}`;
                        }).join(' ');
                        return (
                            <polyline
                                points={pointsStr}
                                fill="none"
                                stroke="#2357d8"
                                strokeWidth="3.5"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        );
                    })()}

                    {/* Prediction Line */}
                    {prediction.length > 0 && (() => {
                        const predPoints = [];
                        if (chartData.length > 0) {
                            const lastHist = chartData[chartData.length - 1];
                            const lastHistX = (chartData.length - 1) * step + step / 2;
                            const lastHistY = yScale(lastHist.close_price);
                            predPoints.push(`${lastHistX},${lastHistY}`);
                        }

                        prediction.forEach((p, idx) => {
                            const index = chartData.length + idx;
                            const x = index * step + step / 2;
                            const y = yScale(p.predicted_price);
                            predPoints.push(`${x},${y}`);
                        });

                        const pointsStr = predPoints.join(' ');
                        return (
                            <g>
                                <polyline
                                    points={pointsStr}
                                    fill="none"
                                    stroke="#2563eb"
                                    strokeWidth="2.5"
                                    strokeDasharray="5 5"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                                {prediction.map((p, idx) => {
                                    const index = chartData.length + idx;
                                    const x = index * step + step / 2;
                                    const y = yScale(p.predicted_price);
                                    return (
                                        <circle key={p.date} cx={x} cy={y} r="4.5" fill="#2563eb" />
                                    );
                                })}
                            </g>
                        );
                    })()}

                    {hoveredIndex !== null && (
                        <line
                            x1={hoveredIndex * step + step / 2}
                            x2={hoveredIndex * step + step / 2}
                            y1={0}
                            y2={innerHeight}
                            stroke="#64748b"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                            pointerEvents="none"
                        />
                    )}

                    {hoveredIndex !== null && (() => {
                        const point = combined[hoveredIndex];
                        if (!point) return null;
                        const price = point.close_price !== undefined ? point.close_price : point.predicted_price;
                        if (price === undefined) return null;
                        const x = hoveredIndex * step + step / 2;
                        const y = yScale(price);
                        const isPred = point.predicted_price !== undefined && point.close_price === undefined;
                        return (
                            <circle
                                cx={x}
                                cy={y}
                                r="6"
                                fill={isPred ? "#2563eb" : (point.close_price >= point.open_price ? "#16a34a" : "#dc2626")}
                                stroke="#ffffff"
                                strokeWidth="2"
                                pointerEvents="none"
                            />
                        );
                    })()}

                    <g>
                        {combined.map((item, index) => {
                            if (index % 4 !== 0) return null;
                            const x = index * step + step / 2;
                            const label = item.date ? item.date.slice(5) : '';
                            return (
                                <text key={`${item.date}-${index}`} x={x} y={innerHeight + 24} textAnchor="middle" fontSize="12" fontWeight="600" fill="#475467">
                                    {label}
                                </text>
                            );
                        })}
                    </g>

                    {/* Hover interactive areas overlaid on top */}
                    {combined.map((item, index) => {
                        const x = index * step;
                        return (
                            <rect
                                key={`hover-trigger-${index}`}
                                x={x}
                                y={0}
                                width={step}
                                height={innerHeight}
                                fill="transparent"
                                style={{ cursor: 'crosshair' }}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            />
                        );
                    })}
                </g>
            </svg>
        </div>
    );
}

export default StockChart;

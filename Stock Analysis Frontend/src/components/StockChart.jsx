import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';

const TIME_RANGES = [
    { label: '1W', value: '1W', points: 7 },
    { label: '1M', value: '1M', points: 30 },
    { label: '3M', value: '3M', points: 65 },
    { label: '6M', value: '6M', points: 130 },
    { label: '1Y', value: '1Y', points: 260 },
];

function StockChart({
    data = {},
    prediction: propPrediction,
    range: propRange,
    onRangeChange,
    initialToggles = {},
    compact = false,
}) {
    // 1. Data Normalization
    const rawHistory = useMemo(() => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.history)) return data.history;
        return [];
    }, [data]);

    const rawPrediction = useMemo(() => {
        if (Array.isArray(propPrediction)) return propPrediction;
        if (Array.isArray(data?.prediction)) return data.prediction;
        return [];
    }, [data, propPrediction]);

    const isIndex = useMemo(() => {
        const sym = (data?.symbol || data?.script_code || '').toString().trim();
        return sym.startsWith('^') || compact;
    }, [data, compact]);

    const currencyPrefix = isIndex ? '' : '₹';

    // 2. Time Range State
    const [selectedRange, setSelectedRange] = useState(propRange || '1M');
    useEffect(() => {
        if (propRange) setSelectedRange(propRange);
    }, [propRange]);

    const handleRangeSelect = (r) => {
        setSelectedRange(r);
        setZoomWindow([0, 1]); // Reset zoom on range change
        if (onRangeChange) onRangeChange(r);
    };

    // Slice dataset for the selected time range
    const rangeData = useMemo(() => {
        if (!rawHistory.length) return [];
        const cfg = TIME_RANGES.find(t => t.value === selectedRange) || TIME_RANGES[2];
        if (cfg.value === '1Y') return rawHistory;
        return rawHistory.slice(-cfg.points);
    }, [rawHistory, selectedRange]);

    // 3. Zoom & Pan State (fractional 0.0 to 1.0 of rangeData)
    const [zoomWindow, setZoomWindow] = useState([0, 1]);
    const [chartMode, setChartMode] = useState('line'); // 'line' | 'candlestick'
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [brushDrag, setBrushDrag] = useState(null); // { startX, currentX }
    const [panDrag, setPanDrag] = useState(null); // { startX, initialWindow }

    const svgRef = useRef(null);

    // Active visible data slice
    const visibleData = useMemo(() => {
        if (!rangeData.length) return [];
        const total = rangeData.length;
        const startIdx = Math.max(0, Math.floor(zoomWindow[0] * total));
        const endIdx = Math.min(total, Math.ceil(zoomWindow[1] * total));
        return rangeData.slice(startIdx, Math.max(startIdx + 2, endIdx));
    }, [rangeData, zoomWindow]);

    const isZoomed = zoomWindow[0] > 0.01 || zoomWindow[1] < 0.99;
    const isAtCurrentEnd = zoomWindow[1] >= 0.98;

    // Combine with prediction if visible window includes current date
    const combinedData = useMemo(() => {
        if (!isAtCurrentEnd || !rawPrediction.length) return visibleData;
        const preds = rawPrediction.map(p => ({
            date: p.date,
            predicted_price: p.predicted_price,
        }));
        return [...visibleData, ...preds];
    }, [visibleData, rawPrediction, isAtCurrentEnd]);

    // 4. Overlays & Technical Indicators State
    const [toggles, setToggles] = useState({
        ma20: true,
        ma50: false,
        bollinger: false,
        srLevels: false,
        volume: true,
        ...initialToggles,
    });

    const toggleFeature = (key) => {
        setToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Calculate moving averages & Bollinger Bands over visible data
    const technicals = useMemo(() => {
        if (!visibleData.length) {
            return { ma20: [], ma50: [], bbUpper: [], bbLower: [], support: null, resistance: null };
        }

        const closes = visibleData.map(c => Number(c.close_price || c.price || 0));
        const ma20 = [];
        const ma50 = [];
        const bbUpper = [];
        const bbLower = [];

        for (let i = 0; i < closes.length; i++) {
            // MA20 & Bollinger
            const win20 = Math.min(20, i + 1);
            const slice20 = closes.slice(Math.max(0, i - 19), i + 1);
            const avg20 = slice20.reduce((a, b) => a + b, 0) / win20;
            ma20.push(avg20);

            const variance = slice20.reduce((a, b) => a + Math.pow(b - avg20, 2), 0) / win20;
            const stdDev = Math.sqrt(variance);
            bbUpper.push(avg20 + 2 * stdDev);
            bbLower.push(avg20 - 2 * stdDev);

            // MA50
            const win50 = Math.min(50, i + 1);
            const slice50 = closes.slice(Math.max(0, i - 49), i + 1);
            ma50.push(slice50.reduce((a, b) => a + b, 0) / win50);
        }

        const lows = visibleData.map(c => Number(c.low != null ? c.low : (c.close_price || 0)));
        const highs = visibleData.map(c => Number(c.high != null ? c.high : (c.close_price || 0)));
        const support = lows.length ? Math.min(...lows) : null;
        const resistance = highs.length ? Math.max(...highs) : null;

        return { ma20, ma50, bbUpper, bbLower, support, resistance };
    }, [visibleData]);

    // 5. Chart Dimensions & Layout
    const width = 840;
    const height = toggles.volume ? 490 : 410;
    const padding = { top: 20, right: 30, bottom: 45, left: 75 };
    const navHeight = 36;
    const volumeHeight = toggles.volume ? 80 : 0;
    const priceHeight = height - padding.top - padding.bottom - volumeHeight - navHeight - (toggles.volume ? 14 : 0);
    const innerWidth = width - padding.left - padding.right;

    // Price scaling over visible window
    const priceLows = visibleData.map(item => Number(item.low != null ? item.low : item.close_price));
    const priceHighs = visibleData.map(item => Number(item.high != null ? item.high : item.close_price));
    const predPrices = (isAtCurrentEnd ? rawPrediction : []).map(p => Number(p.predicted_price)).filter(v => !isNaN(v) && v != null);

    let allPrices = [...priceLows, ...priceHighs, ...predPrices];
    if (toggles.bollinger && technicals.bbUpper.length && technicals.bbLower.length) {
        allPrices = [...allPrices, ...technicals.bbUpper, ...technicals.bbLower];
    }

    const minPrice = allPrices.length ? Math.min(...allPrices) : 100;
    const maxPrice = allPrices.length ? Math.max(...allPrices) : 100;
    const priceSpan = (maxPrice - minPrice) || 1;
    const paddedMin = minPrice - priceSpan * 0.04;
    const paddedMax = maxPrice + priceSpan * 0.04;
    const priceRange = paddedMax - paddedMin || 1;

    const totalPoints = Math.max(1, combinedData.length);
    const step = innerWidth / totalPoints;

    const yScalePrice = useCallback((price) => {
        if (price == null || isNaN(price)) return 0;
        return priceHeight - ((price - paddedMin) / priceRange) * priceHeight;
    }, [priceHeight, paddedMin, priceRange]);

    // Volume scaling
    const volumes = visibleData.map(item => Number(item.volume || 0));
    const maxVolume = Math.max(...volumes, 1);
    const yScaleVolume = useCallback((vol) => {
        return (vol / maxVolume) * (volumeHeight - 10);
    }, [maxVolume, volumeHeight]);

    // Price Y-axis Ticks
    const yTicks = useMemo(() => {
        return [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = paddedMax - ratio * priceRange;
            return {
                value: Number(val.toFixed(2)),
                y: yScalePrice(val),
            };
        });
    }, [paddedMax, priceRange, yScalePrice]);

    // 6. Active Point & Tooltip Metric Tracking
    const activeIndex = hoveredIndex !== null ? hoveredIndex : (visibleData.length > 0 ? visibleData.length - 1 : 0);
    const activePoint = combinedData[activeIndex] || {};
    const isPrediction = activePoint.predicted_price !== undefined && activePoint.close_price === undefined;
    const prevPoint = activeIndex > 0 ? combinedData[activeIndex - 1] : null;
    const priceChange = !isPrediction && prevPoint && activePoint.close_price != null && prevPoint.close_price != null
        ? activePoint.close_price - prevPoint.close_price
        : null;

    // 7. Interactive Pointer Handlers (Brush Zoom & Pan)
    const getSVGRelativeX = (e) => {
        if (!svgRef.current) return 0;
        const rect = svgRef.current.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
        const svgX = ((clientX - rect.left) / rect.width) * width;
        return Math.max(padding.left, Math.min(width - padding.right, svgX));
    };

    const handlePointerDown = (e) => {
        if (!rangeData.length) return;
        const x = getSVGRelativeX(e);
        const innerX = x - padding.left;

        if (e.shiftKey || (isZoomed && e.button === 1)) {
            // Pan Mode
            setPanDrag({ startX: innerX, initialWindow: [...zoomWindow] });
        } else {
            // Brush Selection Mode
            setBrushDrag({ startX: innerX, currentX: innerX });
        }
    };

    const handlePointerMove = (e) => {
        if (!combinedData.length) return;
        const x = getSVGRelativeX(e);
        const innerX = x - padding.left;

        // Update hover crosshair index
        const idx = Math.min(combinedData.length - 1, Math.max(0, Math.floor(innerX / step)));
        setHoveredIndex(idx);

        if (brushDrag) {
            setBrushDrag(prev => ({ ...prev, currentX: innerX }));
        } else if (panDrag) {
            const deltaX = innerX - panDrag.startX;
            const deltaRatio = deltaX / innerWidth;
            const span = panDrag.initialWindow[1] - panDrag.initialWindow[0];
            let newStart = panDrag.initialWindow[0] - deltaRatio;
            let newEnd = panDrag.initialWindow[1] - deltaRatio;

            if (newStart < 0) {
                newStart = 0;
                newEnd = span;
            }
            if (newEnd > 1) {
                newEnd = 1;
                newStart = 1 - span;
            }
            setZoomWindow([newStart, newEnd]);
        }
    };

    const handlePointerUp = () => {
        if (brushDrag) {
            const dragDist = Math.abs(brushDrag.currentX - brushDrag.startX);
            if (dragDist > 15) {
                // Apply brush zoom
                const minX = Math.min(brushDrag.startX, brushDrag.currentX);
                const maxX = Math.max(brushDrag.startX, brushDrag.currentX);

                const currentSpan = zoomWindow[1] - zoomWindow[0];
                const newStart = zoomWindow[0] + (minX / innerWidth) * currentSpan;
                const newEnd = zoomWindow[0] + (maxX / innerWidth) * currentSpan;

                if (newEnd - newStart >= 0.04) {
                    setZoomWindow([Math.max(0, newStart), Math.min(1, newEnd)]);
                }
            }
            setBrushDrag(null);
        }
        setPanDrag(null);
    };

    // 8. Desktop Scroll-Wheel Zoom Handler
    const handleWheel = (e) => {
        e.preventDefault();
        if (!rangeData.length) return;

        const x = getSVGRelativeX(e);
        const focusRatio = (x - padding.left) / innerWidth;
        const zoomDelta = e.deltaY > 0 ? 0.12 : -0.12;

        const currentSpan = zoomWindow[1] - zoomWindow[0];
        const newSpan = Math.max(0.04, Math.min(1.0, currentSpan * (1 + zoomDelta)));

        const newStart = Math.max(0, zoomWindow[0] + (currentSpan - newSpan) * focusRatio);
        const newEnd = Math.min(1, newStart + newSpan);

        setZoomWindow([newStart, newEnd]);
    };

    // Reset Zoom Handler
    const handleResetZoom = () => {
        setZoomWindow([0, 1]);
    };

    if (!rangeData.length && !rawPrediction.length) {
        return <div className="chart-empty-placeholder">No chart or price history available.</div>;
    }

    return (
        <div className="axiomity-chart-container">
            {/* Top Toolbar: Time Range Selector + Overlays + Candlestick/Line Toggle */}
            <div className={`chart-controls-bar ${compact ? 'compact-mode' : ''}`}>
                {/* 1. Time Range Selector Tabs */}
                <div className="chart-range-pills">
                    {TIME_RANGES.map((r) => (
                        <button
                            key={r.value}
                            type="button"
                            className={`range-pill-btn ${selectedRange === r.value ? 'active' : ''}`}
                            onClick={() => handleRangeSelect(r.value)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>

                {/* 2. Chart Type & Overlay Toggles */}
                <div className="chart-toggles-group">
                    {/* View Mode Toggle: Line vs Candlestick */}
                    <div className="mode-toggle-group">
                        <button
                            type="button"
                            className={`chart-pill-btn ${chartMode === 'line' ? 'active' : ''}`}
                            onClick={() => setChartMode('line')}
                            title="Line Chart View"
                        >
                            Line
                        </button>
                        <button
                            type="button"
                            className={`chart-pill-btn ${chartMode === 'candlestick' ? 'active' : ''}`}
                            onClick={() => setChartMode('candlestick')}
                            title="Candlestick OHLC View"
                        >
                            Candles
                        </button>
                    </div>

                    {!compact && (
                        <>
                            {/* Indicator Toggles */}
                            <button
                                type="button"
                                className={`chart-pill-btn ${toggles.ma20 ? 'active' : ''}`}
                                onClick={() => toggleFeature('ma20')}
                                title="20-Day Simple Moving Average"
                            >
                                <span className="legend-dot" style={{ background: '#f59e0b' }}></span>
                                MA 20
                            </button>
                            <button
                                type="button"
                                className={`chart-pill-btn ${toggles.ma50 ? 'active' : ''}`}
                                onClick={() => toggleFeature('ma50')}
                                title="50-Day Simple Moving Average"
                            >
                                <span className="legend-dot" style={{ background: '#8b5cf6' }}></span>
                                MA 50
                            </button>
                            <button
                                type="button"
                                className={`chart-pill-btn ${toggles.bollinger ? 'active' : ''}`}
                                onClick={() => toggleFeature('bollinger')}
                                title="Bollinger Bands (20, 2)"
                            >
                                <span className="legend-dot" style={{ background: '#06b6d4' }}></span>
                                Bollinger
                            </button>
                            <button
                                type="button"
                                className={`chart-pill-btn ${toggles.srLevels ? 'active' : ''}`}
                                onClick={() => toggleFeature('srLevels')}
                                title="Support & Resistance Zones"
                            >
                                <span className="legend-dot" style={{ background: '#64748b' }}></span>
                                S/R
                            </button>
                            <button
                                type="button"
                                className={`chart-pill-btn ${toggles.volume ? 'active' : ''}`}
                                onClick={() => toggleFeature('volume')}
                                title="Volume Subchart"
                            >
                                <span className="legend-dot" style={{ background: '#10b981' }}></span>
                                Vol
                            </button>
                        </>
                    )}

                    {/* Reset Zoom Button */}
                    {isZoomed && (
                        <button
                            type="button"
                            className="chart-pill-btn reset-zoom-btn"
                            onClick={handleResetZoom}
                            title="Reset Zoom to full period"
                        >
                            ↺ Reset Zoom
                        </button>
                    )}
                </div>
            </div>

            {/* Monospace OHLCV Tooltip HUD (Only show when hovering or in full mode) */}
            {(!compact || hoveredIndex !== null) && (
                <div className="chart-hud-fintech">
                    <div className="hud-date-tag">
                        <span className="hud-label">DATE</span>
                        <strong className="hud-mono-val">{activePoint.date || '—'}</strong>
                    </div>
                    {isPrediction ? (
                        <div className="hud-metric-chip forecast">
                            <span className="hud-label">FORECAST</span>
                            <strong className="hud-mono-val">{currencyPrefix}{Number(activePoint.predicted_price).toFixed(2)}</strong>
                        </div>
                    ) : (
                        <div className="hud-metrics-row">
                            <div className="hud-metric-chip">
                                <span className="hud-label">O</span>
                                <span className="hud-mono-val">{currencyPrefix}{Number(activePoint.open_price != null ? activePoint.open_price : activePoint.close_price || 0).toFixed(2)}</span>
                            </div>
                            <div className="hud-metric-chip">
                                <span className="hud-label">H</span>
                                <span className="hud-mono-val">{currencyPrefix}{Number(activePoint.high != null ? activePoint.high : activePoint.close_price || 0).toFixed(2)}</span>
                            </div>
                            <div className="hud-metric-chip">
                                <span className="hud-label">L</span>
                                <span className="hud-mono-val">{currencyPrefix}{Number(activePoint.low != null ? activePoint.low : activePoint.close_price || 0).toFixed(2)}</span>
                            </div>
                            <div className="hud-metric-chip">
                                <span className="hud-label">C</span>
                                <span className={`hud-mono-val ${Number(activePoint.close_price) >= Number(activePoint.open_price != null ? activePoint.open_price : activePoint.close_price) ? 'text-up' : 'text-down'}`}>
                                    {currencyPrefix}{Number(activePoint.close_price || 0).toFixed(2)}
                                </span>
                            </div>
                            {priceChange != null && (
                                <div className="hud-metric-chip">
                                    <span className="hud-label">CHG</span>
                                    <span className={`hud-mono-val ${priceChange >= 0 ? 'text-up' : 'text-down'}`}>
                                        {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({((priceChange / Number(prevPoint.close_price)) * 100).toFixed(2)}%)
                                    </span>
                                </div>
                            )}
                            <div className="hud-metric-chip">
                                <span className="hud-label">VOL</span>
                                <span className="hud-mono-val">
                                    {activePoint.volume ? (Number(activePoint.volume) >= 10000000 ? `${(Number(activePoint.volume) / 10000000).toFixed(2)} Cr` : `${(Number(activePoint.volume) / 100000).toFixed(2)} L`) : '—'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Interactive SVG Chart */}
            <div className="svg-chart-wrapper" onWheel={handleWheel}>
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    width="100%"
                    height={height}
                    className="fintech-svg-chart interactive-chart"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={() => {
                        setHoveredIndex(null);
                        setBrushDrag(null);
                        setPanDrag(null);
                    }}
                >
                    <defs>
                        <linearGradient id="chart-area-gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.24" />
                            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
                        </linearGradient>
                        <linearGradient id="bb-envelope-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.04" />
                        </linearGradient>
                        <clipPath id="price-pane-clip">
                            <rect x="0" y="0" width={innerWidth} height={priceHeight} />
                        </clipPath>
                    </defs>

                    {/* Chart Container Background Box */}
                    <rect x="0" y="0" width={width} height={height} rx="12" fill="var(--chart-bg, #ffffff)" stroke="var(--chart-border, #e2e8f0)" strokeWidth="1" />

                    <g transform={`translate(${padding.left},${padding.top})`}>
                        {/* 1. Price Horizontal Gridlines & Y-Axis Labels */}
                        {yTicks.map((tick) => (
                            <g key={tick.value} className="grid-line-group">
                                <line x1="0" x2={innerWidth} y1={tick.y} y2={tick.y} stroke="var(--chart-grid, #f1f5f9)" strokeDasharray="3 3" />
                                <text x="-12" y={tick.y + 4} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--chart-text, #64748b)" className="axis-mono-label">
                                    {currencyPrefix}{tick.value.toLocaleString('en-IN')}
                                </text>
                            </g>
                        ))}

                        {/* 2. Support & Resistance Overlays */}
                        {toggles.srLevels && technicals.resistance != null && (
                            <g>
                                <line
                                    x1="0"
                                    x2={innerWidth}
                                    y1={yScalePrice(technicals.resistance)}
                                    y2={yScalePrice(technicals.resistance)}
                                    stroke="#ef4444"
                                    strokeWidth="1.5"
                                    strokeDasharray="6 4"
                                    opacity="0.85"
                                />
                                <text x={innerWidth - 6} y={yScalePrice(technicals.resistance) - 4} textAnchor="end" fontSize="10" fontWeight="700" fill="#ef4444">
                                    RESISTANCE ₹{technicals.resistance.toFixed(2)}
                                </text>
                            </g>
                        )}
                        {toggles.srLevels && technicals.support != null && (
                            <g>
                                <line
                                    x1="0"
                                    x2={innerWidth}
                                    y1={yScalePrice(technicals.support)}
                                    y2={yScalePrice(technicals.support)}
                                    stroke="#10b981"
                                    strokeWidth="1.5"
                                    strokeDasharray="6 4"
                                    opacity="0.85"
                                />
                                <text x={innerWidth - 6} y={yScalePrice(technicals.support) + 12} textAnchor="end" fontSize="10" fontWeight="700" fill="#10b981">
                                    SUPPORT ₹{technicals.support.toFixed(2)}
                                </text>
                            </g>
                        )}

                        {/* 3. Bollinger Bands Envelope */}
                        {toggles.bollinger && visibleData.length > 1 && technicals.bbUpper.length > 0 && (() => {
                            const upperPoints = technicals.bbUpper.map((val, idx) => `${idx * step + step / 2},${yScalePrice(val)}`).join(' L ');
                            const lowerPointsReverse = technicals.bbLower.map((val, idx) => `${idx * step + step / 2},${yScalePrice(val)}`).reverse().join(' L ');
                            const bbAreaPath = `M ${upperPoints} L ${lowerPointsReverse} Z`;

                            return (
                                <g pointerEvents="none" clipPath="url(#price-pane-clip)">
                                    <path d={bbAreaPath} fill="url(#bb-envelope-fill)" />
                                    <polyline
                                        points={technicals.bbUpper.map((val, idx) => `${idx * step + step / 2},${yScalePrice(val)}`).join(' ')}
                                        fill="none"
                                        stroke="#06b6d4"
                                        strokeWidth="1.2"
                                        strokeDasharray="4 2"
                                        opacity="0.75"
                                    />
                                    <polyline
                                        points={technicals.bbLower.map((val, idx) => `${idx * step + step / 2},${yScalePrice(val)}`).join(' ')}
                                        fill="none"
                                        stroke="#06b6d4"
                                        strokeWidth="1.2"
                                        strokeDasharray="4 2"
                                        opacity="0.75"
                                    />
                                </g>
                            );
                        })()}

                        {/* 4. Main Price Series: Line or Candlestick View */}
                        {chartMode === 'line' && visibleData.length > 0 && (() => {
                            const firstX = step / 2;
                            const lastX = (visibleData.length - 1) * step + step / 2;
                            const linePoints = visibleData.map((item, index) => {
                                const x = index * step + step / 2;
                                const y = yScalePrice(item.close_price);
                                return `${x},${y}`;
                            }).join(' L ');
                            const d = `M ${firstX},${priceHeight} L ${linePoints} L ${lastX},${priceHeight} Z`;

                            return (
                                <g pointerEvents="none" clipPath="url(#price-pane-clip)">
                                    <path d={d} fill="url(#chart-area-gradient)" />
                                    <polyline
                                        points={visibleData.map((item, index) => `${index * step + step / 2},${yScalePrice(item.close_price)}`).join(' ')}
                                        fill="none"
                                        stroke="#2563eb"
                                        strokeWidth="2.5"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                    />
                                </g>
                            );
                        })()}

                        {/* Candlestick Rendering Mode */}
                        {chartMode === 'candlestick' && visibleData.length > 0 && (
                            <g pointerEvents="none" clipPath="url(#price-pane-clip)">
                                {visibleData.map((candle, idx) => {
                                    const x = idx * step + step / 2;
                                    const o = Number(candle.open_price != null ? candle.open_price : candle.close_price);
                                    const c = Number(candle.close_price);
                                    const h = Number(candle.high != null ? candle.high : Math.max(o, c));
                                    const l = Number(candle.low != null ? candle.low : Math.min(o, c));

                                    const isUp = c >= o;
                                    const candleColor = isUp ? '#10b981' : '#ef4444';
                                    const candleWidth = Math.max(2, Math.min(16, step * 0.72));

                                    const yHigh = yScalePrice(h);
                                    const yLow = yScalePrice(l);
                                    const yOpen = yScalePrice(o);
                                    const yClose = yScalePrice(c);

                                    const rectY = Math.min(yOpen, yClose);
                                    const rectH = Math.max(1.5, Math.abs(yClose - yOpen));

                                    return (
                                        <g key={`candle-${idx}`}>
                                            {/* Candle Wick Line (High to Low) */}
                                            <line
                                                x1={x}
                                                x2={x}
                                                y1={yHigh}
                                                y2={yLow}
                                                stroke={candleColor}
                                                strokeWidth="1.4"
                                            />
                                            {/* Candle Body Rect (Open to Close) */}
                                            <rect
                                                x={x - candleWidth / 2}
                                                y={rectY}
                                                width={candleWidth}
                                                height={rectH}
                                                fill={candleColor}
                                                rx="1"
                                            />
                                        </g>
                                    );
                                })}
                            </g>
                        )}

                        {/* 5. Moving Averages Overlays */}
                        {toggles.ma20 && visibleData.length > 1 && technicals.ma20.length > 0 && (
                            <polyline
                                points={technicals.ma20.map((val, idx) => `${idx * step + step / 2},${yScalePrice(val)}`).join(' ')}
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                pointerEvents="none"
                                clipPath="url(#price-pane-clip)"
                            />
                        )}
                        {toggles.ma50 && visibleData.length > 1 && technicals.ma50.length > 0 && (
                            <polyline
                                points={technicals.ma50.map((val, idx) => `${idx * step + step / 2},${yScalePrice(val)}`).join(' ')}
                                fill="none"
                                stroke="#8b5cf6"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                pointerEvents="none"
                                clipPath="url(#price-pane-clip)"
                            />
                        )}

                        {/* 6. 14-Day Prediction Dotted Trajectory (only when visible window includes now) */}
                        {isAtCurrentEnd && rawPrediction.length > 0 && (() => {
                            const predPoints = [];
                            if (visibleData.length > 0) {
                                const lastHist = visibleData[visibleData.length - 1];
                                const lastHistX = (visibleData.length - 1) * step + step / 2;
                                const lastHistY = yScalePrice(lastHist.close_price);
                                predPoints.push(`${lastHistX},${lastHistY}`);
                            }

                            rawPrediction.forEach((p, idx) => {
                                const index = visibleData.length + idx;
                                const x = index * step + step / 2;
                                const y = yScalePrice(p.predicted_price);
                                predPoints.push(`${x},${y}`);
                            });

                            return (
                                <g pointerEvents="none" clipPath="url(#price-pane-clip)">
                                    <polyline
                                        points={predPoints.join(' ')}
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="2.2"
                                        strokeDasharray="5 4"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                    />
                                    {rawPrediction.map((p, idx) => {
                                        const index = visibleData.length + idx;
                                        const x = index * step + step / 2;
                                        const y = yScalePrice(p.predicted_price);
                                        return (
                                            <circle key={p.date || idx} cx={x} cy={y} r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5" />
                                        );
                                    })}
                                </g>
                            );
                        })()}

                        {/* 7. Volume Subchart Pane */}
                        {toggles.volume && (
                            <g transform={`translate(0, ${priceHeight + 14})`} className="volume-subchart-pane">
                                <line x1="0" x2={innerWidth} y1="0" y2="0" stroke="#e2e8f0" strokeWidth="1" />
                                <text x="-12" y="14" textAnchor="end" fontSize="10" fontWeight="700" fill="#94a3b8">
                                    VOL
                                </text>

                                {visibleData.map((item, idx) => {
                                    const barH = yScaleVolume(Number(item.volume || 0));
                                    const barX = idx * step + step * 0.15;
                                    const barW = Math.max(1.8, step * 0.7);
                                    const barY = volumeHeight - barH;
                                    const isUp = Number(item.close_price) >= Number(item.open_price != null ? item.open_price : item.close_price);

                                    return (
                                        <rect
                                            key={`vol-${idx}`}
                                            x={barX}
                                            y={barY}
                                            width={barW}
                                            height={Math.max(1, barH)}
                                            fill={isUp ? '#10b981' : '#ef4444'}
                                            opacity={hoveredIndex === idx ? 0.95 : 0.65}
                                            rx="1"
                                        />
                                    );
                                })}
                            </g>
                        )}

                        {/* 8. Active Hover Crosshair Line & Point Dot */}
                        {hoveredIndex !== null && (
                            <g pointerEvents="none">
                                <line
                                    x1={hoveredIndex * step + step / 2}
                                    x2={hoveredIndex * step + step / 2}
                                    y1={0}
                                    y2={priceHeight + (toggles.volume ? volumeHeight + 14 : 0)}
                                    stroke="#475569"
                                    strokeWidth="1.2"
                                    strokeDasharray="3 3"
                                />
                            </g>
                        )}

                        {hoveredIndex !== null && (() => {
                            const point = combinedData[hoveredIndex];
                            if (!point) return null;
                            const price = point.close_price !== undefined ? point.close_price : point.predicted_price;
                            if (price === undefined) return null;
                            const x = hoveredIndex * step + step / 2;
                            const y = yScalePrice(price);
                            const isPred = point.predicted_price !== undefined && point.close_price === undefined;
                            const isUp = Number(point.close_price) >= Number(point.open_price != null ? point.open_price : point.close_price);

                            return (
                                <circle
                                    cx={x}
                                    cy={y}
                                    r="5.5"
                                    fill={isPred ? '#3b82f6' : (isUp ? '#10b981' : '#ef4444')}
                                    stroke="#ffffff"
                                    strokeWidth="2.5"
                                    pointerEvents="none"
                                />
                            );
                        })()}

                        {/* 9. Interactive Drag-Zoom Selection Rectangle */}
                        {brushDrag && (
                            <g pointerEvents="none">
                                <rect
                                    x={Math.min(brushDrag.startX, brushDrag.currentX)}
                                    y={0}
                                    width={Math.abs(brushDrag.currentX - brushDrag.startX)}
                                    height={priceHeight}
                                    fill="#2563eb"
                                    fillOpacity="0.14"
                                    stroke="#2563eb"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 2"
                                />
                            </g>
                        )}

                        {/* 10. Date X-Axis Labels */}
                        <g transform={`translate(0, ${priceHeight + (toggles.volume ? volumeHeight + 14 : 0)})`}>
                            {combinedData.map((item, index) => {
                                const labelInterval = Math.max(1, Math.floor(combinedData.length / 6));
                                if (index % labelInterval !== 0 && index !== combinedData.length - 1) return null;
                                const x = index * step + step / 2;
                                const label = item.date ? item.date.slice(5) : '';
                                return (
                                    <text
                                        key={`date-${item.date}-${index}`}
                                        x={x}
                                        y={16}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fontWeight="600"
                                        fill="var(--chart-text, #64748b)"
                                        className="axis-mono-label"
                                    >
                                        {label}
                                    </text>
                                );
                            })}
                        </g>

                        {/* 11. Bottom Range-Preview Sparkline Navigator Strip */}
                        {rangeData.length > 5 && (() => {
                            const navTop = priceHeight + (toggles.volume ? volumeHeight + 14 : 0) + 26;
                            const fullCloses = rangeData.map(c => Number(c.close_price || 0));
                            const navMin = Math.min(...fullCloses);
                            const navMax = Math.max(...fullCloses);
                            const navSpan = (navMax - navMin) || 1;
                            const navStep = innerWidth / Math.max(1, rangeData.length - 1);

                            const sparklinePoints = fullCloses.map((c, i) => {
                                const nx = i * navStep;
                                const ny = navTop + navHeight - ((c - navMin) / navSpan) * (navHeight - 6) - 3;
                                return `${nx},${ny}`;
                            }).join(' ');

                            const windowStartX = zoomWindow[0] * innerWidth;
                            const windowWidth = (zoomWindow[1] - zoomWindow[0]) * innerWidth;

                            return (
                                <g className="range-navigator-group" transform={`translate(0, 0)`}>
                                    {/* Navigator Strip Background */}
                                    <rect
                                        x={0}
                                        y={navTop}
                                        width={innerWidth}
                                        height={navHeight}
                                        fill="var(--chart-nav-bg, #f8fafc)"
                                        stroke="var(--chart-nav-border, #e2e8f0)"
                                        rx="6"
                                    />
                                    {/* Mini Sparkline Line */}
                                    <polyline
                                        points={sparklinePoints}
                                        fill="none"
                                        stroke="var(--chart-nav-line, #94a3b8)"
                                        strokeWidth="1.2"
                                        opacity="0.8"
                                    />
                                    {/* Active Zoom Window Highlight Box */}
                                    <rect
                                        x={windowStartX}
                                        y={navTop}
                                        width={windowWidth}
                                        height={navHeight}
                                        fill="var(--primary-blue, #2563eb)"
                                        fillOpacity="0.16"
                                        stroke="var(--primary-blue, #2563eb)"
                                        strokeWidth="1.5"
                                        rx="4"
                                    />
                                </g>
                            );
                        })()}
                    </g>
                </svg>
            </div>
        </div>
    );
}

export default StockChart;

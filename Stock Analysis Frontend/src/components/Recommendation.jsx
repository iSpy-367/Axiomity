import React from 'react';

function Recommendation({ data = {} }) {
    const currentPrice = Number(data.current_price || 0);
    const rsi = data.rsi != null ? Number(data.rsi) : null;
    const macd = data.macd != null ? Number(data.macd) : null;
    const ma20 = data.ma20 != null ? Number(data.ma20) : null;
    const ma50 = data.ma50 != null ? Number(data.ma50) : null;
    const fiftyDayMa = data.fundamentals?.fifty_day_ma != null ? Number(data.fundamentals.fifty_day_ma) : null;
    const twoHundredDayMa = data.fundamentals?.two_hundred_day_ma != null ? Number(data.fundamentals.two_hundred_day_ma) : null;

    const signals = [];

    if (rsi != null) {
        if (rsi < 35) {
            signals.push({ name: 'RSI (14)', value: rsi.toFixed(2), stance: 'Bullish', detail: 'Oversold (<35)', score: 1 });
        } else if (rsi > 65) {
            signals.push({ name: 'RSI (14)', value: rsi.toFixed(2), stance: 'Bearish', detail: 'Overbought (>65)', score: -1 });
        } else {
            signals.push({ name: 'RSI (14)', value: rsi.toFixed(2), stance: 'Neutral', detail: 'Normal (35-65)', score: 0 });
        }
    }

    if (macd != null) {
        if (macd > 0.5) {
            signals.push({ name: 'MACD (12,26)', value: (macd >= 0 ? '+' : '') + macd.toFixed(2), stance: 'Bullish', detail: 'Positive Momentum', score: 1 });
        } else if (macd < -0.5) {
            signals.push({ name: 'MACD (12,26)', value: macd.toFixed(2), stance: 'Bearish', detail: 'Negative Momentum', score: -1 });
        } else {
            signals.push({ name: 'MACD (12,26)', value: macd.toFixed(2), stance: 'Neutral', detail: 'Flat Momentum', score: 0 });
        }
    }

    if (ma20 != null && currentPrice > 0) {
        const diff20 = ((currentPrice - ma20) / ma20) * 100;
        if (diff20 > 0.3) {
            signals.push({ name: 'Price vs MA20', value: `₹${ma20.toFixed(2)}`, stance: 'Bullish', detail: `Above (+${diff20.toFixed(1)}%)`, score: 1 });
        } else if (diff20 < -0.3) {
            signals.push({ name: 'Price vs MA20', value: `₹${ma20.toFixed(2)}`, stance: 'Bearish', detail: `Below (${diff20.toFixed(1)}%)`, score: -1 });
        } else {
            signals.push({ name: 'Price vs MA20', value: `₹${ma20.toFixed(2)}`, stance: 'Neutral', detail: 'At MA20 level', score: 0 });
        }
    }

    if (ma50 != null && currentPrice > 0) {
        const diff50 = ((currentPrice - ma50) / ma50) * 100;
        if (diff50 > 0.5) {
            signals.push({ name: 'Price vs MA50', value: `₹${ma50.toFixed(2)}`, stance: 'Bullish', detail: `Above (+${diff50.toFixed(1)}%)`, score: 1 });
        } else if (diff50 < -0.5) {
            signals.push({ name: 'Price vs MA50', value: `₹${ma50.toFixed(2)}`, stance: 'Bearish', detail: `Below (${diff50.toFixed(1)}%)`, score: -1 });
        } else {
            signals.push({ name: 'Price vs MA50', value: `₹${ma50.toFixed(2)}`, stance: 'Neutral', detail: 'At MA50 level', score: 0 });
        }
    }

    let dmaCross = null;
    if (fiftyDayMa != null && twoHundredDayMa != null) {
        const isGolden = fiftyDayMa >= twoHundredDayMa;
        dmaCross = isGolden ? 'Golden Cross' : 'Death Cross';
        signals.push({
            name: '50/200 DMA Trend',
            value: isGolden ? 'Golden Cross' : 'Death Cross',
            stance: isGolden ? 'Bullish' : 'Bearish',
            detail: `50DMA: ₹${fiftyDayMa.toFixed(1)} | 200DMA: ₹${twoHundredDayMa.toFixed(1)}`,
            score: isGolden ? 1 : -1,
        });
    }

    const totalSignals = signals.length || 1;
    const bullCount = signals.filter(s => s.stance === 'Bullish').length;
    const bearCount = signals.filter(s => s.stance === 'Bearish').length;
    const neutralCount = signals.filter(s => s.stance === 'Neutral').length;

    let stance = 'Neutral';
    let stanceType = 'neutral';
    let agreementPercentage = 50;

    if (bullCount >= bearCount + 2 || (bullCount >= 3 && bearCount === 0)) {
        stance = 'Buy';
        stanceType = 'buy';
        agreementPercentage = Math.min(95, Math.round((bullCount / totalSignals) * 100));
    } else if (bearCount >= bullCount + 2 || (bearCount >= 3 && bullCount === 0)) {
        stance = 'Sell';
        stanceType = 'sell';
        agreementPercentage = Math.min(95, Math.round((bearCount / totalSignals) * 100));
    } else {
        stance = 'Hold';
        stanceType = 'hold';
        agreementPercentage = Math.round((Math.max(bullCount, bearCount, neutralCount) / totalSignals) * 100);
    }

    const macdSignal = signals.find(s => s.name.startsWith('MACD'));
    const maSignal = signals.find(s => s.name.startsWith('Price vs MA50'));
    const isDivergent = (macdSignal && maSignal && macdSignal.stance !== 'Neutral' && maSignal.stance !== 'Neutral' && macdSignal.stance !== maSignal.stance) ||
        (macdSignal && dmaCross && macdSignal.stance === 'Bullish' && dmaCross === 'Death Cross') ||
        (macdSignal && dmaCross && macdSignal.stance === 'Bearish' && dmaCross === 'Golden Cross');

    return (
        <div className="fintech-card signal-scorecard-card">
            <div className="scorecard-header">
                <div>
                    <span className="fintech-eyebrow">COMPOSITE SIGNAL SCORECARD</span>
                    <h3 className="scorecard-title">Technical Consensus</h3>
                </div>
                <div className={`stance-badge ${stanceType}`}>
                    {stance.toUpperCase()}
                </div>
            </div>

            <div className="confidence-meter-box">
                <div className="meter-label-row">
                    <span className="meter-label">Indicator Agreement</span>
                    <strong className="meter-val">{bullCount} Bull / {bearCount} Bear / {neutralCount} Neutral ({agreementPercentage}%)</strong>
                </div>
                <div className="agreement-bar-segmented">
                    <div className="bar-seg bull-seg" style={{ width: `${(bullCount / totalSignals) * 100}%` }} title={`${bullCount} Bullish`}></div>
                    <div className="bar-seg neutral-seg" style={{ width: `${(neutralCount / totalSignals) * 100}%` }} title={`${neutralCount} Neutral`}></div>
                    <div className="bar-seg bear-seg" style={{ width: `${(bearCount / totalSignals) * 100}%` }} title={`${bearCount} Bearish`}></div>
                </div>
            </div>

            {isDivergent && (
                <div className="divergence-warning-ribbon">
                    <div className="ribbon-icon">⚠️</div>
                    <div className="ribbon-content">
                        <strong>Divergence Detected</strong>
                        <p>Momentum (MACD) and structural trend (Moving Averages) disagree.</p>
                    </div>
                </div>
            )}

            <div className="scorecard-breakdown-list">
                {signals.map((sig, idx) => (
                    <div key={idx} className="scorecard-row">
                        <div className="scorecard-metric-info">
                            <span className="metric-name">{sig.name}</span>
                            <span className="metric-detail-muted">{sig.detail}</span>
                        </div>
                        <div className="scorecard-metric-result">
                            <span className="metric-val-mono">{sig.value}</span>
                            <span className={`signal-chip ${sig.stance.toLowerCase()}`}>
                                {sig.stance === 'Bullish' ? '▲ Bullish' : sig.stance === 'Bearish' ? '▼ Bearish' : '● Neutral'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Recommendation;
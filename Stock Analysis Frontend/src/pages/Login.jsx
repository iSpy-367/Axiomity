import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { login, user } = useAuth();
    const navigate = useNavigate();

    if (user) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!username.trim() || !password) {
            setError('Please enter both your username and password.');
            return;
        }

        setSubmitting(true);

        try {
            await login(username.trim(), password);
            navigate('/');
        } catch (err) {
            const msg =
                err.response?.data?.detail ||
                err.response?.data?.non_field_errors?.[0] ||
                'Invalid username or password. Please verify your credentials.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-split-wrapper">
            {/* Left Column: Branding & Product Context */}
            <div className="auth-split-branding">
                <div className="auth-brand-header">
                    <img
                        src="/axiomity-logo.svg"
                        alt="Axiomity Logo"
                        className="auth-brand-logo"
                    />
                    <div>
                        <h1 className="auth-brand-title">Axiomity</h1>
                        <p className="auth-brand-tagline">Trading intelligence for modern investors</p>
                    </div>
                </div>

                <div className="auth-branding-content">
                    <div className="auth-branding-eyebrow">
                        <span className="live-pulse-dot" style={{ width: '7px', height: '7px' }}></span>
                        NSE & BSE LIVE ANALYTICS
                    </div>

                    <h2 className="auth-branding-headline">
                        Institutional-grade stock analysis at your fingertips.
                    </h2>
                    <p className="auth-branding-desc">
                        Analyze Indian equities with composite technical consensus, automated divergence alerts, interactive zoomable price action, and live portfolio tracking.
                    </p>

                    {/* Decorative Live Signal Mockup */}
                    <div className="auth-mockup-card">
                        <div className="auth-mockup-head">
                            <div>
                                <span className="auth-mockup-sym">RELIANCE</span>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '6px' }}>NSE</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className="auth-mockup-price">₹1,310.00 ▲ +0.85%</span>
                            </div>
                        </div>

                        {/* Mini Decorative SVG Chart Wave */}
                        <div className="auth-mockup-svg-wrap">
                            <svg viewBox="0 0 400 64" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                                <defs>
                                    <linearGradient id="loginGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.45" />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M0,48 Q40,52 80,38 T160,28 T240,42 T320,18 T400,22 L400,64 L0,64 Z"
                                    fill="url(#loginGrad)"
                                />
                                <path
                                    d="M0,48 Q40,52 80,38 T160,28 T240,42 T320,18 T400,22"
                                    fill="none"
                                    stroke="#3b82f6"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />
                                <circle cx="320" cy="18" r="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="2" />
                            </svg>
                        </div>
                    </div>

                    {/* Feature Highlights */}
                    <div className="auth-features-list">
                        <div className="auth-feature-item">
                            <div className="auth-feature-icon">⚡</div>
                            <div className="auth-feature-text">
                                <strong>Real-Time Market Data</strong>
                                <span>Zero-delay price action across all NSE & BSE listed equities.</span>
                            </div>
                        </div>
                        <div className="auth-feature-item">
                            <div className="auth-feature-icon">🎯</div>
                            <div className="auth-feature-text">
                                <strong>Composite Signal Scorecard</strong>
                                <span>Multi-indicator consensus with RSI, MACD, MA20/50, and Bollinger Bands.</span>
                            </div>
                        </div>
                        <div className="auth-feature-item">
                            <div className="auth-feature-icon">💼</div>
                            <div className="auth-feature-text">
                                <strong>Portfolio & Allocation Tracker</strong>
                                <span>Live P&L calculations, capital diversification, and instant stock lookups.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="auth-brand-footer">
                    © {new Date().getFullYear()} Axiomity Technologies. All rights reserved.
                </div>
            </div>

            {/* Right Column: Sign In Form Panel */}
            <div className="auth-split-form-panel">
                <div className="auth-fintech-card">
                    <div className="auth-form-head">
                        <span className="fintech-eyebrow">AUTHENTICATION</span>
                        <h2>Welcome back</h2>
                        <p>Sign in to access your intelligence workspace and holdings.</p>
                    </div>

                    {error && (
                        <div className="auth-error-banner" role="alert">
                            <span style={{ fontSize: '1rem' }}>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Username Field */}
                        <div className="auth-field-group">
                            <label className="fintech-input-label" htmlFor="login-username">
                                Username
                            </label>
                            <div className="auth-input-container">
                                <input
                                    id="login-username"
                                    type="text"
                                    placeholder="Enter your username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="auth-input"
                                    autoComplete="username"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Field with Visibility Toggle */}
                        <div className="auth-field-group">
                            <div className="auth-field-label-row">
                                <label className="fintech-input-label" htmlFor="login-password">
                                    Password
                                </label>
                            </div>
                            <div className="auth-input-container">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="auth-input has-eye"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                            <line x1="1" y1="1" x2="23" y2="23"></line>
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={submitting || !username.trim() || !password}
                        >
                            {submitting ? (
                                <>
                                    <span className="auth-spinner"></span>
                                    <span>Signing in…</span>
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    <p className="auth-switch-footer">
                        Don&apos;t have an account?{' '}
                        <Link to="/register">Create an account</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;



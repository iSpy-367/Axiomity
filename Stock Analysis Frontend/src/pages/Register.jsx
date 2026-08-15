import React, { useState, useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function formatErrors(data) {
    if (!data) return 'Registration failed. Please try again.';
    if (typeof data === 'string') return data;
    return Object.entries(data)
        .map(([field, msgs]) => {
            const label = field.replace('_', ' ').toUpperCase();
            const text = Array.isArray(msgs) ? msgs.join(', ') : msgs;
            return `${label}: ${text}`;
        })
        .join(' • ');
}

function calculatePasswordStrength(pass) {
    if (!pass) return { score: 0, label: '', classKey: '' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/\d/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', classKey: 'weak' };
    if (score === 2) return { score: 2, label: 'Fair', classKey: 'fair' };
    if (score === 3) return { score: 3, label: 'Good', classKey: 'good' };
    return { score: 4, label: 'Strong', classKey: 'strong' };
}

function Register() {
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        password_confirm: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { register, user } = useAuth();
    const navigate = useNavigate();

    const passwordStrength = useMemo(() => calculatePasswordStrength(form.password), [form.password]);

    const isMatch = Boolean(
        form.password &&
        form.password_confirm &&
        form.password === form.password_confirm
    );

    const isMismatch = Boolean(
        form.password &&
        form.password_confirm &&
        form.password !== form.password_confirm
    );

    const isFormValid = Boolean(
        form.username.trim() &&
        form.email.trim() &&
        form.password &&
        form.password_confirm &&
        isMatch
    );

    if (user) {
        return <Navigate to="/" replace />;
    }

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (form.password !== form.password_confirm) {
            setError('Passwords do not match. Please verify and try again.');
            return;
        }

        setSubmitting(true);

        try {
            await register({
                username: form.username.trim(),
                email: form.email.trim(),
                password: form.password,
                password_confirm: form.password_confirm,
            });
            navigate('/');
        } catch (err) {
            setError(formatErrors(err.response?.data));
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
                        CREATE TRADING WORKSPACE
                    </div>

                    <h2 className="auth-branding-headline">
                        Supercharge your Indian equity investments.
                    </h2>
                    <p className="auth-branding-desc">
                        Join modern investors using Axiomity to identify high-probability setups, uncover technical divergences, and track portfolio returns with institutional precision.
                    </p>

                    {/* Decorative Live Signal Mockup */}
                    <div className="auth-mockup-card">
                        <div className="auth-mockup-head">
                            <div>
                                <span className="auth-mockup-sym">TATA MOTORS</span>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '6px' }}>NSE</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className="auth-mockup-price">₹1,114.50 ▲ +2.34%</span>
                            </div>
                        </div>

                        {/* Mini Decorative SVG Chart Wave */}
                        <div className="auth-mockup-svg-wrap">
                            <svg viewBox="0 0 400 64" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                                <defs>
                                    <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>
                                <path
                                    d="M0,52 Q50,44 100,48 T200,32 T300,18 T400,12 L400,64 L0,64 Z"
                                    fill="url(#regGrad)"
                                />
                                <path
                                    d="M0,52 Q50,44 100,48 T200,32 T300,18 T400,12"
                                    fill="none"
                                    stroke="#10b981"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                />
                                <circle cx="300" cy="18" r="4" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                            </svg>
                        </div>
                    </div>

                    {/* Feature Highlights */}
                    <div className="auth-features-list">
                        <div className="auth-feature-item">
                            <div className="auth-feature-icon">🛡️</div>
                            <div className="auth-feature-text">
                                <strong>Free Lifetime Access</strong>
                                <span>Complete technical suite, real-time charts, and indicator agreement scorecards.</span>
                            </div>
                        </div>
                        <div className="auth-feature-item">
                            <div className="auth-feature-icon">📈</div>
                            <div className="auth-feature-text">
                                <strong>TradingView-Grade Interactive Charts</strong>
                                <span>Multi-timeframe zooming, candlestick & line modes, MA overlays, and sparkline scrubbers.</span>
                            </div>
                        </div>
                        <div className="auth-feature-item">
                            <div className="auth-feature-icon">📊</div>
                            <div className="auth-feature-text">
                                <strong>Fundamental & Valuation Insights</strong>
                                <span>Automated P/E, P/B, ROE, Debt/Equity, and Dividend Yield diagnostics.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="auth-brand-footer">
                    © {new Date().getFullYear()} Axiomity Technologies. All rights reserved.
                </div>
            </div>

            {/* Right Column: Register Form Panel */}
            <div className="auth-split-form-panel">
                <div className="auth-fintech-card">
                    <div className="auth-form-head">
                        <span className="fintech-eyebrow">GET STARTED</span>
                        <h2>Create your account</h2>
                        <p>Start building smarter stock decisions with Axiomity.</p>
                    </div>

                    {error && (
                        <div className="auth-error-banner" role="alert">
                            <span style={{ fontSize: '1rem' }}>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Username */}
                        <div className="auth-field-group">
                            <label className="fintech-input-label" htmlFor="reg-username">
                                Username
                            </label>
                            <div className="auth-input-container">
                                <input
                                    id="reg-username"
                                    type="text"
                                    name="username"
                                    placeholder="Choose a username"
                                    value={form.username}
                                    onChange={handleChange}
                                    className="auth-input"
                                    autoComplete="username"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="auth-field-group">
                            <label className="fintech-input-label" htmlFor="reg-email">
                                Email Address
                            </label>
                            <div className="auth-input-container">
                                <input
                                    id="reg-email"
                                    type="email"
                                    name="email"
                                    placeholder="name@example.com"
                                    value={form.email}
                                    onChange={handleChange}
                                    className="auth-input"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password with Strength Meter */}
                        <div className="auth-field-group">
                            <div className="auth-field-label-row">
                                <label className="fintech-input-label" htmlFor="reg-password">
                                    Password
                                </label>
                                {form.password && (
                                    <span className="strength-label">
                                        Strength: <strong>{passwordStrength.label}</strong>
                                    </span>
                                )}
                            </div>
                            <div className="auth-input-container">
                                <input
                                    id="reg-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    placeholder="Create a strong password"
                                    value={form.password}
                                    onChange={handleChange}
                                    className="auth-input has-eye"
                                    autoComplete="new-password"
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

                            {/* Password Strength Meter Bars */}
                            {form.password && (
                                <div className="password-strength-wrap">
                                    <div className="password-strength-bars">
                                        <div className={`strength-bar ${passwordStrength.score >= 1 ? `active-${passwordStrength.classKey}` : ''}`}></div>
                                        <div className={`strength-bar ${passwordStrength.score >= 2 ? `active-${passwordStrength.classKey}` : ''}`}></div>
                                        <div className={`strength-bar ${passwordStrength.score >= 3 ? `active-${passwordStrength.classKey}` : ''}`}></div>
                                        <div className={`strength-bar ${passwordStrength.score >= 4 ? `active-${passwordStrength.classKey}` : ''}`}></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password with Match Indicator */}
                        <div className="auth-field-group">
                            <div className="auth-field-label-row">
                                <label className="fintech-input-label" htmlFor="reg-password-confirm">
                                    Confirm Password
                                </label>
                            </div>
                            <div className="auth-input-container">
                                <input
                                    id="reg-password-confirm"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    name="password_confirm"
                                    placeholder="Re-enter your password"
                                    value={form.password_confirm}
                                    onChange={handleChange}
                                    className="auth-input has-eye"
                                    autoComplete="new-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="auth-eye-btn"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showConfirmPassword ? (
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

                            {/* Inline Match Status */}
                            {form.password_confirm && (
                                <div className={`confirm-match-pill ${isMatch ? 'match' : isMismatch ? 'mismatch' : ''}`}>
                                    {isMatch ? (
                                        <><span>✓</span> Passwords match</>
                                    ) : isMismatch ? (
                                        <><span>✕</span> Passwords do not match</>
                                    ) : null}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={submitting || !isFormValid}
                        >
                            {submitting ? (
                                <>
                                    <span className="auth-spinner"></span>
                                    <span>Creating account…</span>
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </form>

                    <p className="auth-switch-footer">
                        Already have an account?{' '}
                        <Link to="/login">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Register;
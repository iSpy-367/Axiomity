import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';


function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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
        setSubmitting(true);

        try {
            await login(username, password);
            navigate('/');
        } catch (err) {
            const msg =
                err.response?.data?.detail ||
                'Invalid username or password.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="brand-badge">
                    <img
                        src="/axiomity-logo.svg"
                        alt="Axiomity Logo"
                        className="brand-logo"
                    />
                </div>

                <h1>Welcome to Axiomity</h1>
                <p>Sign in to your intelligent trading workspace.</p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />

                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    {error && <p className="form-error">{error}</p>}

                    <button type="submit" disabled={submitting}>
                        {submitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="auth-link">
                    Don&apos;t have an account?{' '}
                    <Link to="/register">Register</Link>
                </p>
            </div>
        </div>
    );
}

export default Login;



import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Register.css';

function formatErrors(data) {
    if (!data) return 'Registration failed.';
    if (typeof data === 'string') return data;
    return Object.entries(data)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .join(' ');
}

function Register() {
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        password_confirm: '',
    });

    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { register, user } = useAuth();
    const navigate = useNavigate();

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
        setSubmitting(true);

        try {
            await register(form);
            navigate('/');
        } catch (err) {
            setError(formatErrors(err.response?.data));
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

                <h1>Create your account</h1>
                <p>Start building smarter stock decisions with Axiomity.</p>

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        name="username"
                        placeholder="Username"
                        value={form.username}
                        onChange={handleChange}
                        required
                    />

                    <input
                        type="email"
                        name="email"
                        placeholder="Email"
                        value={form.email}
                        onChange={handleChange}
                        required
                    />

                    <input
                        type="password"
                        name="password"
                        placeholder="Password"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />

                    <input
                        type="password"
                        name="password_confirm"
                        placeholder="Confirm Password"
                        value={form.password_confirm}
                        onChange={handleChange}
                        required
                    />

                    {error && <p className="form-error">{error}</p>}

                    <button type="submit" disabled={submitting}>
                        {submitting ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="auth-link">
                    Already have an account?{' '}
                    <Link to="/login">Login</Link>
                </p>
            </div>
        </div>
    );
}

export default Register;
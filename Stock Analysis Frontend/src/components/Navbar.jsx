import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();

    return (
        <nav className="navbar">
            <div className="navbar-brand-group">
                <img src="/axiomity-logo.svg" alt="Axiomity logo" className="brand-mark" />
                <div>
                    <p className="navbar-brand">Axiomity</p>
                    <p className="navbar-subtitle">Trading intelligence for modern investors</p>
                </div>
            </div>
            <div className="navbar-links">
                <Link className={"nav-link" + (location.pathname === '/' ? ' active' : '')} to="/">Dashboard</Link>
                <Link className={"nav-link" + (location.pathname === '/analysis' ? ' active' : '')} to="/analysis">Analysis</Link>
                <Link className={"nav-link" + (location.pathname === '/portfolio' ? ' active' : '')} to="/portfolio">Portfolio</Link>
            </div>
            <div className="navbar-actions">
                <button
                    type="button"
                    className="theme-toggle-btn"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? (
                        /* Sun Icon for switching to light */
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="5"></circle>
                            <line x1="12" y1="1" x2="12" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="23"></line>
                            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                            <line x1="1" y1="12" x2="3" y2="12"></line>
                            <line x1="21" y1="12" x2="23" y2="12"></line>
                            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                        </svg>
                    ) : (
                        /* Moon Icon for switching to dark */
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                    )}
                </button>

                <span className="welcome-text">Hi, {user?.username}</span>
                <button className="nav-logout-btn" onClick={logout}>Logout</button>
            </div>
        </nav>
    );
}

export default Navbar;

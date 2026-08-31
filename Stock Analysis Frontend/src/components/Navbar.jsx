import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayName = user?.first_name ? `${user.first_name} ${user.last_name ? user.last_name[0] + '.' : ''}` : (user?.username || 'Trader');
    const userInitial = (user?.first_name || user?.username || 'U')[0].toUpperCase();

    return (
        <nav className="navbar">
            <div className="navbar-brand-group">
                <Link to="/" className="navbar-brand-link">
                    <div className="brand-logo-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 22H7.5L12 12.5L16.5 22H22L12 2Z" fill="url(#nav-brand-grad)" />
                            <path d="M8.5 15.5L12 8L15.5 15.5H8.5Z" fill="#00e599" opacity="0.9" />
                            <defs>
                                <linearGradient id="nav-brand-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#38bdf8" />
                                    <stop offset="1" stopColor="#2563eb" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <span className="navbar-brand-text">Axiomity</span>
                </Link>
            </div>

            <div className="navbar-links">
                <Link className={"nav-link" + (location.pathname === '/' ? ' active' : '')} to="/">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px' }}>
                        <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
                        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
                        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
                        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
                    </svg>
                    Dashboard
                </Link>
                <Link className={"nav-link" + (location.pathname === '/analysis' ? ' active' : '')} to="/analysis">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="7 14 10 11 13 13 17 9" />
                    </svg>
                    Analysis
                </Link>
                <Link className={"nav-link" + (location.pathname === '/market-activity' ? ' active' : '')} to="/market-activity">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                    </svg>
                    Market Activity
                </Link>
                <Link className={"nav-link" + (location.pathname === '/portfolio' ? ' active' : '')} to="/portfolio">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    Portfolio
                </Link>

            </div>

            <div className="navbar-actions">
                <Link to="/analysis" className="nav-icon-btn" title="Search stocks">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                </Link>

                <div className="nav-user-menu-container" ref={userMenuRef}>
                    <button
                        type="button"
                        className="nav-user-pill"
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                    >
                        <div className="nav-user-avatar">
                            {userInitial}
                        </div>
                        <span className="nav-user-name">{displayName}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>

                    {userMenuOpen && (
                        <div className="nav-user-dropdown">
                            <div className="nav-dropdown-header">
                                <div className="nav-dropdown-name">{displayName}</div>
                                <div className="nav-dropdown-sub">@{user?.username}</div>
                            </div>
                            <div className="nav-dropdown-divider"></div>
                            <Link to="/portfolio" className="nav-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                </svg>
                                My Portfolio
                            </Link>
                            <Link to="/analysis" className="nav-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                                </svg>
                                Stock Screener
                            </Link>
                            <div className="nav-dropdown-divider"></div>
                            <button type="button" className="nav-dropdown-item logout" onClick={logout}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                </svg>
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

export default Navbar;

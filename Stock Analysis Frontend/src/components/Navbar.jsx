import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
    const { user, logout } = useAuth();
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
                <Link className={"nav-link" + (location.pathname === '/market-activity' ? ' active' : '')} to="/market-activity">FII / DII</Link>
                <Link className={"nav-link" + (location.pathname === '/portfolio' ? ' active' : '')} to="/portfolio">Portfolio</Link>
            </div>
            <div className="navbar-actions">
                <span className="welcome-text">Hi, {user?.username}</span>
                <button className="nav-logout-btn" onClick={logout}>Logout</button>
            </div>
        </nav>
    );
}

export default Navbar;

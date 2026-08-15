import React from 'react';
import Navbar from '../components/Navbar';
import FiiDiiActivity from '../components/FiiDiiActivity';

function MarketActivity() {
    return (
        <div className="app-shell">
            <Navbar />
            <main className="dashboard-page" style={{ paddingTop: '24px' }}>
                <FiiDiiActivity />
            </main>
        </div>
    );
}

export default MarketActivity;

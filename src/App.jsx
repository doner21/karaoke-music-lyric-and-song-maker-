import React, { useState, useEffect, lazy, Suspense } from "react";
import IntegratedEcologicalOS from './components/karaoke-designs/IntegratedEcologicalOS';

// Lazy-load verification panel to avoid bundling it in production
const VerificationLoader = lazy(() => import('./components/verify/VerificationLoader'));

function App() {
    const [route, setRoute] = useState(window.location.hash);

    useEffect(() => {
        const onHashChange = () => setRoute(window.location.hash);
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    // Route: #/verify → show verification panel
    if (route === '#/verify') {
        return (
            <Suspense fallback={<div style={{ background: '#111', color: '#fff', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Verification Panel...</div>}>
                <VerificationLoader />
            </Suspense>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            <IntegratedEcologicalOS />
        </div>
    );
}

export default App;

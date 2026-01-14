import React, { useState } from 'react';


// Import Designs
import IntegratedEcologicalOS from './components/karaoke-designs/IntegratedEcologicalOS';

const DESIGNS = [
    { id: 'ecological-v3', name: 'Ecological OS v3 (Integrated)', component: IntegratedEcologicalOS, description: 'Seeds: UI:25678 | YT:9901 | DL:12007 | SPLIT:33021' },
];

export default function KaraokeMakerUI() {
    const [currentDesignId, setCurrentDesignId] = useState('ecological-v3');


    const CurrentComponent = DESIGNS.find(d => d.id === currentDesignId)?.component || IntegratedEcologicalOS;

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black">



            {/* --- RENDERED DESIGN --- */}
            <div className="w-full h-full">
                <CurrentComponent />
            </div>

        </div>
    );
}

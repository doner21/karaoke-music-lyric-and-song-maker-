import React, { useState } from 'react';
import { LayoutTemplate, ChevronDown, Check } from 'lucide-react';

// Import Designs
import IntegratedEcologicalOS from './components/karaoke-designs/IntegratedEcologicalOS';

const DESIGNS = [
    { id: 'ecological-v3', name: 'Ecological OS v3 (Integrated)', component: IntegratedEcologicalOS, description: 'Seeds: UI:25678 | YT:9901 | DL:12007 | SPLIT:33021' },
];

export default function KaraokeMakerUI() {
    const [currentDesignId, setCurrentDesignId] = useState('ecological-v3');
    const [menuOpen, setMenuOpen] = useState(false);

    const CurrentComponent = DESIGNS.find(d => d.id === currentDesignId)?.component || IntegratedEcologicalOS;

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black">

            {/* --- DESIGN SWITCHER (Fixed Top Right) --- */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col items-end pointer-events-none">
                <div className="pointer-events-auto relative">
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="flex items-center gap-2 px-3 py-2 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl hover:bg-zinc-800 transition-all group"
                    >
                        <LayoutTemplate size={16} className="text-violet-400" />
                        <span className="text-xs font-bold text-zinc-300">
                            {DESIGNS.find(d => d.id === currentDesignId)?.name}
                        </span>
                        <ChevronDown size={14} className={`text-zinc-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {menuOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                            <div className="p-2 border-b border-white/5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider bg-black/20">
                                Select Archetype
                            </div>
                            <div className="p-1 space-y-0.5">
                                {DESIGNS.map(design => (
                                    <button
                                        key={design.id}
                                        onClick={() => {
                                            setCurrentDesignId(design.id);
                                            setMenuOpen(false);
                                        }}
                                        className={`
                                      w-full flex items-start gap-3 p-2 rounded-lg text-left transition-all
                                      ${currentDesignId === design.id ? 'bg-violet-600 text-white' : 'hover:bg-white/5 text-zinc-400 hover:text-zinc-200'}
                                  `}
                                    >
                                        <div className="mt-0.5">
                                            {currentDesignId === design.id && <Check size={12} />}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold">{design.name}</div>
                                            <div className={`text-[10px] ${currentDesignId === design.id ? 'text-violet-200' : 'text-zinc-500'}`}>{design.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* --- RENDERED DESIGN --- */}
            <div className="w-full h-full">
                <CurrentComponent />
            </div>

        </div>
    );
}

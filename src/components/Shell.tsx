import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Bell, User } from 'lucide-react';

interface ShellProps {
    activeView: string;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ activeView, onNavigate, onLogout, children }) => {
    // Top Bar Component (Internal)
    const TopBar = () => (
        <div className="flex items-center justify-between px-6 pt-6 pb-8 text-white">
            <button className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors relative">
                <Bell size={24} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-[#00A0E9]" />
            </button>

            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold">S</div>
                <h1 className="font-heading font-bold text-xl tracking-tight">ServiceHQ</h1>
            </div>

            <button className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors">
                <User size={24} />
            </button>
        </div>
    );

    return (
        <div className="min-h-screen w-full bg-[#F4F6F8] flex">

            {/* Desktop Sidebar (Hidden on Mobile) */}
            <div className="hidden md:flex h-screen sticky top-0 z-30">
                <Sidebar
                    activeView={activeView}
                    onNavigate={onNavigate}
                    isOpen={true} // Always open on desktop for this layout
                    onClose={() => { }}
                    onLogout={onLogout}
                />
            </div>

            {/* Main Content Area */}
            <main className="flex-1 relative flex flex-col h-screen overflow-hidden">
                {/* Scrollable Container */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                    {/* Blue Curved Header Background */}
                    <div className="relative bg-[#00A0E9] rounded-b-[40px] md:rounded-b-none md:h-48 pb-12 transition-all">
                        <TopBar />
                    </div>

                    {/* Content Overlap Wrapper */}
                    <div className="px-6 -mt-12 pb-24 md:pb-6 relative z-10 max-w-7xl mx-auto w-full">
                        {/* Pass children. Some views might need to control their own header, but standard dashboard sits here */}
                        {typeof children === 'function' ? children({}) : children}
                    </div>
                </div>

                {/* Mobile Bottom Navigation (Fixed z-50) */}
                <BottomNav activeView={activeView} onNavigate={onNavigate} />
            </main>
        </div>
    );
};

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
                    {/* Blue Top Bar */}
                    <div className="h-16 bg-[#0091FF] flex items-center justify-between px-6 shadow-sm sticky top-0 z-40">
                        {/* Left: Notifications */}
                        <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                            <Bell size={20} />
                        </button>

                        {/* Center: Enterprise Label */}
                        <div className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full flex items-center gap-2">
                            <div className="w-5 h-5 bg-white/20 rounded flex items-center justify-center text-white text-xs font-bold">S</div>
                            <span className="text-white text-sm font-medium">ServiceHQ Enterprise</span>
                        </div>

                        {/* Right: Profile */}
                        <button className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
                            <User size={20} />
                        </button>
                    </div>

                    {/* Content Overlap Wrapper */}
                    <div className="p-6 relative z-10 max-w-7xl mx-auto w-full">
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

import React, { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Menu, ChevronLeft, RefreshCw, Cloud, Bell, User } from 'lucide-react';
import { UserProfile, useJobs } from '../context/JobContext';

interface ShellProps {
    children: (props: { isSidebarOpen: boolean }) => ReactNode;
    activeView: string;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    userProfile?: UserProfile | null;
}

export const Shell: React.FC<ShellProps> = ({ children, activeView, onNavigate, onLogout, userProfile }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { pendingUploads } = useJobs();

    return (
        <div className="min-h-screen bg-[var(--color-bg-app)] flex font-sans text-slate-800 selection:bg-[var(--color-primary)]/20 selection:text-[var(--color-primary)]">

            {/* Overlay for mobile sidebar */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar
                activeView={activeView}
                onNavigate={(view) => {
                    onNavigate(view);
                    setIsSidebarOpen(false);
                }}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onLogout={onLogout}
                userProfile={userProfile || null}
            />

            {/* Main Content Area */}
            <main className="flex-1 relative flex flex-col h-screen overflow-hidden">
                {/* Scrollable Container */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                    {/* Glassy Top Bar */}
                    <div className="h-16 flex items-center justify-between px-6 sticky top-0 z-40 bg-white/10 backdrop-blur-md border-b border-white/20">
                        {/* Left: Optional Branding on mobile or Breadcrumbs */}
                        <div className="flex items-center gap-3">
                            {/* Mobile Sidebar Toggle could go here if implemented properly */}
                            <span className="text-[var(--color-primary)] font-bold text-lg md:hidden">FSD.PRO</span>
                        </div>

                        {/* Center: Enterprise Label (Desktop) */}
                        <div className="hidden md:flex bg-[var(--color-primary)]/10 backdrop-blur-sm px-4 py-1.5 rounded-full items-center gap-2 border border-[var(--color-primary)]/20">
                            <div className="w-5 h-5 bg-[var(--color-primary)] rounded flex items-center justify-center text-white text-xs font-bold shadow-sm">F</div>
                            <span className="text-[var(--color-primary)] text-sm font-medium">FSD.PRO</span>
                        </div>

                        {/* Right: Notifications & Profile */}
                        <div className="flex items-center gap-2">
                            {/* Sync Status Indicator */}
                            <div className="mr-2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/40 border border-white/50 backdrop-blur-sm shadow-sm">
                                {pendingUploads > 0 ? (
                                    <>
                                        <RefreshCw size={14} className="text-[var(--color-primary)] animate-spin" />
                                        <span className="text-xs font-bold text-[var(--color-primary)]">Syncing ({pendingUploads})...</span>
                                    </>
                                ) : (
                                    <>
                                        <Cloud size={14} className="text-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-600 hidden md:inline">Synced</span>
                                    </>
                                )}
                            </div>

                            <button className="p-2 text-slate-500 hover:bg-white/40 hover:text-[var(--color-primary)] rounded-full transition-all">
                                <Bell size={20} />
                            </button>
                            <button className="p-2 text-slate-500 hover:bg-white/40 hover:text-[var(--color-primary)] rounded-full transition-all">
                                <User size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content Overlap Wrapper */}
                    <div className="p-4 md:p-6 relative z-10 max-w-7xl mx-auto w-full">
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

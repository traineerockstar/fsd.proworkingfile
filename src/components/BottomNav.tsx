import React from 'react';
import { Home, Calendar, Plus, FileText, Clock } from 'lucide-react';

interface BottomNavProps {
    activeView: string;
    onNavigate: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeView, onNavigate }) => {
    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-2 pb-6 z-50 flex justify-between items-end shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <NavItem
                icon={<Home size={24} />}
                label="Home"
                isActive={activeView === 'dashboard'}
                onClick={() => onNavigate('dashboard')}
            />

            <NavItem
                icon={<Calendar size={24} />}
                label="Calendar"
                isActive={activeView === 'schedule'}
                onClick={() => onNavigate('schedule')}
            />

            {/* Central Floating Action Button */}
            <div className="relative -top-6">
                <button className="w-14 h-14 bg-[#00A0E9] rounded-full shadow-lg shadow-blue-500/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all">
                    <Plus size={28} strokeWidth={3} />
                </button>
            </div>

            <NavItem
                icon={<FileText size={24} />}
                label="Document"
                isActive={activeView === 'jobs'}
                onClick={() => onNavigate('jobs')}
            />

            <NavItem
                icon={<Clock size={24} />}
                label="Timesheet"
                isActive={activeView === 'timesheet'}
                onClick={() => onNavigate('timesheet')}
            />
        </div>
    );
};

const NavItem: React.FC<{ icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#00A0E9]' : 'text-slate-400 hover:text-slate-600'}`}
    >
        {icon}
        <span className="text-[10px] font-bold tracking-wide">{label}</span>
    </button>
);

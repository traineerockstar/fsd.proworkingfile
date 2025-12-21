import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Calendar, Settings, LogOut, CheckSquare, MessageSquare, Wrench, Package, Menu as SidebarLeftIcon, Eye, EyeOff } from 'lucide-react';

import { UserProfile } from '../context/JobContext';
import { usePrivacy } from '../context/PrivacyContext';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userProfile: UserProfile | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, isOpen, onClose, onLogout, userProfile }) => {
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy();
  const navItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: "Today's Dashboard" },
    { id: 'jobs', icon: <CheckSquare size={20} />, label: 'Create Jobs' },
    { id: 'schedule', icon: <Calendar size={20} />, label: 'Schedule' },
    { id: 'messages', icon: <MessageSquare size={20} />, label: 'Messages' },
    { id: 'spo-parts', icon: <Package size={20} />, label: 'SPO Parts' },
    { id: 'tools', icon: <Wrench size={20} />, label: 'Tools' },
    { id: 'settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  return (
    <aside
      className={`fixed md:relative left-0 top-0 h-full w-72 flex flex-col z-50 md:z-auto transition-transform duration-300 ease-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
      bg-white/40 backdrop-blur-xl border-r border-white/40 shadow-[var(--shadow-glass)] md:shadow-none md:rounded-r-none rounded-r-3xl md:bg-transparent md:border-r-0`}
    >
      <div className="flex flex-col h-full px-4 py-8 md:my-4 md:ml-4 md:rounded-3xl card-glass"> {/* "Float" the desktop sidebar */}

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-10 pl-2">
          <div className="w-10 h-10 bg-[var(--color-primary)] rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center text-white font-bold text-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            F
          </div>
          <h1 className="text-xl font-bold text-[var(--color-secondary)] tracking-tight">
            FSD.PRO
          </h1>
          <button onClick={onClose} className="md:hidden ml-auto p-2 text-slate-400 hover:text-slate-600">
            <SidebarLeftIcon />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium group relative overflow-hidden ${isActive
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'text-slate-500 hover:text-[var(--color-text-main)] hover:bg-white/40'
                  }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--color-primary)] rounded-r-lg"
                  />
                )}

                <span className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-[var(--color-primary)]' : 'group-hover:text-[var(--color-text-main)]'} group-hover:scale-110 duration-200`}>
                  {item.icon}
                </span>
                <span className="relative z-10 text-sm">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer User Profile */}
        <div className="mt-auto pt-6 border-t border-slate-200/50">
          <button
            onClick={togglePrivacy}
            className={`w-full flex items-center justify-center p-3 rounded-xl mb-4 transition-all duration-300 font-bold ${isPrivacyEnabled
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
          >
            {isPrivacyEnabled ? <EyeOff size={20} /> : <Eye size={20} />}
            <span className="ml-3">
              {isPrivacyEnabled ? 'Privacy ON' : 'Privacy OFF'}
            </span>
          </button>

          <div className="flex items-center gap-3 px-2 mb-4 p-2 rounded-xl hover:bg-white/40 transition-colors cursor-pointer group">
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden group-hover:scale-105 transition-transform">
              <img
                src={userProfile?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.given_name || 'Engineer'}`}
                alt="User"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-800 truncate">{userProfile?.name || 'Engineer'}</h4>
              <p className="text-xs text-slate-500 truncate">Field Service Engineer</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-rose-500 hover:bg-rose-50/50 rounded-xl transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

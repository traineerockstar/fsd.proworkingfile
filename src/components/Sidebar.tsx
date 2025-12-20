import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Calendar, Settings, LogOut, CheckSquare, MessageSquare, Wrench, Menu as SidebarLeftIcon } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, isOpen, onClose, onLogout }) => {
  const navItems = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { id: 'jobs', icon: <CheckSquare size={20} />, label: 'Jobs' },
    { id: 'schedule', icon: <Calendar size={20} />, label: 'Schedule' },
    { id: 'messages', icon: <MessageSquare size={20} />, label: 'Messages' },
    { id: 'tools', icon: <Wrench size={20} />, label: 'Tools' },
    { id: 'settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  return (
    <aside
      className={`fixed md:relative left-0 top-0 h-full w-72 flex flex-col z-50 md:z-auto transition-transform duration-300 ease-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'} bg-white border-r border-slate-200 shadow-xl md:shadow-none`}
    >
      <div className="flex flex-col h-full bg-white px-4 py-8">

        {/* Brand Header */}
        <div className="flex items-center justify-between mb-10 pl-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
              S
            </div>
            <h1 className="text-xl font-heading font-bold text-slate-800 tracking-tight">
              Service<span className="text-blue-500">HQ</span>
            </h1>
          </div>
          <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:text-slate-600">
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
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 font-medium group relative ${isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-lg" />
                )}

                <span className={`relative z-10 transition-colors duration-200 ${isActive ? 'text-blue-500' : 'group-hover:text-slate-600'}`}>
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
        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 px-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
              {/* Placeholder Avatar */}
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-800 truncate">Alex Walker</h4>
              <p className="text-xs text-slate-500 truncate">Senior Technician</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};


import React from 'react';
import {
  CalendarIcon,
  ClockIcon,
  PlusIcon,
  ChatIcon,
  SidebarLeftIcon
} from './Icons';
import { Settings } from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, isOpen, onClose }) => {

  const navItems = [
    { id: 'yesterday', label: 'Yesterday', icon: <ClockIcon /> },
    { id: 'today', label: 'Today', icon: <CalendarIcon /> },
    { id: 'tomorrow', label: 'Tomorrow', icon: <PlusIcon /> },
    { id: 'messages', label: 'Messages', icon: <ChatIcon /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <aside
      className={`fixed left-0 top-0 h-full w-20 md:w-64 flex flex-col backdrop-blur-xl bg-black/40 border-r border-white/10 z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
    >
      {/* Logo Area */}
      <div className="h-20 flex items-center justify-between px-4 md:px-6 border-b border-white/5">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-[0_0_15px_rgba(6,182,212,0.5)] flex-shrink-0" />
          <span className="hidden md:block ml-3 font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
            FSD.Pro
          </span>
        </div>

        {/* Collapse Button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Collapse Sidebar"
        >
          <SidebarLeftIcon />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-8 space-y-2 px-2 md:px-4">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-center md:justify-start p-3 md:px-4 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] border border-cyan-500/20'
                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-cyan-500 rounded-r-full shadow-[0_0_10px_#06b6d4]" />
              )}

              <span className={`relative z-10 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>

              <span className={`hidden md:block ml-3 text-sm font-medium relative z-10 ${isActive ? 'text-cyan-100' : ''}`}>
                {item.label}
              </span>

              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-cyan-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </button>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center justify-center md:justify-start gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
          <div className="w-8 h-8 rounded-full bg-slate-700 border border-white/10" />
          <div className="hidden md:block">
            <p className="text-xs font-bold text-slate-300">Matt Engineer</p>
            <p className="text-[10px] text-cyan-500">Online</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

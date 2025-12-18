import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';

interface ShellProps {
    activeView: string;
    onNavigate: (view: string) => void;
    onLogout: () => void;
    children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ activeView, onNavigate, onLogout, children }) => {
    // State for mobile sidebar toggle
    // Default: Closed on mobile, but we check window width on mount to be safe, 
    // though purely 'false' start is fine for mobile-first.
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Effect to close sidebar on view change (mobile UX best practice)
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(false); // Reset/Close toggle state on desktop as it's not needed (sidebar is fixed)
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleNavigate = (view: string) => {
        onNavigate(view);
        setIsSidebarOpen(false); // Auto-close on navigation (mobile)
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black text-white font-sans flex overflow-hidden relative">

            {/* Sidebar Component - Handles its own responsive "Fixed vs Drawer" behavior based on isOpen prop */}
            {/* Note: Sidebar component needs to support 'isOpen' for mobile slide-in. 
                On Desktop, we expect it to be statically positioned or handled by CSS grid/flex.
                Let's check existing Sidebar implementation. It seems to use 'fixed' positioning.
            */}
            <Sidebar
                activeView={activeView}
                onNavigate={handleNavigate}
                onLogout={onLogout}
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
            />

            {/* Main Content Area */}
            {/* 
                Desktop: ml-72 (288px) to offset fixed sidebar (Sidebar is w-72).
                Mobile: ml-0.
                Transition for smooth resize if needed, though usually sidebar is just modal on mobile.
            */}
            <div className={`flex-1 h-screen overflow-y-auto transition-all duration-300 md:ml-72 ml-0`}>

                {/* Mobile Header / Toggle Area (Integrated into Shell logic?) 
                    Actually, Dashboard usually has the Header. 
                    If we want the Shell to be the *container*, we just render children here.
                    The current Dashboard has the Header *inside* the main content area.
                    We will let the children (Dashboard content) render the header for now to minimize refactor risk,
                    BUT we must ensure the `setIsOpen` functionality is available to the header if it lives inside children.
                    
                    WAIT: If Dashboard renders the Header, it needs `setIsOpen`. 
                    Refactor Strategy: Pass `setIsSidebarOpen` down? Or Context?
                    Simple Prop Drilling is safest for now if we don't want to over-engineer.
                    HOWEVER, standard pattern: Shell renders the layout structure.
                    If the header is part of the layout (which it is), Shell *could* render it.
                    Let's stick to the prompt: Shell acts as CONTAINER.
                    We will wrap the Dashboard's content.
                    We need to expose the ability to Open Sidebar to the children?
                    
                    Actually, usually the Toggle Button is part of the Layout (Shell).
                    Let's Add the Toggle Button HERE in the Shell if it's not in the View?
                    Current Dashboard has the Header with the toggle.
                    
                    Let's try to match the existing visual:
                    The "Glass Sheet" instruction implies a wrapper around the *content*.
                */}

                <main className="p-4 h-full">
                    {/* The Glass Shell Container */}
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl h-full overflow-hidden flex flex-col relative shadow-2xl">
                        {/* 
                            We clone the children to pass the `isSidebarOpen` setter if possible?
                            No, that's brittle.
                            
                            Better: We export a ShellContext or just accept that Dashboard will still manage the Header?
                            The user said: "The Main Content area should look like a 'sheet' of glass".
                            
                            Let's implement the wrapper here.
                            For the Sidebar Toggle: We can pass it as a prop render function?
                            Or simpler: Just render children. 
                            If children need to toggle sidebar, they might be stuck unless we pass props.
                            
                            Let's look at Dashboard.tsx again. It has the header.
                            If we move the Header code INTO Shell, we decouple it from specific views.
                            But Dashboard Header changes title based on view.
                            
                            Let's Clone Element strategy for simple Refactor or just pass a "header" prop?
                            Let's stick to wrapping. 
                            
                            CRITICAL: The prompt says "Handle isSidebarOpen state correctly".
                            If we move state to Shell, Dashboard loses it.
                            We will pass `toggleSidebar` as a prop to children, 
                            OR we assume `Sidebar` handles the toggle button?
                            Sidebar usually has the close button. The Open button is in the Header.
                            
                            Let's use a Render Prop pattern for maximum flexibility if we keep Header in Dashboard.
                            <Shell ... >
                               {({ toggleSidebar }) => <DashboardContent onToggle={toggleSidebar} />}
                            </Shell>
                        */}
                        {typeof children === 'function'
                            ? (children as any)({ toggleSidebar: () => setIsSidebarOpen(true) })
                            : children
                        }
                    </div>
                </main>
            </div>
        </div>
    );
};

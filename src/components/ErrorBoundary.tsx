import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 max-w-md w-full backdrop-blur-xl shadow-2xl">
                        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
                            <AlertTriangle size={32} />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
                        <p className="text-slate-400 mb-6">
                            The application encountered an unexpected error. This is usually due to malformed data.
                        </p>

                        {this.state.error && (
                            <div className="bg-black/30 rounded-xl p-4 mb-6 text-left overflow-hidden">
                                <p className="font-mono text-xs text-red-400 break-all">
                                    {this.state.error.toString()}
                                </p>
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-white text-black hover:bg-slate-200 transition-all rounded-xl font-bold flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={18} />
                            <span>Reload Dashboard</span>
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

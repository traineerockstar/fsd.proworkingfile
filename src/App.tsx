import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { Loader } from './components/Loader';
import { JobProvider } from './context/JobContext';
import { AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

// Replace with your actual Client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

const App: React.FC = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Simulate initial app loading / splash screen
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (token: string) => {
    console.log("[@Chief-Architect]: Authentication successful. Token received and stored in App State.");
    setAccessToken(token);
  };

  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50">
        <Loader size="lg" />
        <p className="mt-4 text-slate-400 font-medium animate-pulse">Initializing FSD.PRO...</p>
      </div>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AnimatePresence mode="wait">
        {!accessToken ? (
          <LoginScreen key="login" onLogin={handleLogin} />
        ) : (
          <JobProvider accessToken={accessToken}>
            <ErrorBoundary>
              <Dashboard key="dashboard" />
            </ErrorBoundary>
          </JobProvider>
        )}
      </AnimatePresence>
      <Toaster position="top-right" theme="dark" />
    </GoogleOAuthProvider>
  );
};

export default App;

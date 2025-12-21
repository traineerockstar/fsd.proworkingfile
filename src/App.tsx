import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { Loader } from './components/Loader';
import { JobProvider } from './context/JobContext';
import { PrivacyProvider } from './context/PrivacyContext';
import { AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'sonner';

// Replace with your actual Client ID
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";

const App: React.FC = () => {
  console.log("App Component Rendering...");
  // TEMPORARY: Mock token for screenshot capture
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
          <PrivacyProvider>
            <JobProvider accessToken={accessToken}>
              <ErrorBoundary>
                <Dashboard
                  key="dashboard"
                  accessToken={accessToken}
                  onLogout={() => setAccessToken(null)}
                />
              </ErrorBoundary>
            </JobProvider>
          </PrivacyProvider>
        )}
      </AnimatePresence>
      <Toaster
        position="top-right"
        theme="light"
        richColors
        toastOptions={{
          style: {
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
          },
          className: 'font-sans'
        }}
      />
    </GoogleOAuthProvider>
  );
};

export default App;

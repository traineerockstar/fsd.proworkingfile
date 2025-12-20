import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { JobProvider } from './context/JobContext';
import { initializeKnowledge } from './services/localKnowledge';

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [knowledgeReady, setKnowledgeReady] = useState(false);

  useEffect(() => {
    console.log("🔐 App accessToken changed:", accessToken ? "✅ Token exists" : "❌ No token");
  }, [accessToken]);

  // Initialize local knowledge base on startup
  useEffect(() => {
    async function loadKnowledge() {
      await initializeKnowledge();
      setKnowledgeReady(true);
      console.log("✅ Knowledge base ready");
    }
    loadKnowledge();
  }, []);

  if (!knowledgeReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Loading Oscar's knowledge base...</p>
        </div>
      </div>
    );
  }

  return (
    <JobProvider accessToken={accessToken}>
      {accessToken ? (
        <Dashboard accessToken={accessToken} onLogout={() => setAccessToken(null)} />
      ) : (
        <LoginScreen onLogin={(token) => {
          console.log("📥 App received token from LoginScreen:", token);
          setAccessToken(token);
        }} />
      )}
    </JobProvider>
  );
}

export default App;

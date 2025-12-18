
import React, { useState } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { JobProvider } from './context/JobContext';

function App() {
  const [accessToken, setAccessToken] = useState<string | null>("mock-token");

  return (
    <JobProvider accessToken={accessToken}>
      {accessToken ? (
        <Dashboard accessToken={accessToken} onLogout={() => setAccessToken(null)} />
      ) : (
        <LoginScreen onLogin={(token) => setAccessToken(token)} />
      )}
    </JobProvider>
  );
}

export default App;

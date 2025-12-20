// [Step 1] Entry Point Loading
console.log('🚀 [Step 1] Entry Point Loaded! File: src/main.tsx');

// [Step 2] Import Stage
console.log('🔵 [Step 2] Starting imports...');

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('✅ [Step 2] All imports successful!');

try {
  // [Step 3] DOM Check
  console.log('🔵 [Step 3] Checking for root element...');
  const rootElement = document.getElementById('root');

  if (!rootElement) {
    console.error('❌ [CRITICAL] Root element not found! Check index.html for <div id="root"></div>');
    throw new Error('Root element #root not found in DOM');
  }

  console.log('✅ [Step 3] Root element found:', rootElement);

  // [Step 4] React Root Creation
  console.log('🔵 [Step 4] Creating React root...');
  const root = ReactDOM.createRoot(rootElement);
  console.log('✅ [Step 4] React root created successfully');

  // [Step 5] Rendering
  console.log('🔵 [Step 5] Rendering App component...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('✅ [Step 5] App.render() called successfully');

  console.log('🎉 [SUCCESS] index.tsx execution complete!');

} catch (error: any) {
  console.error('💥 [FATAL ERROR] Exception in index.tsx:', error);
  console.error('Stack trace:', error?.stack);

  // Show error on page if possible
  document.body.innerHTML = `
    <div style="background: black; color: red; padding: 20px; font-family: monospace;">
      <h1>⚠️ Application Failed to Start</h1>
      <h2>Error in index.tsx:</h2>
      <pre>${error?.message}</pre>
      <h3>Stack:</h3>
      <pre>${error?.stack}</pre>
      <p>Check browser console for more details</p>
    </div>
  `;
}

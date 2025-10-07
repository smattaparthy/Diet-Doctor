import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import App from './App';

// Error boundary for graceful error handling
import ErrorBoundary from './components/common/ErrorBoundary';

// Service worker for offline capabilities
import './registerServiceWorker';

// Hide loading screen
const hideLoadingScreen = () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
    setTimeout(() => {
      if (loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }, 500);
  }
};

// Initialize app
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Hide loading screen after app mounts
setTimeout(hideLoadingScreen, 500);
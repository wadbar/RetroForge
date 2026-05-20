import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.tsx';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import './index.css';

window.addEventListener('error', (event) => {
  console.error('[TELEMETRIA] UNCAUGHT_EXCEPTION:', {
    message: event.message,
    filename: event.filename,
    line: event.lineno,
    col: event.colno,
    error: event.error,
    timestamp: new Date().toISOString()
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[TELEMETRIA] UNHANDLED_REJECTION:', {
    reason: event.reason,
    timestamp: new Date().toISOString()
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </GlobalErrorBoundary>
  </StrictMode>,
);

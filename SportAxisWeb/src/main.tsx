import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './styles/index.css';

// Suppress known recharts duplicate key warnings from third-party library
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: any[]) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('Encountered two children with the same key') ||
     message.includes('Keys should be unique'))
  ) {
    return; // Suppress recharts internal warnings
  }
  originalError(...args);
};

console.warn = (...args: any[]) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    (message.includes('Encountered two children with the same key') ||
     message.includes('Keys should be unique'))
  ) {
    return; // Suppress recharts internal warnings
  }
  originalWarn(...args);
};

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
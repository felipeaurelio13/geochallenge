import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './i18n';
import './index.css';

// Fire-and-forget ping to wake backend before the user needs it
const _backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
fetch(`${_backendBase}/ping`).catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initOneSignal } from './utils/onesignal';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service Worker registration warning:', err);
    });
  });
}

void initOneSignal();

createRoot(document.getElementById('root')!).render(<App />);

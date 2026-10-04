import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Save Admin UPI ID to localStorage key "admin_upi_id" on app start
if (typeof window !== 'undefined') {
  try {
    localStorage.setItem('admin_upi_id', 'rajasuvimarriage09-1@okhdfcbank');
  } catch {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

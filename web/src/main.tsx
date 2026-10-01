import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { fonts } from './config';
import './styles.css';
import { AccountProvider } from './AccountContext';
import { AppErrorBoundary } from './AppErrorBoundary';
for (const [role, family] of Object.entries(fonts)) document.documentElement.style.setProperty(`--font-${role}`, `"${family}"`);
createRoot(document.getElementById('root')!).render(<StrictMode><AppErrorBoundary><AccountProvider><App /></AccountProvider></AppErrorBoundary></StrictMode>);

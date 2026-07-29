import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppShell } from './pages/AppShell';
import { AuthProvider } from './providers/AuthProvider';
import { ShopProvider } from './providers/ShopProvider';
import { SettingsProvider } from './providers/SettingsProvider';
import './index.css';

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthProvider>
        <SettingsProvider>
          <ShopProvider>
            <BrowserRouter>
              <AppShell />
            </BrowserRouter>
          </ShopProvider>
        </SettingsProvider>
      </AuthProvider>
    </StrictMode>,
  );
} catch (error) {
  console.error("RepairSync failed to start", error);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="min-height:100vh;background:#09090b;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;">
        <div style="max-width:420px;border:1px solid #27272a;border-radius:16px;padding:24px;background:#18181b;">
          <h1 style="margin:0 0 8px;font-size:20px;">RepairSync could not start</h1>
          <p style="margin:0;color:#a1a1aa;font-size:14px;line-height:1.5;">Close and reopen the app. If this stays on screen, the startup error has been logged for debugging.</p>
        </div>
      </div>
    `;
  }
}

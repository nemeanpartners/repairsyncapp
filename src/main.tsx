import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppShell } from './pages/AppShell';
import { AuthProvider } from './providers/AuthProvider';
import { ShopProvider } from './providers/ShopProvider';
import { SettingsProvider } from './providers/SettingsProvider';
import './index.css';

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

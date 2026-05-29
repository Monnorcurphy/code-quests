import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './app';
import AppShell from './components/app-shell';
import { queryClient } from './lib/query-client';
import { applyReducedMotionPreference } from './components/settings-button';
import { AudioProvider } from './audio/audio-provider';
import { useTownStore } from './stores/town-store';
import './styles/global.css';
import './styles/features.css';

applyReducedMotionPreference();

if (import.meta.env.DEV) {
  Object.assign(window, { __townStore: useTownStore });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AudioProvider>
          <AppShell>
            <App />
          </AppShell>
        </AudioProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

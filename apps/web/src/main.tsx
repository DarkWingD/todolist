import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Providers } from './lib/Providers';
import { ThemeProvider } from './theme/ThemeProvider';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <Providers>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Providers>
  </StrictMode>,
);

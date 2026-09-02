import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { storage } from './platform';
import { setStorage } from './store/memory';
import './styles/index.css';

// Decided once, before anything reads or writes: a real file on the device, or
// localStorage in a browser.
setStorage(storage);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

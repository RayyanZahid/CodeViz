import { createRoot } from 'react-dom/client';
import { WsClient } from './ws/wsClient.js';
import { App } from './App.js';

// Initialize WebSocket client as a module-level singleton BEFORE React mount.
// IMPORTANT: NOT inside a React component — avoids double-connection from
// React StrictMode double-invoke. Phase 5 pattern preserved.
const wsClient = new WsClient();
wsClient.connect();

// Mount React root — no StrictMode wrapper to avoid Konva double-mount issues.
// See RESEARCH.md Pitfall 1: StrictMode double-invokes useEffect, breaking
// imperative Konva subscriptions.
const root = createRoot(document.getElementById('app')!);
root.render(<App />);

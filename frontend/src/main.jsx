import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initOffline } from './lib/offline'

// טוענים קודם את העותק המקומי (IndexedDB) כדי שהאפליקציה תעלה עם נתונים גם בלי רשת
initOffline().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/talap/sw.js').catch(() => {});
  });
}

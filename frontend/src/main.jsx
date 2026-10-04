import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initWebVitals } from './utils/webVitals.js'

// Start web vitals monitoring in dev (no-op in production)
initWebVitals();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

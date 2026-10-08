import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

try { document.documentElement.dataset.theme = localStorage.getItem('indians-theme') || 'tricolour'; } catch { document.documentElement.dataset.theme = 'tricolour'; }
createRoot(document.getElementById('root')).render(<App />);

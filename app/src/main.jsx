import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Polyfill para window.storage (simulación de almacenamiento persistente)
if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    get: async (key, shared = false) => {
      const storageKey = shared ? `shared-${key}` : key;
      const value = localStorage.getItem(storageKey);
      if (value === null) {
        throw new Error('Key not found');
      }
      return { key, value, shared };
    },
    set: async (key, value, shared = false) => {
      const storageKey = shared ? `shared-${key}` : key;
      localStorage.setItem(storageKey, value);
      return { key, value, shared };
    },
    delete: async (key, shared = false) => {
      const storageKey = shared ? `shared-${key}` : key;
      localStorage.removeItem(storageKey);
      return { key, deleted: true, shared };
    },
    list: async (prefix = '', shared = false) => {
      const keys = [];
      const storagePrefix = shared ? `shared-${prefix}` : prefix;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(storagePrefix)) {
          keys.push(key.replace(/^shared-/, ''));
        }
      }
      return { keys, prefix, shared };
    }
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

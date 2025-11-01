// Fix: Manually include global type definitions to ensure custom JSX elements are recognized.
/// <reference path="./global.d.ts" />

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppKitProvider } from './components/AppKitProvider';
import './index.css';


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppKitProvider>
      <App />
    </AppKitProvider>
  </React.StrictMode>
);
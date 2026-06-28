import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { store } from './store';
import { queryClient } from './lib/queryClient';
import App from './App';

import './index.css';

const stored =
  typeof window !== 'undefined'
    ? window.localStorage.getItem('safarmate.theme') ??
      window.localStorage.getItem('invoiceflow.theme')
    : null;
if (stored === 'light') document.documentElement.classList.remove('dark');
else document.documentElement.classList.add('dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster richColors position="top-right" theme="dark" />
        </BrowserRouter>
      </QueryClientProvider>
    </ReduxProvider>
  </React.StrictMode>
);

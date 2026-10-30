import { Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { Skeleton } from './components/ui/skeleton';

const LandingPage = lazy(() => import('./pages/Landing'));
const LoginPage = lazy(() => import('./pages/auth/Login'));
const RegisterPage = lazy(() => import('./pages/auth/Register'));
const DashboardPage = lazy(() => import('./pages/app/Dashboard'));
const CustomersPage = lazy(() => import('./pages/app/Customers'));
const ProductsPage = lazy(() => import('./pages/app/Products'));
const InvoicesPage = lazy(() => import('./pages/app/Invoices'));
const InvoiceBuilderPage = lazy(() => import('./pages/app/InvoiceBuilder'));
const InvoiceDetailPage = lazy(() => import('./pages/app/InvoiceDetail'));
const SettingsPage = lazy(() => import('./pages/app/Settings'));
const LedgerPage = lazy(() => import('./pages/app/Ledger'));
const FlightsPage = lazy(() => import('./pages/app/Flights'));
const FlightInvoicesPage = lazy(() => import('./pages/app/FlightInvoices'));

function PageFallback() {
  return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/new" element={<InvoiceBuilderPage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="invoices/:id/edit" element={<InvoiceBuilderPage />} />
          <Route path="ledger" element={<LedgerPage />} />
          <Route path="ledger/:customerId" element={<LedgerPage />} />
          <Route path="flights" element={<FlightsPage />} />
          <Route path="flight-invoices" element={<FlightInvoicesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="*"
          element={
            <div className="grid min-h-screen place-items-center bg-background text-foreground">
              <div className="text-center">
                <p className="text-6xl font-display font-bold text-gradient">404</p>
                <p className="mt-2 text-muted-foreground">This page took a detour.</p>
                <a className="mt-6 inline-block text-secondary hover:underline" href="/">
                  Go home
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}

import { useEffect, useState } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SetupAdminPage } from './pages/SetupAdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { NewBookingPage } from './pages/NewBookingPage';
import { BookingsPage } from './pages/BookingsPage';
import { OperationsPage } from './pages/OperationsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { UsersPage } from './pages/UsersPage';
import { ActivityPage } from './pages/ActivityPage';
import { ManageResourcesPage } from './pages/ManageResourcesPage';
import { RulesPage } from './pages/RulesPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowSplash(false), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  return <BrowserRouter><AuthProvider>{showSplash ? <SplashScreen /> : <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/setup" element={<SetupAdminPage />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="dashboard" element={<DashboardPage />} />
      <Route path="resources" element={<ProtectedRoute permission="bookings.create"><ResourcesPage /></ProtectedRoute>} />
      <Route path="book" element={<ProtectedRoute permission="bookings.create"><NewBookingPage /></ProtectedRoute>} />
      <Route path="bookings" element={<BookingsPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="operations" element={<ProtectedRoute permission="issues.manage"><OperationsPage /></ProtectedRoute>} />
      <Route path="analytics" element={<ProtectedRoute permission="analytics.read"><AnalyticsPage /></ProtectedRoute>} />
      <Route path="manage-resources" element={<ProtectedRoute permission={['labs.manage', 'labs.availability', 'equipment.manage']}><ManageResourcesPage /></ProtectedRoute>} />
      <Route path="rules" element={<ProtectedRoute permission="rules.manage"><RulesPage /></ProtectedRoute>} />
      <Route path="users" element={<ProtectedRoute permission="users.manage"><UsersPage /></ProtectedRoute>} />
      <Route path="activity" element={<ProtectedRoute permission="activity.read"><ActivityPage /></ProtectedRoute>} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>}</AuthProvider></BrowserRouter>;
}

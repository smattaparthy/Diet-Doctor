import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ApiProvider } from './contexts/ApiContext';

// Components
import Navigation from './components/layout/Navigation';
import LoadingScreen from './components/common/LoadingScreen';

// Pages
import OnboardingPage from './pages/OnboardingPage';
import DashboardPage from './pages/DashboardPage';
import MealPlanPage from './pages/MealPlanPage';
import RecipePage from './pages/RecipePage';
import ShoppingListPage from './pages/ShoppingListPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// Styles
import './styles/App.css';

// Main App Component
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(window.electronAPI !== undefined);

    // Set up Electron API listeners
    if (window.electronAPI) {
      window.electronAPI.onMenuAction((action: string) => {
        console.log('Menu action:', action);
        // Handle menu actions for import/export
        if (action === 'menu-import-data') {
          // Trigger import flow
        } else if (action === 'menu-export-data') {
          // Trigger export flow
        }
      });

      window.electronAPI.onLanguageChange((language: string) => {
        console.log('Language change:', language);
        // Handle language change
      });

      return () => {
        window.electronAPI?.removeListeners();
      };
    }
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  // Protected Route Wrapper
  const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return user ? <>{children}</> : <Navigate to="/login" replace />;
  };

  // Onboarding Route Wrapper
  const OnboardingRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Check if user needs onboarding (new user or incomplete profile)
    const needsOnboarding = !user || !user.name || !user.cuisine_preferences || user.cuisine_preferences.length === 0;
    return needsOnboarding ? <>{children}</> : <Navigate to="/dashboard" replace />;
  };

  return (
    <div className="app" data-electron={isElectron}>
      <Router>
        <div className="app-container">
          {user && (
            <Navigation />
          )}
          <main className="main-content">
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Onboarding route - only for new users */}
              <Route
                path="/onboarding"
                element={
                  <OnboardingRoute>
                    <OnboardingPage />
                  </OnboardingRoute>
                }
              />

              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/meal-plan"
                element={
                  <ProtectedRoute>
                    <MealPlanPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/recipes"
                element={
                  <ProtectedRoute>
                    <RecipePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/recipe/:id"
                element={
                  <ProtectedRoute>
                    <RecipePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/shopping-list"
                element={
                  <ProtectedRoute>
                    <ShoppingListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route
                path="/"
                element={
                  user ? (
                    user.cuisine_preferences && user.cuisine_preferences.length > 0 ? (
                      <Navigate to="/dashboard" replace />
                    ) : (
                      <Navigate to="/onboarding" replace />
                    )
                  ) : (
                    <Navigate to="/login" replace />
                  )
                }
              />

              {/* Catch-all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </div>
  );
};

// Main App wrapper with providers
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ApiProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ApiProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
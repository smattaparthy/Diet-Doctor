import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Home,
  Utensils,
  BookOpen,
  ShoppingCart,
  Settings,
  User,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Globe
} from 'lucide-react';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigationItems = [
    {
      path: '/dashboard',
      icon: Home,
      label: t('nav.dashboard'),
    },
    {
      path: '/meal-plan',
      icon: Utensils,
      label: t('nav.mealPlan'),
    },
    {
      path: '/recipes',
      icon: BookOpen,
      label: t('nav.recipes'),
    },
    {
      path: '/shopping-list',
      icon: ShoppingCart,
      label: t('nav.shoppingList'),
    },
    {
      path: '/settings',
      icon: Settings,
      label: t('nav.settings'),
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLanguageChange = (newLanguage: 'en' | 'hi' | 'es') => {
    setLanguage(newLanguage);
  };

  const navClass = `
    sidebar
    ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}
  `;

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={navClass}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <div className="sidebar-logo">
              <span className="logo-icon">🌿</span>
              <span className="logo-text">Cultural Diet</span>
            </div>
            <button
              className="sidebar-close-btn"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X size={20} />
            </button>
          </div>

          {user && (
            <div className="user-profile">
              <div className="user-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name">{user.name}</div>
                <div className={`user-dosha dosha-${user.dosha || 'tridosha'}`}>
                  {user.dosha ? t(`dosha.${user.dosha}`) : 'Not set'}
                </div>
              </div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {navigationItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `
                    nav-link
                    ${isActive ? 'nav-link-active' : ''}
                  `}
                  onClick={() => setIsSidebarOpen(false)}
                >
                  <item.icon size={20} />
                  <span className="nav-link-text">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-controls">
            {/* Theme Toggle */}
            <button
              className="control-btn"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Language Selector */}
            <div className="language-selector">
              <button className="control-btn" title="Change language">
                <Globe size={20} />
              </button>
              <div className="language-dropdown">
                <button
                  onClick={() => handleLanguageChange('en')}
                  className={language === 'en' ? 'active' : ''}
                >
                  English
                </button>
                <button
                  onClick={() => handleLanguageChange('hi')}
                  className={language === 'hi' ? 'active' : ''}
                >
                  हिंदी
                </button>
                <button
                  onClick={() => handleLanguageChange('es')}
                  className={language === 'es' ? 'active' : ''}
                >
                  Español
                </button>
              </div>
            </div>
          </div>

          {/* Profile and Logout */}
          <div className="sidebar-actions">
            <NavLink
              to="/profile"
              className="action-link"
              onClick={() => setIsSidebarOpen(false)}
            >
              <User size={20} />
              <span>Profile</span>
            </NavLink>
            <button
              className="action-link action-link-danger"
              onClick={handleLogout}
            >
              <LogOut size={20} />
              <span>{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setIsSidebarOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>
    </>
  );
};

export default Navigation;
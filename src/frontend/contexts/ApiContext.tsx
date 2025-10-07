import React, { createContext, useContext, useEffect } from 'react';
import * as api from '../services/api';

interface ApiContextType {
  isOnline: boolean;
  lastSync: Date | null;
  clearCache: () => Promise<void>;
  syncData: () => Promise<void>;
}

const ApiContext = createContext<ApiContextType | undefined>(undefined);

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [lastSync, setLastSync] = React.useState<Date | null>(() => {
    const saved = localStorage.getItem('lastSync');
    return saved ? new Date(saved) : null;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const clearCache = async () => {
    try {
      // Clear all cached data
      await api.clearCache();
      localStorage.removeItem('lastSync');
      setLastSync(null);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const syncData = async () => {
    if (!isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      // Sync critical data
      await Promise.all([
        api.getProfile(), // Sync user profile
      ]);

      const now = new Date();
      localStorage.setItem('lastSync', now.toISOString());
      setLastSync(now);
    } catch (error) {
      console.error('Error syncing data:', error);
      throw error;
    }
  };

  const value: ApiContextType = {
    isOnline,
    lastSync,
    clearCache,
    syncData,
  };

  return (
    <ApiContext.Provider value={value}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
};
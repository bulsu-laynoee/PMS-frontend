import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AlertContext = createContext(null);

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);

  const showAlert = useCallback((message, type = 'success', ttl = 4000) => {
    const id = Date.now() + Math.random();
    setAlerts((s) => [...s, { id, message, type }]);
    if (ttl > 0) {
      setTimeout(() => {
        setAlerts((s) => s.filter((a) => a.id !== id));
      }, ttl);
    }
    return id;
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((s) => s.filter((a) => a.id !== id));
  }, []);

  // Expose window.alert override so old code using alert() still shows our UI
  useEffect(() => {
    const original = window.alert;
    const detectType = (msg) => {
      if (!msg) return 'success';
      const s = String(msg).toLowerCase();

      // Force error for known reservation / already parked warnings from backend
      if (/already\s+parked|has\s+a\s+reservation|already\s+parked\s+or\s+has\s+a\s+reservation/i.test(s)) return 'error';

      // error indicators
      if (/(\bfail|failed\b|\berror\b|\binvalid\b|\bcannot\b|can't|\bunable\b|\bdenied\b|\bforbidden\b|unauthor)/i.test(s)) return 'error';
      // success indicators
      if (/(\bsuccess|saved|created|uploaded|assigned|updated|deleted|sent|done|successfully)\b/i.test(s)) return 'success';
      // default to success for neutral messages
      return 'success';
    };

    window.alert = (msg) => {
      const type = detectType(msg);
      showAlert(String(msg), type, 5000);
    };
    // provide a typed global helper for existing code to call showAlert with type; type optional
    window.showAlert = (msg, type = null, ttl = 4000) => {
      const finalType = type || detectType(msg);
      return showAlert(String(msg), finalType, ttl);
    };
    return () => {
      window.alert = original;
    };
  }, [showAlert]);

  return (
    <AlertContext.Provider value={{ alerts, showAlert, removeAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
};

export default AlertContext;

/**
 * AuthContext.jsx — Google Sheets Auth
 * =====================================
 * Reemplaza la autenticación de Base44 con auth simple via
 * Google Sheets (tabla Users gestionada por el Apps Script).
 *
 * Token almacenado en localStorage bajo 'nexus_token'.
 * Usuario almacenado en localStorage bajo 'nexus_user'.
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { googleSheets } from '@/api/googleSheetsClient';
import { isApiConfigured } from '@/lib/app-config';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState({ id: 'nexus-cmms', public_settings: {} });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);

      // Verificar si la API está configurada
      if (!isApiConfigured()) {
        // Mostrar error de configuración
        setAuthError({
          type: 'not_configured',
          message: 'VITE_SHEETS_API_URL no configurado. Crea un archivo .env.local con la URL de tu Apps Script.'
        });
        setIsLoadingAuth(false);
        setAuthChecked(true);
        return;
      }

      // Verificar token en localStorage
      const token = localStorage.getItem('nexus_token');
      const userStr = localStorage.getItem('nexus_user');

      if (token && userStr) {
        try {
          const savedUser = JSON.parse(userStr);
          
          // Verificar que el token siga válido
          const result = await googleSheets.auth.me();
          
          if (result.success && result.user) {
            setUser(savedUser);
            setIsAuthenticated(true);
          } else {
            // Token expirado
            localStorage.removeItem('nexus_token');
            localStorage.removeItem('nexus_user');
            setAuthError({ type: 'auth_required', message: 'Sesión expirada' });
          }
        } catch (err) {
          // Error al verificar — limpiar y pedir login
          localStorage.removeItem('nexus_token');
          localStorage.removeItem('nexus_user');
          setAuthError({ type: 'auth_required', message: 'Inicia sesión para continuar' });
        }
      } else {
        // No hay token — requiere login
        setAuthError({ type: 'auth_required', message: 'Inicia sesión para continuar' });
      }
    } catch (error) {
      console.error('Error en checkAppState:', error);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Error de conexión'
      });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const checkUserAuth = async () => {
    return checkAppState();
  };

  /**
   * Login con usuario y contraseña
   */
  const login = async (username, password) => {
    const result = await googleSheets.auth.login(username, password);
    
    if (result.success) {
      localStorage.setItem('nexus_token', result.token);
      localStorage.setItem('nexus_user', JSON.stringify(result.user));
      setUser(result.user);
      setIsAuthenticated(true);
      setAuthError(null);
      return { success: true };
    } else {
      return { success: false, error: result.error || 'Credenciales incorrectas' };
    }
  };

  const logout = (shouldRedirect = true) => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    setUser(null);
    setIsAuthenticated(false);
    
    if (shouldRedirect) {
      window.location.href = '/welcome';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/welcome';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      login,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
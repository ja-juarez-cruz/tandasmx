// src/hooks/useAndroidBackButton.js
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';

export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      const currentPath = location.pathname;
      
      // Definir rutas principales y sus comportamientos
      const routeConfig = {
        // Rutas que van al dashboard al presionar atrás
        '/participantes': '/dashboard',
        '/pagos': '/dashboard',
        '/configuracion': '/dashboard',
        
        // Dashboard va a inicio
        '/dashboard': '/inicio',
        
        // Crear tanda va a inicio
        '/crear-tanda': '/inicio',
        
        // Configuración de app va a inicio
        '/configuracion-app': '/inicio',
        
        // Inicio y login salen de la app
        '/inicio': 'EXIT',
        '/login': 'EXIT',
      };

      const action = routeConfig[currentPath];

      if (action === 'EXIT') {
        // Salir de la aplicación
        CapacitorApp.exitApp();
      } else if (action) {
        // Navegar a la ruta definida
        navigate(action);
      } else if (canGoBack) {
        // Si hay historial y no hay regla específica, retroceder
        navigate(-1);
      } else {
        // Por defecto, ir al dashboard
        navigate('/dashboard');
      }
    });

    return () => {
      handler.remove();
    };
  }, [navigate, location]);
}
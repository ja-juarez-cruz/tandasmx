import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

// Importar componentes
import DashboardView from './components/DashboardView';
import CrearTandaView from './components/CrearTandaView';
import ParticipantesView from './components/ParticipantesView';
import PagosView from './components/PagosView';
import ConfiguracionView from './components/ConfiguracionView';
import InicioView from './components/InicioView';
import RegistroPublicoView from './components/RegistroPublicoView';
import GlobalHeader from './components/GlobalHeader';
import ConfiguracionAppView from './components/ConfiguracionAppView';
import LoginView from './components/Loginview';
import PublicBoard from './components/PublicBoard';
import RegistroCumpleView from './components/RegistroCumpleanosView';
import DeleteAccountView from './components/DeleteAccountView';
import BottomNavigation from './components/BottomNavigation';

// Hooks personalizados
import { useAndroidBackButton } from './hooks/useAndroidBackButton';

// ===========================================
// CONFIGURACIÓN DE LA API
// ===========================================
import { API_BASE_URL } from './utils/apiFetch';

// ===========================================
// TOKEN MANAGER - Gestión centralizada de tokens
// ===========================================
let refreshPromise = null; // Lock para evitar refreshes simultáneos

const tokenManager = {
  getAccessToken: () => localStorage.getItem('authToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),

  saveTokens: ({ token, refreshToken, userId, email, userName }) => {
    if (token) localStorage.setItem('authToken', token);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (userId) localStorage.setItem('userId', userId);
    if (email) localStorage.setItem('userEmail', email);
    if (userName) localStorage.setItem('userName', userName);
  },

  clearTokens: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
  },

  // Solicita un nuevo access_token usando el refresh_token
  refreshAccessToken: async () => {
    // Si ya hay un refresh en curso, reutilizar esa misma promesa
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const refreshToken = tokenManager.getRefreshToken();
      console.log('🔑 refreshToken obtenido:', refreshToken);
      if (!refreshToken) return null;

      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const newToken = data.data?.token || data.token;
        const newRefreshToken = data.data?.refreshToken || data.refreshToken;

        if (newToken) {
          localStorage.setItem('authToken', newToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }
          return newToken;
        }
        return null;
      } catch (error) {
        console.error('Error al renovar token:', error);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }
};

// ===========================================
// API CON REFRESH AUTOMÁTICO
// ===========================================
const api = {
  getToken: () => tokenManager.getAccessToken(),
  
  getHeaders: () => {
    const token = tokenManager.getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    };
  },

  /**
   * handleResponse con refresh silencioso:
   * 1. Si recibe 401 → intenta renovar el token
   * 2. Si el refresh funciona → reintenta la petición original
   * 3. Solo si el refresh falla → dispara 'token-expired'
   */
  handleResponse: async (response, originalRequest) => {
    // Si recibe 401, intentar refresh ANTES de fallar
    if (response.status === 401) {
      const newToken = await tokenManager.refreshAccessToken();

      if (newToken && originalRequest) {
        // Reintentar la petición original con el nuevo token
        const retryHeaders = {
          ...originalRequest.headers,
          'Authorization': `Bearer ${newToken}`
        };
        const retryResponse = await fetch(originalRequest.url, {
          ...originalRequest.options,
          headers: retryHeaders
        });

        const retryData = await retryResponse.json();

        if (retryResponse.ok) {
          return retryData;
        }

        // Si el retry también falla con 401, el refresh token ya no sirve
        if (retryResponse.status === 401) {
          tokenManager.clearTokens();
          window.dispatchEvent(new CustomEvent('token-expired'));
          throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
        }

        throw new Error(retryData.error?.message || `Error ${retryResponse.status}`);
      }

      // No hay refresh token o el refresh falló
      tokenManager.clearTokens();
      window.dispatchEvent(new CustomEvent('token-expired'));
      throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
    }

    const data = await response.json();

    if (response.status === 403) {
      tokenManager.clearTokens();
      window.dispatchEvent(new CustomEvent('token-expired'));
      throw new Error('Sesión expirada. Por favor inicia sesión nuevamente.');
    }

    if (!response.ok) {
      console.error('❌ Error en API:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        errorData: data
      });
      const errorMessage = data.error?.message || data.message || `Error ${response.status}`;
      throw new Error(errorMessage);
    }

    return data;
  },

  auth: {
    login: async (email, password) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error en la operación');
      }

      if (data.success) {
        const token = data.data?.token || data.token;
        const refreshToken = data.data?.refreshToken || data.refreshToken;
        const userId = data.data?.id || data.data?.userId;
        const userName = data.data?.nombre;
        const userEmail = data.data?.email || email;

        tokenManager.saveTokens({ token, refreshToken, userId, email: userEmail, userName });
      }

      return data;
    },

    register: async (email, password, nombre, telefono) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nombre, telefono })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error en la operación');
      }

      if (data.success) {
        const token = data.data?.token || data.token;
        const refreshToken = data.data?.refreshToken || data.refreshToken;
        const userId = data.data?.id || data.data?.userId;
        const userName = data.data?.nombre;
        const userEmail = data.data?.email || email;

        tokenManager.saveTokens({ token, refreshToken, userId, email: userEmail, userName });
      }

      return data;
    },

    logout: () => {
      tokenManager.clearTokens();
    }
  },

  tandas: {
    obtener: async (tandaId) => {
      const url = `${API_BASE_URL}/tandas/${tandaId}`;
      const headers = { 'Content-Type': 'application/json' };
      const response = await fetch(url, { method: 'GET', headers });
      return await api.handleResponse(response, { url, headers, options: { method: 'GET' } });
    },

    listar: async () => {
      const url = `${API_BASE_URL}/tandas`;
      const headers = api.getHeaders();
      const response = await fetch(url, { method: 'GET', headers });
      return await api.handleResponse(response, { url, headers, options: { method: 'GET' } });
    }
  },

  estadisticas: {
    obtener: async (tandaId) => {
      const url = `${API_BASE_URL}/tandas/${tandaId}/estadisticas`;
      const headers = api.getHeaders();
      const response = await fetch(url, { method: 'GET', headers });
      return await api.handleResponse(response, { url, headers, options: { method: 'GET' } });
    }
  }
};

// ===========================================
// COMPONENTE WRAPPER PARA ADMIN
// ===========================================
function AdminLayout({ children, userData, onLogout, onOpenSettings, showBottomNav = false, currentTandaName, onGoHome, todasLasTandas, onSeleccionarTanda, currentTandaId }) {
  return (
    <>
      <GlobalHeader 
        userName={userData.nombre}
        userEmail={userData.email}
        onLogout={onLogout}
        onOpenSettings={onOpenSettings}
        currentTandaName={currentTandaName}
        showHomeButton={!!currentTandaName}
        onGoHome={onGoHome}
        todasLasTandas={todasLasTandas}
        onSeleccionarTanda={onSeleccionarTanda}
        currentTandaId={currentTandaId}
      />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50">
        {children}
      </div>
      {showBottomNav && <BottomNavigation />}
    </>
  );
}

// ===========================================
// COMPONENTE PRINCIPAL
// ===========================================
function TandaManager() {
  // ========== ESTADOS PRINCIPALES ==========
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [tandaData, setTandaData] = useState(null);
  const [todasLasTandas, setTodasLasTandas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [estadisticas, setEstadisticas] = useState(null);

  // Estados de usuario
  const [userData, setUserData] = useState({
    nombre: '',
    email: '',
    telefono: ''
  });

  // Estados para manejo de sesión
  const [showSessionModal, setShowSessionModal] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // ========== HOOK PARA BOTÓN FÍSICO DE ANDROID ==========
  useAndroidBackButton();

  // ========== VERIFICAR SI ES RUTA PÚBLICA ==========
  const isPublicRoute = useCallback(() => {
    const publicPaths = [
      '/registro/',
      '/registro-cumple/',
      '/public-board/',
      '/delete-account'
    ];

    const currentPath = location.pathname;
    const isPublic = publicPaths.some(path => currentPath.startsWith(path));
    
    console.log('🔍 Verificando ruta:', {
      currentPath,
      isPublic,
      publicPaths
    });

    return isPublic;
  }, [location.pathname]);

  // ========== INICIALIZACIÓN ==========
  useEffect(() => {
    if (isPublicRoute()) {
      console.log('🌐 Ruta pública detectada, saltando inicialización de sesión');
      return;
    }

    const initializeApp = async () => {
      const token = tokenManager.getAccessToken();
      const savedUserName = localStorage.getItem('userName');
      const savedUserEmail = localStorage.getItem('userEmail');

      if (token && savedUserName && savedUserEmail) {
        console.log('✅ Sesión encontrada, inicializando admin');
        setIsAdmin(true);
        setUserData({
          nombre: savedUserName,
          email: savedUserEmail,
          telefono: ''
        });
        await loadAdminData();
        
        if (location.pathname === '/') {
          navigate('/inicio', { replace: true });
        }
      } else {
        console.log('❌ No hay sesión, redirigiendo a login si es necesario');
        if (location.pathname !== '/login' && location.pathname !== '/') {
          navigate('/login', { replace: true });
        }
      }
    };

    initializeApp();
  }, [location.pathname, isPublicRoute, navigate]);

  // ========== DETECCIÓN DE TOKEN EXPIRADO ==========
  // Ahora solo se dispara si el refresh token también falló
  useEffect(() => {
    const handleTokenExpired = () => {
      console.log('🔒 Sesión completamente expirada (refresh token inválido)');
      handleSessionExpiredLogout();
    };

    window.addEventListener('token-expired', handleTokenExpired);
    return () => window.removeEventListener('token-expired', handleTokenExpired);
  }, [isAdmin]);

  // ========== DETECCIÓN DE ACTIVIDAD ==========
  useEffect(() => {
    if (!isAdmin) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));
    
    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [isAdmin]);

  // ========== FUNCIONES DE CARGA DE DATOS ==========
  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.tandas.listar();
      
      if (result.success) {
        const tandas = result.data?.tandas || [];
        setTodasLasTandas(tandas);
        
        if (tandaData?.tandaId) {
          const tandaDetail = await api.tandas.obtener(tandaData.tandaId);
          if (tandaDetail.success) {
            setTandaData(tandaDetail.data);
            await loadEstadisticas(tandaDetail.data.tandaId);
          }
        }
      } else {
        setTodasLasTandas([]);
      }
    } catch (error) {
      console.error('❌ Error cargando datos del admin:', error);
      setError(`Error al cargar datos: ${error.message}`);
      setTodasLasTandas([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEstadisticas = async (tandaId) => {
    if (!tandaId) return;
    
    try {
      const result = await api.estadisticas.obtener(tandaId);
      if (result.success) {
        setEstadisticas(result.data.estadisticas);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      setEstadisticas(null);
    }
  };

  const seleccionarTanda = async (tandaId) => {
    setLoading(true);
    try {
      const tandaDetail = await api.tandas.obtener(tandaId);
      if (tandaDetail.success) {
        setTandaData(tandaDetail.data);
        await loadEstadisticas(tandaId);
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error cargando tanda:', error);
      setError('Error al cargar tanda');
    } finally {
      setLoading(false);
    }
  };

  // ========== FUNCIONES DE AUTENTICACIÓN ==========
  const handleLogout = () => {
    api.auth.logout();
    setIsAdmin(false);
    setTandaData(null);
    setTodasLasTandas([]);
    setUserData({ nombre: '', email: '', telefono: '' });
    navigate('/login');
  };

  const handleLoginSuccess = useCallback(async (loginData) => {
    const token = tokenManager.getAccessToken();
    
    if (!token) {
      console.error('❌ Token no encontrado después de login');
      setError('Error: No se pudo establecer la sesión');
      return;
    }
    
    setIsAdmin(true);
    setUserData({
      nombre: loginData.nombre || '',
      email: loginData.email || '',
      telefono: ''
    });
    
    await loadAdminData();
    navigate('/inicio');
  }, [navigate]);

  const handleSessionExpiredLogout = () => {
    api.auth.logout();
    setIsAdmin(false);
    setShowSessionModal(false);
    setTandaData(null);
    setTodasLasTandas([]);
    setError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
    navigate('/login');
  };

  const handleTandaCreada = useCallback((nuevaTanda) => {
    console.log('✅ Tanda creada exitosamente:', nuevaTanda);
    setTandaData(nuevaTanda);
    navigate('/participantes');
    loadAdminData();
  }, [navigate]);

  const handleGoHome = useCallback(() => {
    setTandaData(null);
    setEstadisticas(null);
    navigate('/inicio');
  }, [navigate]);

  // ===========================================
  // COMPONENTES DE RUTAS
  // ===========================================
  const PrivateRoute = ({ children }) => {
    if (isPublicRoute()) {
      console.log('✅ PrivateRoute: Ruta pública, permitiendo acceso');
      return children;
    }
    
    if (!isAdmin) {
      console.log('❌ PrivateRoute: No autenticado, redirigiendo a login');
      return <Navigate to="/login" replace />;
    }
    
    console.log('✅ PrivateRoute: Autenticado, permitiendo acceso');
    return children;
  };

  const PublicRoute = ({ children }) => {
    if (isAdmin && location.pathname === '/login') {
      console.log('🔄 PublicRoute: Ya autenticado, redirigiendo a inicio');
      return <Navigate to="/inicio" replace />;
    }
    return children;
  };

  // ===========================================
  // RENDER
  // ===========================================
  return (
    <>
      <Routes>
        {/* ========== RUTAS COMPLETAMENTE PÚBLICAS ========== */}
        <Route path="/registro/:token" element={<RegistroPublicoView />} />
        <Route path="/registro-cumple/:token" element={<RegistroCumpleView />} />
        <Route path="/public-board/:tandaId" element={<PublicBoard />} />
        <Route path="/delete-account" element={<DeleteAccountView />} />

        {/* ========== RUTA DE LOGIN ========== */}
        <Route path="/login" element={
          <PublicRoute>
            <LoginView onLoginSuccess={handleLoginSuccess} />
          </PublicRoute>
        } />

        {/* ========== RUTAS PRIVADAS ========== */}
        
        {/* Inicio - Sin Bottom Nav */}
        <Route path="/inicio" element={
          <PrivateRoute>
            <AdminLayout 
              userData={userData} 
              onLogout={handleLogout} 
              onOpenSettings={() => navigate('/configuracion-app')}
              showBottomNav={false}
            >
              <div className="max-w-7xl mx-auto p-4 md:p-8 pt-8">
                <InicioView 
                  tandas={todasLasTandas}
                  onSeleccionarTanda={seleccionarTanda}
                  onCrearNueva={() => navigate('/crear-tanda')}
                  loading={loading}
                />
              </div>
            </AdminLayout>
          </PrivateRoute>
        } />

        {/* Crear Tanda - Sin Bottom Nav */}
        <Route path="/crear-tanda" element={
          <PrivateRoute>
            <AdminLayout 
              userData={userData} 
              onLogout={handleLogout} 
              onOpenSettings={() => navigate('/configuracion-app')}
              showBottomNav={false}
            >
              <div className="max-w-7xl mx-auto p-4 md:p-8 pt-8">
                <CrearTandaView
                  setTandaData={handleTandaCreada}
                  setLoading={setLoading}
                  setError={setError}
                  loadAdminData={loadAdminData}
                />
              </div>
            </AdminLayout>
          </PrivateRoute>
        } />

        {/* Dashboard - CON Bottom Nav */}
        <Route path="/dashboard" element={
          <PrivateRoute>
            <AdminLayout 
              userData={userData} 
              onLogout={handleLogout} 
              onOpenSettings={() => navigate('/configuracion-app')}
              showBottomNav={true}
              currentTandaName={tandaData?.nombre}
              onGoHome={handleGoHome}
              todasLasTandas={todasLasTandas}
              onSeleccionarTanda={seleccionarTanda}
              currentTandaId={tandaData?.tandaId}
            >
              <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24">
                <DashboardView 
                  tandaData={tandaData} 
                  estadisticas={estadisticas}
                  onCrearTanda={() => navigate('/crear-tanda')}
                />
              </div>
            </AdminLayout>
          </PrivateRoute>
        } />

        {/* Participantes - CON Bottom Nav */}
        <Route path="/participantes" element={
          <PrivateRoute>
            <AdminLayout 
              userData={userData} 
              onLogout={handleLogout} 
              onOpenSettings={() => navigate('/configuracion-app')}
              showBottomNav={true}
              currentTandaName={tandaData?.nombre}
              onGoHome={handleGoHome}
              todasLasTandas={todasLasTandas}
              onSeleccionarTanda={seleccionarTanda}
              currentTandaId={tandaData?.tandaId}
            >
              <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24">
                <ParticipantesView 
                  tandaData={tandaData} 
                  setTandaData={setTandaData} 
                  loadAdminData={loadAdminData}
                />
              </div>
            </AdminLayout>
          </PrivateRoute>
        } />

        {/* Pagos - CON Bottom Nav */}
        <Route path="/pagos" element={
          <PrivateRoute>
            <AdminLayout 
              userData={userData} 
              onLogout={handleLogout} 
              onOpenSettings={() => navigate('/configuracion-app')}
              showBottomNav={true}
              currentTandaName={tandaData?.nombre}
              onGoHome={handleGoHome}
              todasLasTandas={todasLasTandas}
              onSeleccionarTanda={seleccionarTanda}
              currentTandaId={tandaData?.tandaId}
            >
              <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24">
                <PagosView 
                  tandaData={tandaData} 
                  setTandaData={setTandaData} 
                  loadAdminData={loadAdminData}
                />
              </div>
            </AdminLayout>
          </PrivateRoute>
        } />

        {/* Configuración - CON Bottom Nav */}
        <Route path="/configuracion" element={
          <PrivateRoute>
            <AdminLayout 
              userData={userData} 
              onLogout={handleLogout} 
              onOpenSettings={() => navigate('/configuracion-app')}
              showBottomNav={true}
              currentTandaName={tandaData?.nombre}
              onGoHome={handleGoHome}
              todasLasTandas={todasLasTandas}
              onSeleccionarTanda={seleccionarTanda}
              currentTandaId={tandaData?.tandaId}
            >
              <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24">
                <ConfiguracionView 
                  tandaData={tandaData} 
                  setTandaData={setTandaData} 
                  loadAdminData={loadAdminData}
                />
              </div>
            </AdminLayout>
          </PrivateRoute>
        } />

        {/* Configuración App - Sin Bottom Nav */}
        <Route path="/configuracion-app" element={
          <PrivateRoute>
            <AdminLayout 
              userData={userData} 
              onLogout={handleLogout} 
              onOpenSettings={() => navigate('/configuracion-app')}
              showBottomNav={false}
            >
              <div className="pb-20">
                <ConfiguracionAppView
                  userData={userData}
                  onAccountDeleted={handleLogout}
                />
              </div>
            </AdminLayout>
          </PrivateRoute>
        } />

        {/* ========== REDIRECCIONES ========== */}
        <Route path="/" element={<Navigate to={isAdmin ? "/inicio" : "/login"} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* ========== MODAL DE SESIÓN EXPIRADA ========== */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-yellow-100 rounded-full mb-4">
                <AlertCircle className="w-12 h-12 text-yellow-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Sesión Expirada</h3>
              <p className="text-gray-600">
                Tu sesión ha expirado. Por favor inicia sesión nuevamente.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleSessionExpiredLogout}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Ir a Iniciar Sesión
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              Tu refresh token ha expirado después de 30 días de inactividad.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ===========================================
// WRAPPER CON ROUTER
// ===========================================
export default function App() {
  return (
    <Router>
      <TandaManager />
    </Router>
  );
}

// ===========================================
// ESTILOS CSS GLOBALES
// ===========================================
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out;
    }

    .safe-bottom {
      padding-bottom: max(env(safe-area-inset-bottom), 16px);
    }

    .pb-safe {
      padding-bottom: env(safe-area-inset-bottom);
    }

    body {
      padding-bottom: env(safe-area-inset-bottom);
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      overflow-x: hidden;
    }
  `;
  if (!document.querySelector('style[data-app-styles]')) {
    style.setAttribute('data-app-styles', 'true');
    document.head.appendChild(style);
  }
}
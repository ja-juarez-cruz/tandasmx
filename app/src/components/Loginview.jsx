import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Shield, CheckCircle } from 'lucide-react';

// Importa tus assets (ajusta las rutas según tu estructura)
import logoTanda from '../public/assets/logos/logo-tanda-512.png';
import logoTandaSvg from '../public/assets/logos/logo-tanda.svg';
import logoWhite from '../public/assets/logos/logo-white.svg';
import patternBg from '../public/assets/patterns/pattern-bg.svg';

const API_BASE_URL = 'https://9l2vrevqm1.execute-api.us-east-1.amazonaws.com/dev';

const api = {
  getHeaders: () => ({
    'Content-Type': 'application/json',
  }),
  
  handleResponse: async (response) => {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Error en la operación');
    }
    return data;
  },
  
  auth: {
    login: async (email, password) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ email, password })
      });
      const data = await api.handleResponse(response);
      
      const token = data.data?.token || data.token;
      const userId = data.data?.id || data.userId;
      const userName = data.data?.nombre || data.nombre;
      
      if (token) {
        localStorage.setItem('authToken', token);
        localStorage.setItem('userId', userId);
        localStorage.setItem('userEmail', email);
        localStorage.setItem('userName', userName);
      }
      
      return { ...data, token, userId, nombre: userName };
    },
    
    register: async (email, password, nombre, telefono) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ email, password, nombre, telefono })
      });
      return await api.handleResponse(response);
    }
  }
};

export default function LoginView({ onLoginSuccess }) {
  const [currentView, setCurrentView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyContent, setPrivacyContent] = useState('');
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState(null);

  const loadPrivacyPolicy = async () => {
    setLoadingPrivacy(true);
    setPrivacyError(null);
    
    try {
      const response = await fetch('https://app-tanda-mx-legal.s3.us-east-1.amazonaws.com/politica_privacidad.html');
      if (!response.ok) throw new Error('No se pudo cargar el aviso de privacidad');
      const htmlContent = await response.text();
      setPrivacyContent(htmlContent);
    } catch (error) {
      setPrivacyError('No se pudo cargar el aviso de privacidad. Por favor, intenta más tarde.');
    } finally {
      setLoadingPrivacy(false);
    }
  };

  const handleFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (currentView === 'login') {
        const result = await api.auth.login(email, password);
        if (result.success && result.token) {
          onLoginSuccess({ nombre: result.nombre || nombre, email });
        } else {
          throw new Error('No se pudo iniciar sesión. Verifica tus credenciales.');
        }
      } else {
        if (!acceptedPrivacy) {
          setError('Debes aceptar el Aviso de Privacidad para continuar');
          setLoading(false);
          return;
        }
        
        const registerResult = await api.auth.register(email, password, nombre, telefono);
        if (registerResult.success) {
          const loginResult = await api.auth.login(email, password);
          if (loginResult.success && loginResult.token) {
            onLoginSuccess({ nombre: loginResult.nombre || nombre, email });
          }
        }
      }
    } catch (error) {
      setError(error.message || 'Error en la operación');
    } finally {
      setLoading(false);
    }
  }, [currentView, email, password, nombre, telefono, acceptedPrivacy, onLoginSuccess]);

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 flex items-center justify-center p-4 pb-24"
      style={{
        backgroundImage: `url(${patternBg})`,
        backgroundSize: '200px 200px',
        backgroundRepeat: 'repeat',
        backgroundBlendMode: 'overlay'
      }}
    >
      <div className="w-full max-w-md">
        {/* Header con Logo */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <img 
              src={logoTanda}
              alt="Tanda App - Sistema de Tandas" 
              className="w-24 h-24 object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                e.target.src = logoTandaSvg;
              }}
            />
          </div>
          
          <h1 className="text-4xl font-black text-gray-900 mb-2">Tanda App</h1>
          <p className="text-gray-600 font-medium">Gestiona tu tanda con confianza y seguridad</p>
        </div>

        {/* Card Principal */}
        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          {/* Toggle Login/Registro */}
          <div className="mb-6">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => setCurrentView('login')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                  currentView === 'login'
                    ? 'bg-white shadow-md text-blue-700'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('register')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all ${
                  currentView === 'register'
                    ? 'bg-white shadow-md text-blue-700'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Registrarse
              </button>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleFormSubmit}>
            {currentView === 'register' && (
              <>
                <div className="mb-4">
                  <label htmlFor="nombre-input" className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre Completo
                  </label>
                  <input
                    id="nombre-input"
                    name="nombre"
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="name"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none transition-colors"
                    placeholder="Tu nombre"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="telefono-input" className="block text-sm font-semibold text-gray-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    id="telefono-input"
                    name="telefono"
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    autoComplete="tel"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none transition-colors"
                    placeholder="5512345678"
                    pattern="[0-9]{10}"
                    title="Ingresa un teléfono válido de 10 dígitos"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    10 dígitos sin espacios ni guiones
                  </p>
                </div>
              </>
            )}

            <div className="mb-4">
              <label htmlFor="email-input" className="block text-sm font-semibold text-gray-700 mb-2">
                Correo Electrónico
              </label>
              <input
                id="email-input"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none transition-colors"
                placeholder="tu@email.com"
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="password-input" className="block text-sm font-semibold text-gray-700 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={currentView === 'login' ? 'current-password' : 'new-password'}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-600 focus:outline-none transition-colors pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            {currentView === 'register' && (
              <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="privacy-checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    className="mt-1 w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="privacy-checkbox" className="text-sm text-gray-700 cursor-pointer select-none">
                    He leído y acepto el{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setShowPrivacyModal(true);
                        if (!privacyContent) loadPrivacyPolicy();
                      }}
                      className="text-blue-600 font-semibold hover:text-blue-800 underline"
                    >
                      Aviso de Privacidad
                    </button>
                    {' '}y los términos de uso de Tanda App
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (currentView === 'register' && !acceptedPrivacy)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold py-3.5 px-6 rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {loading ? 'Cargando...' : currentView === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </button>
          </form>
        </div>

        {/* Card de Características - Ajustado para móviles */}
        <div className="mt-8 mb-4 bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Sistema Profesional de Tandas
          </h3>
          <ul className="space-y-2 text-sm pb-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Gestión de participantes</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Control inteligente de pagos</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Tablero público y compartible</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Mensajes/Recordatorios vía WhatsApp</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Organización y transparencia</span>
            </li>
          </ul>
        </div>

        {/* Modal de Política de Privacidad */}
        {showPrivacyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-fadeIn">
              {/* Header del Modal */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={logoWhite} 
                      alt="Tanda App" 
                      className="w-10 h-10 object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling.style.display = 'block';
                      }}
                    />
                    <Shield className="w-10 h-10 hidden" />
                    <div>
                      <h2 className="text-2xl font-bold">Aviso de Privacidad</h2>
                      <p className="text-sm opacity-90">Tanda App</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPrivacyModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    aria-label="Cerrar"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Contenido del Modal */}
              <div className="p-6 overflow-y-auto flex-1">
                {loadingPrivacy ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mb-4"></div>
                    <p className="text-gray-600">Cargando aviso de privacidad...</p>
                  </div>
                ) : privacyError ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 bg-red-100 rounded-full mb-4">
                      <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-red-600 text-center mb-4">{privacyError}</p>
                    <button
                      onClick={loadPrivacyPolicy}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : privacyContent ? (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: privacyContent }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Shield className="w-12 h-12 text-gray-400 mb-4" />
                    <p className="text-gray-600">No se ha cargado el contenido</p>
                    <button
                      onClick={loadPrivacyPolicy}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Cargar Aviso de Privacidad
                    </button>
                  </div>
                )}
              </div>

              {/* Footer del Modal */}
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-6 py-2.5 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cerrar
                </button>
                {currentView === 'register' && !acceptedPrivacy && (
                  <button
                    onClick={() => {
                      setAcceptedPrivacy(true);
                      setShowPrivacyModal(false);
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all"
                  >
                    Aceptar y Continuar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Estilos CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .prose { color: #374151; max-width: none; }
    .prose h1, .prose h2, .prose h3 { color: #1f2937; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
    .prose h1 { font-size: 1.875rem; line-height: 2.25rem; }
    .prose h2 { font-size: 1.5rem; line-height: 2rem; }
    .prose h3 { font-size: 1.25rem; line-height: 1.75rem; }
    .prose p { margin-bottom: 1em; line-height: 1.625; }
    .prose ul, .prose ol { margin-top: 0.5em; margin-bottom: 1em; padding-left: 1.5em; }
    .prose li { margin-bottom: 0.25em; }
    .prose strong { font-weight: 600; color: #1f2937; }
    .prose a { color: #0066CC; text-decoration: underline; }
    .prose a:hover { color: #004C99; }
    .prose blockquote { border-left: 4px solid #0066CC; padding-left: 1em; font-style: italic; color: #6b7280; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
  `;
  if (!document.querySelector('style[data-privacy-styles]')) {
    style.setAttribute('data-privacy-styles', 'true');
    document.head.appendChild(style);
  }
}
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, ChevronDown, Mail, Home, Shield, HelpCircle, List, Check, Gift } from 'lucide-react';

import logoTanda from '../public/assets/logos/logo-tanda-512.png';
import logoTandaSvg from '../public/assets/logos/logo-tanda.svg';

export default function GlobalHeader({ 
  userName, 
  userEmail, 
  onLogout, 
  onOpenSettings,
  onGoHome,
  showHomeButton,
  currentTandaName,
  todasLasTandas = [],
  onSeleccionarTanda,
  currentTandaId
}) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showTandaSelector, setShowTandaSelector] = useState(false);
  const menuRef = useRef(null);
  const tandaSelectorRef = useRef(null);

  // Cerrar menú usuario al click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
      if (tandaSelectorRef.current && !tandaSelectorRef.current.contains(event.target)) {
        setShowTandaSelector(false);
      }
    };
    if (showMenu || showTandaSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu, showTandaSelector]);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const handleGoToInicio = () => navigate('/inicio');

  const handleSelectTanda = (tandaId) => {
    if (tandaId === currentTandaId) {
      setShowTandaSelector(false);
      return;
    }
    setShowTandaSelector(false);
    if (onSeleccionarTanda) onSeleccionarTanda(tandaId);
  };

  return (
    <>
      <div className="bg-white shadow-lg border-b-2 border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            
            {/* SECCIÓN IZQUIERDA */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              
              {/* BOTÓN HOME */}
              {showHomeButton && onGoHome && (
                <>
                  <button
                    onClick={onGoHome}
                    className="group flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-blue-50 transition-all border border-transparent hover:border-blue-200 flex-shrink-0"
                    title="Volver a Mis Tandas"
                  >
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center group-hover:from-blue-600 group-hover:to-blue-800 transition-all shadow-sm">
                      <Home className="w-5 h-5 text-blue-700 group-hover:text-white transition-colors" />
                    </div>
                    <div className="hidden md:block">
                      <div className="text-xs text-gray-500 font-medium group-hover:text-blue-600 transition-colors">Volver a</div>
                      <div className="text-sm font-bold text-gray-800 group-hover:text-blue-700 transition-colors">Mis Tandas</div>
                    </div>
                  </button>
                  <div className="w-px h-10 bg-gray-300 flex-shrink-0"></div>
                </>
              )}

              {/* LOGO + NOMBRE APP */}
              {!showHomeButton &&(
                <>
                  <button
                    onClick={handleGoToInicio}
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity group flex-shrink-0"
                    title="Ir a Inicio"
                  >
                    <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                      <img 
                        src={logoTanda}
                        alt="Tanda App Logo" 
                        className="w-10 h-10 object-contain drop-shadow-md group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => { e.target.src = logoTandaSvg; }}
                      />
                    </div>
                    <div className="hidden sm:block">
                      <span className="text-lg sm:text-xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                        Tanda App
                      </span>
                      <div className="text-xs text-gray-500 font-medium group-hover:text-blue-500 transition-colors">
                        Sistema Profesional de Tandas
                      </div>
                    </div>
                  </button>
                </>
              )}

              

              {/* SELECTOR DE TANDA ACTIVA */}
              {currentTandaName && (
                <>
                  <div className="w-px h-8 bg-gray-200 flex-shrink-0 hidden sm:block"></div>
                  <div className="relative" ref={tandaSelectorRef}>
                    <button
                      onClick={() => setShowTandaSelector(!showTandaSelector)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl min-w-0 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
                      title="Cambiar de tanda"
                    >
                      <List className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-blue-700 truncate max-w-[120px] sm:max-w-[180px]">
                        {currentTandaName}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-blue-500 flex-shrink-0 transition-transform duration-200 ${showTandaSelector ? 'rotate-180' : ''}`} />
                    </button>

                    {/* DROPDOWN DE TANDAS */}
                    {showTandaSelector && todasLasTandas.length > 0 && (
                      <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border-2 border-gray-100 overflow-hidden animate-fadeIn z-50">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-3 text-white">
                          <div className="text-sm font-bold">Mis Tandas</div>
                          <div className="text-xs opacity-80">{todasLasTandas.length} tanda{todasLasTandas.length !== 1 ? 's' : ''}</div>
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1">
                          {todasLasTandas.map((tanda) => {
                            const isActive = tanda.tandaId === currentTandaId;
                            const esCumpleañera = tanda.frecuencia === 'cumpleaños';
                            const numParticipantes = Array.isArray(tanda.participantes) ? tanda.participantes.length : 0;
                            
                            return (
                              <button
                                key={tanda.tandaId}
                                onClick={() => handleSelectTanda(tanda.tandaId)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all ${
                                  isActive 
                                    ? 'bg-blue-50 border-l-4 border-blue-600' 
                                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                                  esCumpleañera 
                                    ? 'bg-gradient-to-br from-pink-500 to-purple-600' 
                                    : 'bg-gradient-to-br from-blue-600 to-blue-800'
                                } text-white`}>
                                  {esCumpleañera ? <Gift className="w-4 h-4" /> : <List className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-gray-800 truncate flex items-center gap-1.5">
                                    {tanda.nombre}
                                    {isActive && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {numParticipantes} participante{numParticipantes !== 1 ? 's' : ''}
                                    {' · '}
                                    ${tanda.montoPorRonda?.toLocaleString() || 0}
                                    {esCumpleañera ? ' · 🎂' : ` · ${tanda.frecuencia}`}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* SECCIÓN DERECHA: USUARIO Y MENÚ */}
            <div className="relative flex-shrink-0 ml-3" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-200"
                aria-label="Menú de usuario"
              >
                <div className="hidden sm:block text-right mr-2">
                  <div className="text-xs text-gray-500 font-medium">Bienvenido</div>
                  <div className="text-sm font-bold text-gray-800 truncate max-w-[150px]">{userName || 'Usuario'}</div>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
                  <span className="text-white font-bold text-sm">{getInitials(userName)}</span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* MENÚ DESPLEGABLE */}
              {showMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 overflow-hidden animate-fadeIn">
                  <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-2 ring-white/30">
                        <span className="text-white font-bold text-lg">{getInitials(userName)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate">{userName || 'Usuario'}</div>
                        <div className="text-xs opacity-90 truncate">{userEmail || 'usuario@email.com'}</div>
                      </div>
                    </div>
                    {currentTandaName && (
                      <div className="mt-3 px-3 py-2 bg-white/15 backdrop-blur-sm rounded-lg">
                        <div className="text-[10px] opacity-80">Tanda activa</div>
                        <div className="text-sm font-bold truncate">{currentTandaName}</div>
                      </div>
                    )}
                  </div>

                  <div className="py-2">
                    <div className="h-px bg-gray-200 my-2 mx-4"></div>
                    
                    {showHomeButton && onGoHome && (
                      <>
                        <button
                          onClick={() => { setShowMenu(false); onGoHome(); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                            <List className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-800">Mis Tandas</div>
                            <div className="text-xs text-gray-500">Ver todas las tandas</div>
                          </div>
                        </button>
                        <div className="h-px bg-gray-200 my-2 mx-4"></div>
                      </>
                    )}

                    <button
                      onClick={() => { setShowMenu(false); onOpenSettings(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                        <Settings className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-800">Configuración</div>
                        <div className="text-xs text-gray-500">Ajustes de la aplicación</div>
                      </div>
                    </button>

                    <button
                      onClick={() => { setShowMenu(false); setShowContactModal(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-green-50 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                        <HelpCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-800">Ayuda y Soporte</div>
                        <div className="text-xs text-gray-500">Contacta a servicio al cliente</div>
                      </div>
                    </button>

                    <div className="h-px bg-gray-200 my-2 mx-4"></div>

                    <button
                      onClick={() => { setShowMenu(false); onLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                        <LogOut className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-red-700">Cerrar Sesión</div>
                        <div className="text-xs text-red-500">Salir de tu cuenta</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CONTACTO */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-scaleIn">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <HelpCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Ayuda y Soporte</h2>
                    <p className="text-sm opacity-90">Estamos aquí para ayudarte</p>
                  </div>
                </div>
                <button onClick={() => setShowContactModal(false)} className="p-2 hover:bg-white/20 rounded-lg transition-colors" aria-label="Cerrar">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200 hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 mb-1">Correo de Soporte</div>
                    <a href="mailto:tandamx.soporte@gmail.com" className="text-blue-600 font-bold text-sm hover:text-blue-800 hover:underline break-all">
                      tandamx.soporte@gmail.com
                    </a>
                    <p className="text-xs text-gray-500 mt-1">⏱️ Tiempo de respuesta: 24-48 hrs</p>
                  </div>
                </div>
              </div>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-500">Otras opciones</span></div>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800 mb-1">Aviso de Privacidad</div>
                    <a
                      href="https://app-tanda-mx-legal.s3.us-east-1.amazonaws.com/politica_privacidad.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 font-bold text-sm hover:text-purple-800 hover:underline"
                    >
                      Consultar documento completo →
                    </a>
                    <p className="text-xs text-gray-500 mt-1">🔒 Tu información está protegida</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowContactModal(false)} className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
      `}</style>
    </>
  );
}
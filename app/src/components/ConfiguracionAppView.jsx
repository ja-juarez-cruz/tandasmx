import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  Trash2, 
  AlertTriangle, 
  Shield, 
  ChevronLeft, 
  X, 
  Info,
  Lock,
  Eye,
  EyeOff,
  Key,
  CheckCircle   // ← nuevo ícono para pantalla de éxito
} from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';

// ─── Se agrega onLogout para resetear el estado global de App.jsx ──────────
export default function ConfiguracionAppView({ userData, onAccountDeleted, onLogout }) {
  const navigate = useNavigate();
  
  // ── Estados: eliminar cuenta ─────────────────────────────────────────────
  const [showDeleteModal,    setShowDeleteModal]    = useState(false);
  const [confirmacionTexto,  setConfirmacionTexto]  = useState('');
  const [deleteLoading,      setDeleteLoading]      = useState(false);
  const [deleteError,        setDeleteError]        = useState(null);

  // ── Estados: cambiar contraseña ──────────────────────────────────────────
  const [showPasswordModal,    setShowPasswordModal]    = useState(false);
  const [currentPassword,      setCurrentPassword]      = useState('');
  const [newPassword,          setNewPassword]          = useState('');
  const [confirmPassword,      setConfirmPassword]      = useState('');
  const [showCurrentPassword,  setShowCurrentPassword]  = useState(false);
  const [showNewPassword,      setShowNewPassword]      = useState(false);
  const [showConfirmPassword,  setShowConfirmPassword]  = useState(false);
  const [passwordLoading,      setPasswordLoading]      = useState(false);
  const [passwordError,        setPasswordError]        = useState(null);
  // ← reemplaza passwordSuccess; null = inactivo, 1-3 = cuenta regresiva
  const [logoutCountdown,      setLogoutCountdown]      = useState(null);

  // ── Validaciones ─────────────────────────────────────────────────────────

  const validatePasswordStrength = (password) => {
    const errors = [];
    if (password.length < 8)                                         errors.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(password))                                     errors.push('Una letra mayúscula');
    if (!/[a-z]/.test(password))                                     errors.push('Una letra minúscula');
    if (!/[0-9]/.test(password))                                     errors.push('Un número');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))   errors.push('Un carácter especial');
    return errors;
  };

  // ── doLogout: limpia storage, notifica al padre y redirige ───────────────

  const doLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');

    // Resetea isAdmin, tandaData, etc. en App.jsx
    if (typeof onLogout === 'function') onLogout();

    navigate('/login', {
      state: { message: 'Contraseña actualizada. Por favor inicia sesión con tu nueva contraseña.' }
    });
  };

  // ── handleChangePassword ─────────────────────────────────────────────────

  const handleChangePassword = async () => {
    setPasswordError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Todos los campos son requeridos');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('La nueva contraseña debe ser diferente a la actual');
      return;
    }
    const strengthErrors = validatePasswordStrength(newPassword);
    if (strengthErrors.length > 0) {
      setPasswordError(`La contraseña debe contener: ${strengthErrors.join(', ')}`);
      return;
    }

    setPasswordLoading(true);

    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      // ── Éxito: iniciar cuenta regresiva de 3 segundos ────────────────
      let seconds = 3;
      setLogoutCountdown(seconds);

      const interval = setInterval(() => {
        seconds -= 1;
        if (seconds <= 0) {
          clearInterval(interval);
          setLogoutCountdown(null);
          doLogout();
        } else {
          setLogoutCountdown(seconds);
        }
      }, 1000);

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      setPasswordError(error.message || 'Error al cambiar la contraseña');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── handleEliminarCuenta ─────────────────────────────────────────────────

  const handleEliminarCuenta = async () => {
    if (confirmacionTexto !== 'ELIMINAR') {
      setDeleteError('Debes escribir "ELIMINAR" en mayúsculas para confirmar');
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await apiFetch('/auth/account', { method: 'DELETE' });
      localStorage.clear();
      onAccountDeleted();
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
      setDeleteError(error.message || 'Error al eliminar la cuenta');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Helpers de cierre de modales ─────────────────────────────────────────

  // Bloqueado mientras corre la cuenta regresiva
  const closePasswordModal = () => {
    if (logoutCountdown !== null) return;
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setConfirmacionTexto('');
    setDeleteError(null);
  };

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 py-6 md:py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Botón volver */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-700 hover:text-blue-600 mb-4 md:mb-6 font-semibold transition-colors text-sm md:text-base"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
          Volver
        </button>

        {/* Título */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl md:rounded-3xl shadow-xl p-4 md:p-6 text-white mb-4 md:mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm flex-shrink-0">
              <Shield className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-3xl font-bold mb-1">Configuración de Cuenta</h1>
              <p className="text-xs md:text-sm text-blue-100">Administra tu cuenta y preferencias</p>
            </div>
          </div>
        </div>

        {/* Información del Usuario */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <User className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            <h2 className="text-base md:text-xl font-bold text-gray-800">Información de la Cuenta</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
              <div className="p-2 bg-white rounded-lg flex-shrink-0">
                <User className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs md:text-sm text-gray-600 mb-1">Nombre</div>
                <div className="text-sm md:text-base font-semibold text-gray-800 truncate">
                  {userData?.nombre || 'Usuario'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
              <div className="p-2 bg-white rounded-lg flex-shrink-0">
                <Mail className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs md:text-sm text-gray-600 mb-1">Correo Electrónico</div>
                <div className="text-sm md:text-base font-semibold text-gray-800 truncate">
                  {userData?.email || localStorage.getItem('userEmail') || 'No disponible'}
                </div>
              </div>
            </div>

            {userData?.telefono && (
              <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
                <div className="p-2 bg-white rounded-lg flex-shrink-0">
                  <Phone className="w-4 h-4 md:w-5 md:h-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs md:text-sm text-gray-600 mb-1">Teléfono</div>
                  <div className="text-sm md:text-base font-semibold text-gray-800">
                    {userData.telefono}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xs md:text-sm text-blue-800 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Esta información se utiliza para identificarte en la aplicación y para las notificaciones de tus tandas.</span>
            </p>
          </div>
        </div>

        {/* Seguridad */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6 mb-4 md:mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
              <Lock className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
            </div>
            <h2 className="text-base md:text-xl font-bold text-gray-800">Seguridad</h2>
          </div>
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-5 h-5 text-gray-600 flex-shrink-0" />
                  <h3 className="font-bold text-gray-800 text-sm md:text-base">Contraseña</h3>
                </div>
                <p className="text-xs md:text-sm text-gray-600">
                  Actualiza tu contraseña regularmente para mantener tu cuenta segura
                </p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-all text-sm whitespace-nowrap flex-shrink-0"
              >
                <Lock className="w-4 h-4" />
                <span className="hidden sm:inline">Cambiar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Zona de Peligro */}
        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl md:rounded-2xl shadow-lg border-2 border-red-300 p-4 md:p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base md:text-xl font-bold text-red-800 mb-2">Zona de Peligro</h2>
              <p className="text-xs md:text-sm text-red-700">
                Las acciones en esta sección son <strong>permanentes e irreversibles</strong>.
              </p>
            </div>
          </div>
          <div className="bg-white border-2 border-red-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <h3 className="font-bold text-gray-800 text-sm md:text-base">Eliminar Cuenta</h3>
                </div>
                <p className="text-xs md:text-sm text-gray-700">
                  Elimina permanentemente tu cuenta y todos tus datos
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-all text-sm whitespace-nowrap flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: Cambiar Contraseña
      ════════════════════════════════════════════════════════════════════ */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn">
            <div className="p-4 md:p-6">

              {/* ── Pantalla de éxito con cuenta regresiva ── */}
              {logoutCountdown !== null ? (
                <div className="flex flex-col items-center py-8 text-center">

                  <div className="p-4 bg-green-100 rounded-full mb-5">
                    <CheckCircle className="w-14 h-14 text-green-600" />
                  </div>

                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    ¡Contraseña actualizada!
                  </h3>
                  <p className="text-sm text-gray-500 mb-8 max-w-xs">
                    Por seguridad, se cerrará tu sesión para que ingreses con la nueva contraseña.
                  </p>

                  {/* Círculo de cuenta regresiva animado */}
                  <div className="relative w-16 h-16 mb-2">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                      <circle
                        cx="32" cy="32" r="28"
                        fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round"
                        strokeDasharray={`${(logoutCountdown / 3) * 175.9} 175.9`}
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-green-600">
                      {logoutCountdown}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-6">
                    Cerrando sesión en {logoutCountdown} segundo{logoutCountdown !== 1 ? 's' : ''}…
                  </p>

                  <button
                    onClick={() => { setLogoutCountdown(null); doLogout(); }}
                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-all text-sm"
                  >
                    Cerrar sesión ahora
                  </button>
                </div>

              ) : (
                /* ── Formulario de cambio ── */
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-100 rounded-xl flex-shrink-0">
                      <Lock className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl md:text-2xl font-bold text-gray-800">Cambiar Contraseña</h3>
                      <p className="text-xs md:text-sm text-gray-600">Actualiza tu contraseña</p>
                    </div>
                    <button
                      onClick={closePasswordModal}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                      disabled={passwordLoading}
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Contraseña Actual */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Contraseña Actual
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError(null); }}
                          className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 transition-all"
                          placeholder="Ingresa tu contraseña actual"
                          disabled={passwordLoading}
                        />
                        <button type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          disabled={passwordLoading}
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                        </button>
                      </div>
                    </div>

                    {/* Nueva Contraseña */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Nueva Contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => { setNewPassword(e.target.value); setPasswordError(null); }}
                          className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 transition-all"
                          placeholder="Ingresa tu nueva contraseña"
                          disabled={passwordLoading}
                        />
                        <button type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          disabled={passwordLoading}
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial
                      </p>
                    </div>

                    {/* Confirmar Contraseña */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Confirmar Nueva Contraseña
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); }}
                          className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 transition-all"
                          placeholder="Confirma tu nueva contraseña"
                          disabled={passwordLoading}
                        />
                        <button type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded transition-colors"
                          disabled={passwordLoading}
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5 text-gray-500" /> : <Eye className="w-5 h-5 text-gray-500" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {passwordError && (
                    <div className="mt-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl">
                      <p className="text-sm text-red-800 font-semibold">{passwordError}</p>
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6">
                    <button
                      onClick={closePasswordModal}
                      className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-all"
                      disabled={passwordLoading}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                      className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {passwordLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Actualizando...
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          Cambiar Contraseña
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: Confirmar Eliminación de Cuenta
      ════════════════════════════════════════════════════════════════════ */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn">
            <div className="p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-xl flex-shrink-0">
                  <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800">¿Eliminar tu cuenta?</h3>
                  <p className="text-xs md:text-sm text-gray-600">Esta acción es permanente e irreversible</p>
                </div>
                <button
                  onClick={closeDeleteModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                  disabled={deleteLoading}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-xl">
                <p className="text-sm md:text-base text-red-800 font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  ADVERTENCIA: Acción Irreversible
                </p>
                <p className="text-xs md:text-sm text-red-700 mb-3">Se eliminarán <strong>permanentemente</strong>:</p>
                <ul className="text-xs md:text-sm text-red-700 space-y-1 ml-4 list-disc">
                  <li><strong>Tu cuenta completa</strong></li>
                  <li><strong>Todas tus tandas</strong> (activas e inactivas)</li>
                  <li><strong>Todos los participantes</strong> de tus tandas</li>
                  <li><strong>Todo el historial de pagos</strong></li>
                  <li><strong>Toda tu información personal</strong></li>
                </ul>
                <p className="text-xs md:text-sm text-red-800 font-bold mt-3">
                  NO podrás recuperar esta información después de eliminar tu cuenta.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
                  Para confirmar, escribe <span className="text-red-600 font-bold">ELIMINAR</span> en mayúsculas:
                </label>
                <input
                  type="text"
                  value={confirmacionTexto}
                  onChange={(e) => { setConfirmacionTexto(e.target.value); setDeleteError(null); }}
                  className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-xl focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 transition-all font-mono"
                  placeholder="Escribe ELIMINAR"
                  disabled={deleteLoading}
                />
                <p className="mt-1 text-[10px] md:text-xs text-gray-500">
                  Debe ser exactamente "ELIMINAR" en mayúsculas
                </p>
              </div>

              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl">
                  <p className="text-xs md:text-sm text-red-800 font-semibold">{deleteError}</p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={closeDeleteModal}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-all text-sm md:text-base"
                  disabled={deleteLoading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEliminarCuenta}
                  disabled={deleteLoading || confirmacionTexto !== 'ELIMINAR'}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  {deleteLoading ? (
                    <>
                      <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                      Eliminar Cuenta
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] md:text-xs text-center text-gray-500 mt-4">
                Esta acción eliminará tu cuenta permanentemente y cerrará tu sesión.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos de animación
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn  { from { opacity: 0; }                        to { opacity: 1; } }
    @keyframes scaleIn { from { opacity: 0; transform: scale(0.95);} to { opacity: 1; transform: scale(1); } }
    .animate-fadeIn  { animation: fadeIn  0.2s ease-out; }
    .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
  `;
  if (!document.querySelector('style[data-config-app-animations]')) {
    style.setAttribute('data-config-app-animations', 'true');
    document.head.appendChild(style);
  }
}
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, AlertCircle, CheckCircle, Loader, Info } from 'lucide-react';

const API_BASE_URL = 'https://9l2vrevqm1.execute-api.us-east-1.amazonaws.com/dev';

export default function DeleteAccountView() {
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    reason: '',
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '', details: '' });
  const [isValidEmail, setIsValidEmail] = useState(false);

  // Validar email en tiempo real
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsValidEmail(emailRegex.test(formData.email.trim()));
  }, [formData.email]);

  // Verificar si el botón debe estar habilitado
  const isFormValid = isValidEmail && formData.confirm;

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Limpiar mensajes al hacer cambios
    if (message.text) {
      setMessage({ type: '', text: '', details: '' });
    }
  };

  const handlePhoneInput = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, phone: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isValidEmail) {
      setMessage({
        type: 'error',
        text: 'Por favor ingresa un correo electrónico válido',
        details: ''
      });
      return;
    }

    if (!formData.confirm) {
      setMessage({
        type: 'error',
        text: 'Debes confirmar que entiendes que esta acción es permanente',
        details: ''
      });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '', details: '' });

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || null,
          reason: formData.reason.trim() || null,
          timestamp: new Date().toISOString()
        })
      });

      // Parsear la respuesta
      const data = await response.json();

      // Manejar respuesta exitosa (200)
      if (response.ok && data.success) {
        setMessage({
          type: 'success',
          text: data.message || 'Tu solicitud de eliminación ha sido procesada exitosamente.',
          details: data.data ? `Fecha de eliminación programada: ${data.data.deletionDate}` : ''
        });
        
        // Limpiar formulario
        setFormData({
          email: '',
          phone: '',
          reason: '',
          confirm: false
        });

        // Scroll al mensaje
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      } 
      // Manejar errores 400 - Bad Request
      else if (response.status === 400) {
        const errorMessage = data.message || 'Error en la solicitud';
        
        // Mensaje personalizado según el error
        if (errorMessage.includes('Ya existe una solicitud')) {
          setMessage({
            type: 'warning',
            text: 'Solicitud Duplicada',
            details: errorMessage
          });
        } else if (errorMessage.includes('correo electrónico')) {
          setMessage({
            type: 'error',
            text: 'Error de Validación',
            details: errorMessage
          });
        } else {
          setMessage({
            type: 'error',
            text: 'Error en la Solicitud',
            details: errorMessage
          });
        }
      }
      // Manejar error 404 - Usuario no encontrado
      else if (response.status === 404) {
        setMessage({
          type: 'error',
          text: 'Cuenta No Encontrada',
          details: data.message || 'No se encontró una cuenta asociada a este correo electrónico. Verifica que el correo sea correcto.'
        });
      }
      // Manejar error 500 - Error del servidor
      else if (response.status === 500) {
        setMessage({
          type: 'error',
          text: 'Error del Servidor',
          details: 'Ocurrió un error en nuestros servidores. Por favor, intenta nuevamente en unos minutos o contacta a soporte.'
        });
      }
      // Otros errores
      else {
        setMessage({
          type: 'error',
          text: 'Error Inesperado',
          details: data.message || `Error ${response.status}: No se pudo procesar tu solicitud. Por favor, intenta nuevamente.`
        });
      }
    } catch (error) {
      console.error('Error:', error);
      
      // Error de red o timeout
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setMessage({
          type: 'error',
          text: 'Error de Conexión',
          details: 'No se pudo conectar con el servidor. Verifica tu conexión a Internet e intenta nuevamente.'
        });
      } else {
        setMessage({
          type: 'error',
          text: 'Error Inesperado',
          details: 'Ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente o contacta a soporte.'
        });
      }
    } finally {
      setLoading(false);
      
      // Scroll al mensaje de error/éxito
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  };

  const handleBackToHome = () => {
    window.location.href = '/index.html';
  };

  // Función para determinar el ícono según el tipo de mensaje
  const getMessageIcon = () => {
    switch (message.type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />;
      case 'warning':
        return <Info className="w-6 h-6 flex-shrink-0 mt-0.5" />;
      case 'error':
      default:
        return <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />;
    }
  };

  // Función para determinar los estilos según el tipo de mensaje
  const getMessageStyles = () => {
    switch (message.type) {
      case 'success':
        return 'bg-green-50 border-2 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-2 border-yellow-200 text-yellow-800';
      case 'error':
      default:
        return 'bg-red-50 border-2 border-red-200 text-red-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50">
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBackToHome}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Volver a TandasMX</span>
          </button>

          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white text-center shadow-lg">
            <div className="inline-block p-4 bg-white bg-opacity-20 rounded-full mb-4">
              <Trash2 className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Eliminar Cuenta</h1>
            <p className="text-blue-100">Solicitud de eliminación de cuenta y datos</p>
          </div>
        </div>

        {/* Mensajes de respuesta */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl animate-fadeIn ${getMessageStyles()}`}>
            <div className="flex items-start gap-3">
              {getMessageIcon()}
              <div className="flex-1">
                <p className="font-bold mb-1 text-lg">
                  {message.text}
                </p>
                {message.details && (
                  <p className="text-sm mt-2 leading-relaxed">
                    {message.details}
                  </p>
                )}
                
                {/* Información adicional para warning */}
                {message.type === 'warning' && (
                  <div className="mt-3 pt-3 border-t border-yellow-300">
                    <p className="text-sm font-semibold">
                      💡 Si deseas cancelar la solicitud anterior, contacta a soporte:
                    </p>
                    <a 
                      href="mailto:tandamx.soporte@gmail.com" 
                      className="text-sm text-yellow-900 hover:text-yellow-950 font-bold underline"
                    >
                      tandamx.soporte@gmail.com
                    </a>
                  </div>
                )}

                {/* Botón de contacto para errores */}
                {message.type === 'error' && (
                  <div className="mt-3 pt-3 border-t border-red-300">
                    <p className="text-sm">
                      Si el problema persiste, contacta a{' '}
                      <a 
                        href="mailto:tandamx.soporte@gmail.com" 
                        className="font-bold underline hover:text-red-900"
                      >
                        tandamx.soporte@gmail.com
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          {/* Advertencia */}
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 mb-2">⚠️ Información Importante</h3>
                <p className="text-red-800 mb-2">
                  La eliminación de tu cuenta es <strong>permanente e irreversible</strong>. Se eliminarán:
                </p>
                <ul className="text-red-800 text-sm space-y-1 ml-4 list-disc">
                  <li>Tu cuenta de usuario</li>
                  <li>Todas tus tandas creadas</li>
                  <li>Información de participantes registrados</li>
                  <li>Historial de pagos y transacciones</li>
                  <li>Configuraciones y preferencias</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Correo electrónico registrado <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="tu@email.com"
                autoComplete="email"
                disabled={loading}
                className={`w-full px-4 py-3 border-2 rounded-xl transition-all ${
                  loading ? 'bg-gray-100 cursor-not-allowed' :
                  formData.email && !isValidEmail
                    ? 'border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                    : formData.email && isValidEmail
                    ? 'border-green-300 focus:ring-2 focus:ring-green-500 focus:border-green-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {formData.email && !isValidEmail && (
                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Por favor ingresa un correo electrónico válido
                </p>
              )}
              {formData.email && isValidEmail && (
                <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Correo electrónico válido
                </p>
              )}
            </div>

            {/* Teléfono - OPCIONAL */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                Número telefónico (opcional)
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneInput}
                placeholder="+52 55 1234 5678"
                autoComplete="tel"
                disabled={loading}
                className={`w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                  loading ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              <p className="mt-2 text-xs text-gray-500">
                Proporcionar tu teléfono nos ayuda a verificar tu identidad
              </p>
            </div>

            {/* Razón */}
            <div>
              <label htmlFor="reason" className="block text-sm font-semibold text-gray-700 mb-2">
                Motivo de eliminación (opcional)
              </label>
              <textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                rows={4}
                placeholder="Cuéntanos por qué deseas eliminar tu cuenta (esto nos ayuda a mejorar)"
                disabled={loading}
                className={`w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none ${
                  loading ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
            </div>

            {/* Confirmación */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border-2 border-gray-200">
              <input
                type="checkbox"
                id="confirm"
                name="confirm"
                checked={formData.confirm}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
              />
              <label htmlFor="confirm" className={`text-sm text-gray-700 select-none ${loading ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                Confirmo que entiendo que esta acción es <strong className="text-gray-900">permanente e irreversible</strong> 
                {' '}y que toda mi información será eliminada en un plazo máximo de 30 días. <span className="text-red-500">*</span>
              </label>
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all ${
                !isFormValid || loading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader className="w-5 h-5 animate-spin" />
                  Procesando solicitud...
                </span>
              ) : (
                'Solicitar Eliminación de Cuenta'
              )}
            </button>

            {/* Indicador de estado del formulario */}
            {!isFormValid && !loading && (
              <div className="text-center text-sm text-gray-500">
                {!isValidEmail && '📧 Ingresa un correo electrónico válido'}
                {isValidEmail && !formData.confirm && '✓ Marca la confirmación para continuar'}
              </div>
            )}
          </form>

          {/* Info box */}
          <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
            <h3 className="font-bold text-blue-900 mb-2">📋 ¿Qué sucede después?</h3>
            <div className="text-blue-800 text-sm space-y-1">
              <p>1. Tu cuenta será marcada para eliminación inmediatamente</p>
              <p>2. Confirmaremos tu cuenta a traves del correo registrado</p>
              <p>3. Una vez confirmado, tus datos serán eliminados en un plazo máximo de 30 días</p>
              <p>4. Si deseas cancelar la solicitud, contáctanos antes de que se complete</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>
            ¿Tienes dudas? Contacta a{' '}
            <a 
              href="mailto:tandamx.soporte@gmail.com" 
              className="text-blue-600 hover:text-blue-800 font-semibold"
            >
              tandamx.soporte@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
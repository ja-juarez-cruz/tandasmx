import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Calendar, DollarSign, AlertCircle, Loader, Shield } from 'lucide-react';
import { calcularFechasRondas } from '../utils/tandaCalculos';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/apiFetch';

export default function RegistroPublicoView() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tandaData, setTandaData] = useState(null);
  const [numerosSeleccionados, setNumerosSeleccionados] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [registroExitoso, setRegistroExitoso] = useState(false);
  const [tiempoRestante, setTiempoRestante] = useState(null);
  const [tandaCompleta, setTandaCompleta] = useState(false);
  
  const [errores, setErrores] = useState({
    telefono: '',
    email: ''
  });
  
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyContent, setPrivacyContent] = useState('');
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [privacyError, setPrivacyError] = useState(null);
  
  const [pasoActual, setPasoActual] = useState(1);
  
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: ''
  });

  // Cargar datos de la tanda con el token
  useEffect(() => {
    console.log('🎯 RegistroPublicoView montado');
    console.log('📝 Token recibido:', token);
    
    if (!token || token === 'undefined' || token.trim() === '') {
      console.error('❌ Token inválido:', token);
      setError('Link de registro no válido. Por favor solicita un nuevo link.');
      setLoading(false);
      return;
    }
    
    cargarDatosTanda();
  }, [token]);

  const cargarDatosTanda = async () => {
    console.log('🔄 Cargando datos de la tanda...');
    
    setLoading(true);
    setError(null);
    
    try {
      if (!token || token === 'undefined' || token.trim() === '') {
        throw new Error('Token de registro no válido');
      }

      const url = `${API_BASE_URL}/registro/${token}`;
      console.log('🌐 URL completa:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log('📥 Status de respuesta:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Link de registro no válido o expirado');
        }
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Error al cargar datos: ${response.status}`);
      }

      const data = await response.json();
      //console.log('✅ Datos recibidos:', data);

      if (data.success && data.data) {
        setTandaData(data.data);
        
        const numerosOcupados = data.data.participantes?.map(p => p.numeroAsignado) || [];
        const numerosDisponibles = [];
        for (let i = 1; i <= data.data.totalRondas; i++) {
          if (!numerosOcupados.includes(i)) {
            numerosDisponibles.push(i);
          }
        }
        
        if (numerosDisponibles.length === 0) {
          setTandaCompleta(true);
          setTimeout(() => {
            navigate(`/public-board/${data.data.tandaId}`); // 🔄 CAMBIO
          }, 3000);
        }
        
        if (data.data.expiracion) {
          calcularTiempoRestante(data.data.expiracion);
        }
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('❌ Error cargando tanda:', error);
      setError(error.message || 'Error al cargar datos de la tanda');
    } finally {
      setLoading(false);
    }
  };

  const loadPrivacyPolicy = async () => {
    setLoadingPrivacy(true);
    setPrivacyError(null);
    
    try {
      const response = await fetch('https://app-tanda-mx-legal.s3.us-east-1.amazonaws.com/politica_privacidad.html');
      
      if (!response.ok) {
        throw new Error('No se pudo cargar el aviso de privacidad');
      }
      
      const htmlContent = await response.text();
      setPrivacyContent(htmlContent);
    } catch (error) {
      console.error('Error cargando política de privacidad:', error);
      setPrivacyError('No se pudo cargar el aviso de privacidad. Por favor, intenta más tarde.');
    } finally {
      setLoadingPrivacy(false);
    }
  };

  const calcularTiempoRestante = (expiracion) => {
    const ahora = new Date().getTime();
    
    let fechaExpiracion;
    
    if (typeof expiracion === 'number') {
      fechaExpiracion = expiracion * 1000;
    } else if (typeof expiracion === 'string') {
      fechaExpiracion = new Date(expiracion).getTime();
    } else {
      console.error('Formato de expiracion desconocido:', expiracion);
      setTiempoRestante('Expirado');
      return;
    }
    
    const diferencia = fechaExpiracion - ahora;
    
    if (diferencia <= 0) {
      setTiempoRestante('Expirado');
      return;
    }
    
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
    
    setTiempoRestante(`${horas}h ${minutos}m`);
  };

  useEffect(() => {
    if (!tandaData?.expiracion) return;
    
    calcularTiempoRestante(tandaData.expiracion);
    
    const interval = setInterval(() => {
      calcularTiempoRestante(tandaData.expiracion);
    }, 60000);
    
    return () => clearInterval(interval);
  }, [tandaData]);

  // Funciones de validación
  const validarTelefono = (telefono) => {
    const telefonoLimpio = telefono.replace(/\s+/g, '').replace(/[-()\s]/g, '');
    
    if (telefonoLimpio.length === 0) {
      return '';
    }
    
    if (!/^\d+$/.test(telefonoLimpio)) {
      return 'El teléfono solo debe contener números';
    }
    
    if (telefonoLimpio.length !== 10) {
      return 'El teléfono debe tener exactamente 10 dígitos';
    }
    
    return '';
  };

  const validarEmail = (email) => {
    if (email.trim() === '') {
      return '';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Ingresa un email válido (ejemplo@correo.com)';
    }
    
    return '';
  };

  const handleTelefonoChange = (e) => {
    const valor = e.target.value;
    setFormData({ ...formData, telefono: valor });
    
    const error = validarTelefono(valor);
    setErrores({ ...errores, telefono: error });
  };

  const handleEmailChange = (e) => {
    const valor = e.target.value;
    setFormData({ ...formData, email: valor });
    
    const error = validarEmail(valor);
    setErrores({ ...errores, email: error });
  };

  const toggleNumero = (numero) => {
    const maxNumeros = Math.floor(tandaData.totalRondas * 0.5);
    
    if (numerosSeleccionados.includes(numero)) {
      setNumerosSeleccionados(numerosSeleccionados.filter(n => n !== numero));
    } else {
      if (numerosSeleccionados.length >= maxNumeros) {
        alert(`Solo puedes seleccionar hasta ${maxNumeros} números (50% del total)`);
        return;
      }
      setNumerosSeleccionados([...numerosSeleccionados, numero]);
    }
  };

  const avanzarPaso = () => {
    if (numerosSeleccionados.length === 0) {
      alert('Por favor selecciona al menos un número para continuar');
      return;
    }
    
    setError(null);
    setPasoActual(2);
    
    setTimeout(() => {
      const pasosElement = document.querySelector('.indicador-pasos');
      if (pasosElement) {
        pasosElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const enviarRegistro = async (e) => {
    e.preventDefault();
    
    console.log('📝 Iniciando registro...');
    
    if (!acceptedPrivacy) {
      alert('Debes aceptar el Aviso de Privacidad para continuar');
      return;
    }
    
    if (numerosSeleccionados.length === 0) {
      alert('Debes seleccionar al menos un número');
      return;
    }

    if (!formData.nombre.trim() || !formData.telefono.trim()) {
      alert('Nombre y teléfono son obligatorios');
      return;
    }
    
    const errorTelefono = validarTelefono(formData.telefono);
    if (errorTelefono) {
      setErrores({ ...errores, telefono: errorTelefono });
      alert('Por favor corrige el teléfono antes de continuar');
      return;
    }
    
    if (formData.email.trim()) {
      const errorEmail = validarEmail(formData.email);
      if (errorEmail) {
        setErrores({ ...errores, email: errorEmail });
        alert('Por favor corrige el email antes de continuar');
        return;
      }
    }

    if (!token || token === 'undefined' || token.trim() === '') {
      setError('Token de registro inválido. Por favor solicita un nuevo link.');
      return;
    }

    setEnviando(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/registro/${token}`;
      console.log('🌐 URL de registro:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombre: formData.nombre.trim(),
          telefono: formData.telefono.trim(),
          email: formData.email.trim() || undefined,
          numeros: numerosSeleccionados
        })
      });

      console.log('📥 Respuesta status:', response.status);
      const data = await response.json();
      console.log('📥 Respuesta data:', data);
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Error al registrar');
      }

      if (data.success) {
        console.log('✅ Registro exitoso');
        setRegistroExitoso(true);
        setTimeout(() => {
          navigate(`/public-board/${tandaData.tandaId}`); // 🔄 CAMBIO
        }, 2000);
      }
    } catch (error) {
      console.error('❌ Error en registro:', error);
      setError(error.message || 'Error al completar el registro');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block p-4 bg-white rounded-2xl shadow-xl mb-4">
            <Loader className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (error && !tandaData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')} // 🔄 CAMBIO
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Ir al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (tandaCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-3xl shadow-xl p-8">
          <div className="inline-block p-6 bg-blue-100 rounded-full mb-4">
            <CheckCircle className="w-16 h-16 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Tanda Completa!</h2>
          <p className="text-gray-600 mb-4">
            Todos los números de esta tanda ya han sido asignados.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Pero puedes ver el tablero público para seguir el progreso de los pagos.
          </p>
          <div className="mt-6">
            <Loader className="w-6 h-6 text-blue-600 mx-auto mb-2 animate-spin" />
            <p className="text-xs text-gray-500">
              Redirigiendo al tablero público...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (registroExitoso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md bg-white rounded-3xl shadow-xl p-8">
          <div className="inline-block p-6 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-16 h-16 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Registro Exitoso!</h2>
          <p className="text-gray-600 mb-4">
            Te has registrado correctamente en la tanda
          </p>
          <p className="text-xl font-bold text-blue-600 mb-4">
            "{tandaData?.nombre}"
          </p>
          <div className="mt-6">
            <Loader className="w-6 h-6 text-blue-600 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-gray-500">
              Serás redirigido al tablero público...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const numerosOcupados = tandaData.participantes?.map(p => p.numeroAsignado) || [];
  const numerosDisponibles = Array.from(
    { length: tandaData.totalRondas },
    (_, i) => i + 1
  ).filter(n => !numerosOcupados.includes(n));

  const maxNumeros = Math.floor(tandaData.totalRondas * 0.5);

  // Usar función importada para calcular fechas de ronda
  const obtenerFechasRonda = (numeroRonda) => {
    if (!tandaData.fechaInicio) return null;
    
    const fechasRondas = calcularFechasRondas(
      tandaData.fechaInicio,
      tandaData.totalRondas,
      tandaData.frecuencia
    );
    
    const ronda = fechasRondas.find(r => r.numero === numeroRonda);
    
    if (!ronda) return null;
    
    return {
      inicio: ronda.fechaInicio,
      fin: ronda.fechaLimite
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-block p-3 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl mb-4">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-800 mb-2">
              {tandaData.nombre}
            </h1>
            <p className="text-gray-600">Registro de Participante</p>
            
            {tiempoRestante && tiempoRestante !== 'Expirado' && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-md">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span className="text-[10px] text-gray-600 font-medium">
                  Válido {tiempoRestante}
                </span>
              </div>
            )}
            
            {tiempoRestante === 'Expirado' && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="w-3 h-3 text-red-600" />
                <span className="text-[10px] text-red-700 font-medium">
                  Expirado
                </span>
              </div>
            )}
          </div>

          {/* Mensaje informativo si la tanda aún no inicia */}
          {(() => {
            const fechaInicio = tandaData.fechaInicio ? new Date(tandaData.fechaInicio + 'T00:00:00') : null;
            const fechaActual = new Date();
            fechaActual.setHours(0, 0, 0, 0);
            
            if (fechaInicio && fechaInicio > fechaActual) {
              const diasFaltantes = Math.ceil((fechaInicio - fechaActual) / (1000 * 60 * 60 * 24));
              
              return (
                <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-2xl">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900 mb-1">
                        📅 Próximo inicio de tanda
                      </p>
                      <p className="text-sm text-blue-800">
                        La tanda iniciará el{' '}
                        <strong>
                          {fechaInicio.toLocaleDateString('es-MX', { 
                            weekday: 'long',
                            day: 'numeric', 
                            month: 'long',
                            year: 'numeric'
                          })}
                        </strong>
                        {diasFaltantes === 1 ? ' (mañana)' : ` (en ${diasFaltantes} días)`}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Puedes registrarte ahora y asegurar tus números favoritos
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Resumen Compacto */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span className="text-[10px] text-green-700 font-semibold uppercase">Monto</span>
              </div>
              <div className="text-lg font-black text-gray-900">
                ${tandaData.montoPorRonda?.toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-600">por ronda</div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span className="text-[10px] text-orange-700 font-semibold uppercase">Frecuencia</span>
              </div>
              <div className="text-lg font-black text-gray-900 capitalize">
                {tandaData.frecuencia}
              </div>
              <div className="text-[10px] text-gray-600">de pagos</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] text-blue-700 font-semibold uppercase">Rondas</span>
              </div>
              <div className="text-lg font-black text-gray-900">
                {tandaData.totalRondas}
              </div>
              <div className="text-[10px] text-gray-600">totales</div>
            </div>

            {(() => {
              const fechaInicio = tandaData.fechaInicio ? new Date(tandaData.fechaInicio + 'T00:00:00') : null;
              
              return fechaInicio && !isNaN(fechaInicio) ? (
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span className="text-[10px] text-purple-700 font-semibold uppercase">Inicio</span>
                  </div>
                  <div className="text-sm font-black text-gray-900">
                    {fechaInicio.toLocaleDateString('es-MX', { 
                      day: 'numeric', 
                      month: 'short'
                    })}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {fechaInicio.getFullYear()}
                  </div>
                </div>
              ) : null;
            })()}

            {(() => {
              const fechasRondas = calcularFechasRondas(
                tandaData.fechaInicio,
                tandaData.totalRondas,
                tandaData.frecuencia
              );
              
              if (fechasRondas.length === 0) return null;
              
              const ultimaRonda = fechasRondas[fechasRondas.length - 1];
              const fechaFin = ultimaRonda.fechaInicio;
              
              return (
                <div className="bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-pink-600" />
                    <span className="text-[10px] text-pink-700 font-semibold uppercase">Fin</span>
                  </div>
                  <div className="text-sm font-black text-gray-900">
                    {fechaFin.toLocaleDateString('es-MX', { 
                      day: 'numeric', 
                      month: 'short'
                    })}
                  </div>
                  <div className="text-[10px] text-gray-600">
                    {fechaFin.getFullYear()}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-sky-100 border-2 border-blue-200 rounded-full">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-bold text-blue-900">
                {numerosDisponibles.length} números disponibles
              </span>
            </div>
          </div>
        </div>

        {/* Indicador de Pasos */}
        <div className="indicador-pasos bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-center gap-4 md:gap-8">
            <div className="flex items-center gap-2 md:gap-3">
              <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full font-bold transition-all ${
                pasoActual >= 1 
                  ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {pasoActual > 1 ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="text-lg">1</span>
                )}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-bold text-gray-800">Paso 1</p>
                <p className="text-xs text-gray-600">Selección de Números</p>
              </div>
            </div>

            <div className={`h-1 w-12 md:w-24 rounded-full transition-all ${
              pasoActual >= 2 ? 'bg-gradient-to-r from-blue-600 to-blue-800' : 'bg-gray-200'
            }`}></div>

            <div className="flex items-center gap-2 md:gap-3">
              <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full font-bold transition-all ${
                pasoActual >= 2 
                  ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg' 
                  : 'bg-gray-200 text-gray-500'
              }`}>
                <span className="text-lg">2</span>
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-bold text-gray-800">Paso 2</p>
                <p className="text-xs text-gray-600">Datos y Privacidad</p>
              </div>
            </div>
          </div>

          <div className="md:hidden mt-4 text-center">
            <p className="text-sm font-bold text-gray-800">
              {pasoActual === 1 ? 'Paso 1: Selección de Números' : 'Paso 2: Datos y Privacidad'}
            </p>
          </div>
        </div>

        {/* PASO 1: Selección de Números */}
        {pasoActual === 1 && (
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Selecciona tus Números</h2>
              </div>
              <div className="px-3 py-1.5 bg-blue-100 rounded-lg">
                <span className="text-sm font-bold text-blue-900">
                  {numerosSeleccionados.length} / {maxNumeros}
                </span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-900 mb-1">
                    💡 Puedes seleccionar hasta <strong>{maxNumeros} números</strong>
                  </p>
                  <p className="text-xs text-yellow-800">
                    Click en los números disponibles (con punto verde)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[500px] overflow-y-auto pr-2 mb-6">
              {Array.from({ length: tandaData.totalRondas }, (_, i) => i + 1).map((numero) => {
                const disponible = numerosDisponibles.includes(numero);
                const seleccionado = numerosSeleccionados.includes(numero);
                const fechas = disponible ? obtenerFechasRonda(numero) : null;

                return (
                  <div key={numero} className="relative flex flex-col group">
                    <button
                      type="button"
                      onClick={() => disponible && toggleNumero(numero)}
                      disabled={!disponible}
                      className={`
                        relative w-full rounded-2xl font-bold transition-all duration-200
                        ${!disponible
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-2 border-gray-200'
                          : seleccionado
                          ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white shadow-lg shadow-blue-300 scale-105 border-2 border-blue-400'
                          : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-400 hover:shadow-md hover:scale-102 active:scale-95'
                        }
                      `}
                      style={{ aspectRatio: '1', minHeight: '80px' }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-2xl ${seleccionado ? 'font-black' : 'font-bold'}`}>
                          {numero}
                        </span>
                      </div>
                      
                      {seleccionado && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle className="w-4 h-4 text-white drop-shadow-md" />
                        </div>
                      )}
                      
                      {disponible && !seleccionado && (
                        <div className="absolute top-1 right-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm"></div>
                        </div>
                      )}
                    </button>
                    
                    {disponible && fechas && (
                      <div className="mt-1.5 px-1 space-y-0.5">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-2.5 h-2.5 text-gray-500" />
                          <span className="text-[9px] font-semibold text-gray-700">
                            {fechas.inicio.toLocaleDateString('es-MX', { 
                              day: 'numeric', 
                              month: 'short'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <AlertCircle className="w-2.5 h-2.5 text-red-500" />
                          <span className="text-[9px] font-semibold text-red-600">
                            {fechas.fin.toLocaleDateString('es-MX', { 
                              day: 'numeric', 
                              month: 'short'
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {disponible && fechas && (
                      <div className="
                        absolute -top-20 left-1/2 transform -translate-x-1/2 
                        bg-gray-900 text-white text-xs px-3 py-2 rounded-lg 
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        whitespace-nowrap z-20 pointer-events-none
                        shadow-xl
                      ">
                        <div className="font-bold mb-1 text-center border-b border-gray-700 pb-1">
                          Ronda #{numero}
                        </div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Calendar className="w-3 h-3" />
                          <span className="text-[10px]">
                            Inicia: {fechas.inicio.toLocaleDateString('es-MX', { 
                              day: 'numeric', 
                              month: 'long'
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          <span className="text-[10px]">
                            Límite: {fechas.fin.toLocaleDateString('es-MX', { 
                              day: 'numeric', 
                              month: 'long'
                            })}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {numerosSeleccionados.length > 0 && (
              <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl">
                <h3 className="text-sm font-bold text-blue-900 mb-3">🎯 Números Seleccionados</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {numerosSeleccionados.sort((a, b) => a - b).map(num => (
                    <span
                      key={num}
                      className="px-2.5 py-1 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-lg font-bold text-sm shadow-sm"
                    >
                      #{num}
                    </span>
                  ))}
                </div>
                <div className="pt-3 border-t border-blue-200">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">Recibirás por número:</span>
                    <span className="text-lg font-black text-blue-900">
                      ${(tandaData.montoPorRonda * tandaData.totalRondas).toLocaleString()}
                    </span>
                  </div>
                  {numerosSeleccionados.length > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900">Total a recibir:</span>
                      <span className="text-2xl font-black text-blue-900">
                        ${(tandaData.montoPorRonda * tandaData.totalRondas * numerosSeleccionados.length).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={avanzarPaso}
              disabled={numerosSeleccionados.length === 0}
              className="w-full py-4 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white rounded-2xl font-bold text-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <span className="flex items-center justify-center gap-2">
                Siguiente: Ingresar Datos
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </button>
          </div>
        )}

        {/* PASO 2: Datos Personales y Confirmación */}
        {pasoActual === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Tus Datos Personales</h2>
              </div>
              
              <form onSubmit={enviarRegistro} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Tu nombre"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.telefono}
                    onChange={handleTelefonoChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errores.telefono 
                        ? 'border-red-500 focus:ring-red-500 bg-red-50' 
                        : 'border-gray-200'
                    }`}
                    placeholder="5512345678"
                    pattern="[0-9]{10}"
                    title="Ingresa un teléfono válido de 10 dígitos"
                  />
                  {errores.telefono ? (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errores.telefono}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-gray-500">
                      10 dígitos sin espacios ni guiones
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email (opcional)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={handleEmailChange}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errores.email 
                        ? 'border-red-500 focus:ring-red-500 bg-red-50' 
                        : 'border-gray-200'
                    }`}
                    placeholder="tu@email.com"
                  />
                  {errores.email && (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errores.email}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-gray-100">
                  <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="privacy-checkbox-registro"
                        checked={acceptedPrivacy}
                        onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                        className="mt-1 w-5 h-5 text-blue-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="privacy-checkbox-registro" className="text-sm text-gray-700 cursor-pointer select-none">
                        He leído y acepto el{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setShowPrivacyModal(true);
                            if (!privacyContent) {
                              loadPrivacyPolicy();
                            }
                          }}
                          className="text-blue-600 font-semibold hover:text-blue-700 underline"
                        >
                          Aviso de Privacidad
                        </button>
                        {' '}y los términos de uso de TandasMX
                      </label>
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Resumen de tu Registro</h2>
              </div>

              <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-blue-900">🎯 Números Seleccionados</h3>
                  <button
                    onClick={() => setPasoActual(1)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Editar
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 py-2">
                    {numerosSeleccionados.sort((a, b) => a - b).map(num => (
                      <span
                        key={num}
                        className="px-2.5 py-1 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-lg font-bold text-sm shadow-sm"
                      >
                        #{num}
                      </span>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-blue-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Por número:</span>
                      <span className="text-lg font-black text-blue-900">
                        ${(tandaData.montoPorRonda * tandaData.totalRondas).toLocaleString()}
                      </span>
                    </div>
                    {numerosSeleccionados.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">Total a recibir:</span>
                        <span className="text-2xl font-black text-blue-900">
                          ${(tandaData.montoPorRonda * tandaData.totalRondas * numerosSeleccionados.length).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setPasoActual(1)}
                  className="flex-1 sm:flex-none py-3 px-8 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Volver a Números</span>
                </button>
                
                <button
                  onClick={enviarRegistro}
                  disabled={
                    enviando || 
                    !formData.nombre.trim() || 
                    !formData.telefono.trim() ||
                    !acceptedPrivacy ||
                    errores.telefono !== '' ||
                    errores.email !== ''
                  }
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white rounded-xl font-bold text-lg hover:shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {enviando ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader className="w-5 h-5 animate-spin" />
                      Registrando...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      ¡Confirmar Registro!
                    </span>
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal de Política de Privacidad */}
        {showPrivacyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-fadeIn">
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8" />
                    <div>
                      <h2 className="text-2xl font-bold">Aviso de Privacidad</h2>
                      <p className="text-sm opacity-90">TandasMX</p>
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

              <div className="p-6 overflow-y-auto flex-1">
                {loadingPrivacy ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mb-4" />
                    <p className="text-gray-600">Cargando aviso de privacidad...</p>
                  </div>
                ) : privacyError ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 bg-red-100 rounded-full mb-4">
                      <AlertCircle className="w-12 h-12 text-red-600" />
                    </div>
                    <p className="text-red-600 text-center mb-4">{privacyError}</p>
                    <button
                      onClick={loadPrivacyPolicy}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
                    <p className="text-gray-600 mb-4">No se ha cargado el contenido</p>
                    <button
                      onClick={loadPrivacyPolicy}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Cargar Aviso de Privacidad
                    </button>
                  </div>
                )}
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="px-6 py-2.5 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cerrar
                </button>
                {!acceptedPrivacy && (
                  <button
                    onClick={() => {
                      setAcceptedPrivacy(true);
                      setShowPrivacyModal(false);
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
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
    
    .prose {
      color: #374151;
      max-w-none;
    }
    .prose h1, .prose h2, .prose h3 {
      color: #1f2937;
      font-weight: 700;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    .prose h1 {
      font-size: 1.875rem;
      line-height: 2.25rem;
    }
    .prose h2 {
      font-size: 1.5rem;
      line-height: 2rem;
    }
    .prose h3 {
      font-size: 1.25rem;
      line-height: 1.75rem;
    }
    .prose p {
      margin-bottom: 1em;
      line-height: 1.625;
    }
    .prose ul, .prose ol {
      margin-top: 0.5em;
      margin-bottom: 1em;
      padding-left: 1.5em;
    }
    .prose li {
      margin-bottom: 0.25em;
    }
    .prose strong {
      font-weight: 600;
      color: #1f2937;
    }
    .prose a {
      color: #2563eb;
      text-decoration: underline;
    }
    .prose a:hover {
      color: #1d4ed8;
    }
  `;
  if (!document.querySelector('style[data-privacy-styles-registro]')) {
    style.setAttribute('data-privacy-styles-registro', 'true');
    document.head.appendChild(style);
  }
}
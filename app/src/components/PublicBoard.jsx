import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Users, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { calcularRondaActual } from '../utils/tandaCalculos';
import VerifyPhone from './VerifyPhone'; // 🆕 IMPORTAR
import logoTanda from '../public/assets/logos/logo-tanda-512.png';
import logoTandaSvg from '../public/assets/logos/logo-tanda.svg';

const API_BASE_URL = 'https://9l2vrevqm1.execute-api.us-east-1.amazonaws.com/dev';

export default function PublicBoard() {
  const { tandaId } = useParams();
  
  const [tandaData, setTandaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isVerified, setIsVerified] = useState(false); // 🆕 Estado de verificación
  const [verifiedParticipant, setVerifiedParticipant] = useState(null); // 🆕 Participante verificado

  // 🆕 Cargar datos de la tanda SIEMPRE (para poder verificar el teléfono)
  useEffect(() => {
    const cargarTanda = async () => {
      if (!tandaId) {
        setError('ID de tanda no proporcionado');
        setLoading(false);
        return;
      }

      console.log('🔄 Cargando tanda pública:', tandaId);
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/tandas/${tandaId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        console.log('📥 Status de respuesta:', response.status);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Tanda no encontrada');
          }
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `Error al cargar datos: ${response.status}`);
        }

        const data = await response.json();
        //console.log('✅ Datos recibidos:', data);

        if (data.success && data.data) {
          setTandaData(data.data);
          
          // 🆕 Verificar si ya está autenticado en sessionStorage
          const storedPhone = sessionStorage.getItem(`tanda_verified_${tandaId}`);
          if (storedPhone) {
            // Validar que el teléfono guardado aún existe en los participantes
            const normalizePhone = (phone) => phone.replace(/\D/g, '');
            const phoneNormalized = normalizePhone(storedPhone);
            
            const participante = data.data.participantes?.find(p => {
              const participantPhone = normalizePhone(p.telefono || '');
              return participantPhone === phoneNormalized;
            });
            
            if (participante) {
              setIsVerified(true);
              setVerifiedParticipant(participante);
            } else {
              // Si el teléfono ya no es válido, limpiar sessionStorage
              sessionStorage.removeItem(`tanda_verified_${tandaId}`);
            }
          }
        } else {
          throw new Error('Respuesta inválida del servidor');
        }
      } catch (error) {
        console.error('❌ Error cargando tanda:', error);
        setError(error.message || 'Error al cargar la información de la tanda');
      } finally {
        setLoading(false);
      }
    };

    cargarTanda();
  }, [tandaId]);

  // 🆕 Callback cuando se verifica exitosamente
  const handleVerified = (participante) => {
    setIsVerified(true);
    setVerifiedParticipant(participante);
  };

  // LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block p-4 bg-white rounded-2xl shadow-xl mb-4">
            <Loader className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Cargando información...</p>
        </div>
      </div>
    );
  }

  // ERROR STATE
  if (error || !tandaData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {error || 'Tanda no encontrada'}
            </h2>
            <p className="text-gray-600 mb-6">
              No se pudo cargar la información de la tanda
            </p>
            <button
              onClick={() => window.location.href = '/index.html'}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Ir al Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🆕 Mostrar pantalla de verificación si no está verificado
  if (!isVerified) {
    return <VerifyPhone tandaData={tandaData} onVerified={handleVerified} />;
  }

  // Usar función importada para calcular ronda actual
  const rondaActual = calcularRondaActual(tandaData);
  const proximoNumero = tandaData.participantes?.find(p => p.numeroAsignado === rondaActual);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Logo y Título */}
        <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 mb-6">
          <div className="text-center mb-6">
            <div className="inline-block mb-4">
              <img 
                src={logoTanda}
                alt="Tanda App" 
                className="w-20 h-20 object-contain drop-shadow-lg"
                onError={(e) => { e.target.src = logoTandaSvg; }}
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
              {tandaData.nombre}
            </h1>
            <p className="text-gray-600">Tablero Público</p>
            {/* 🆕 Mostrar info del participante verificado */}
            {verifiedParticipant && (
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-semibold text-green-800">
                  Sesión verificada: {verifiedParticipant.nombre}
                </span>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 text-center border-2 border-blue-200">
              <div className="text-2xl font-black text-blue-900">
                ${tandaData.montoPorRonda?.toLocaleString()}
              </div>
              <div className="text-sm text-blue-700 font-medium">Por Ronda</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 text-center border-2 border-green-200">
              <div className="text-2xl font-black text-green-900">
                Ronda {rondaActual} / {tandaData.totalRondas}
              </div>
              <div className="text-sm text-green-700 font-medium">Progreso</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 text-center border-2 border-purple-200">
              <div className="text-2xl font-black text-purple-900">
                {tandaData.participantes?.length || 0}
              </div>
              <div className="text-sm text-purple-700 font-medium">Participantes</div>
            </div>
          </div>

          {/* Próximo Número */}
          {proximoNumero && (
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white text-center shadow-lg">
              <div className="text-sm font-semibold mb-1 opacity-90">Turno Actual</div>
              <div className="text-5xl font-black mb-2">{proximoNumero.numeroAsignado}</div>
              <div className="text-xl font-bold">{proximoNumero.nombre}</div>
            </div>
          )}
        </div>

        {/* Lista de Participantes */}
        <div className="bg-white rounded-3xl shadow-xl p-4 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            Participantes
          </h2>

          <div className="space-y-3">
            {(tandaData.participantes || [])
              .sort((a, b) => a.numeroAsignado - b.numeroAsignado)
              .map((participante) => {
                const pagos = participante.pagos || {};
                const pagoRondaActual = pagos[rondaActual];
                const pagadoRondaActual = pagoRondaActual && pagoRondaActual.pagado;
                const esProximo = participante.numeroAsignado === rondaActual;
                
                // Determinar tipo de pago
                const esExento = pagoRondaActual?.exentoPago || false;
                const esParcial = pagoRondaActual?.monto && 
                                 pagoRondaActual.monto < tandaData.montoPorRonda && 
                                 !esExento;
                
                return (
                  <div
                    key={participante.participanteId}
                    className={`p-3 md:p-4 rounded-2xl border-2 transition-all ${
                      esProximo
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 bg-gray-50 hover:shadow-md'
                    }`}
                  >
                    {/* Layout Mobile Optimizado */}
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      {/* Fila 1: Badge + Nombre */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-bold text-lg md:text-xl shadow-sm flex-shrink-0 ${
                          esProximo
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {participante.numeroAsignado}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm md:text-base text-gray-800 truncate">
                            {participante.nombre}
                          </div>
                          {esProximo && (
                            <span className="text-xs md:text-sm text-green-600 font-semibold">
                              ← Turno actual
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Fila 2: Badge de Estado (separado en mobile) */}
                      <div className="flex justify-end md:justify-start flex-shrink-0">
                        {pagadoRondaActual ? (
                          esExento ? (
                            // Pago Exento
                            <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border-2 border-purple-300 rounded-full text-[10px] md:text-xs font-bold">
                              <CheckCircle className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                              <span className="whitespace-nowrap">Exento</span>
                              <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-purple-600 text-white text-[7px] md:text-[8px] flex items-center justify-center font-bold flex-shrink-0">
                                E
                              </span>
                            </span>
                          ) : esParcial ? (
                            // Pago Parcial
                            <span className="inline-flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border-2 border-orange-300 rounded-full text-[10px] md:text-xs font-bold">
                              <CheckCircle className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                              <span className="whitespace-nowrap">Parcial</span>
                              <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-orange-600 text-white text-[7px] md:text-[8px] flex items-center justify-center font-bold flex-shrink-0">
                                P
                              </span>
                            </span>
                          ) : (
                            // Pago Normal
                            <span className="inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-2 border-green-300 rounded-full text-[10px] md:text-xs font-bold">
                              <CheckCircle className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                              <span className="whitespace-nowrap">Pagado</span>
                            </span>
                          )
                        ) : (
                          // Pendiente
                          <span className="inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border-2 border-yellow-300 rounded-full text-[10px] md:text-xs font-bold">
                            <AlertCircle className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
                            <span className="whitespace-nowrap">Pendiente</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Leyenda */}
        <div className="bg-white rounded-3xl shadow-xl p-4 md:p-8 mt-6">
          <h3 className="text-base md:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            Leyenda de Estados
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-2 border-green-300 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0">
                <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                Pagado
              </span>
              <span className="text-xs text-gray-600">Pago completo</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border-2 border-purple-300 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0">
                <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                Exento
                <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-purple-600 text-white text-[7px] md:text-[8px] flex items-center justify-center">E</span>
              </span>
              <span className="text-xs text-gray-600">No paga (recibe)</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border-2 border-orange-300 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0">
                <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                Parcial
                <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-orange-600 text-white text-[7px] md:text-[8px] flex items-center justify-center">P</span>
              </span>
              <span className="text-xs text-gray-600">Pago incompleto</span>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <span className="inline-flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border-2 border-yellow-300 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0">
                <AlertCircle className="w-3 h-3 md:w-4 md:h-4" />
                Pendiente
              </span>
              <span className="text-xs text-gray-600">Aún no pagó</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs md:text-sm text-gray-500">
          <p>Powered by TandasMX</p>
          <p className="mt-1">Actualizado en tiempo real</p>
        </div>
      </div>
    </div>
  );
}
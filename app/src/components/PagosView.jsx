import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock, Filter, RefreshCw, X, Save, DollarSign, Calendar, FileText, AlertCircle, ChevronDown, ChevronUp, Star, Award, TrendingUp, ChevronRight } from 'lucide-react';

const LEVEL_STYLES = {
  nuevo:     { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-300',   bar: 'bg-gray-400',    emoji: '🥉', label: 'Nuevo'     },
  confiable: { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-300',   bar: 'bg-blue-500',    emoji: '🥈', label: 'Confiable' },
  destacado: { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-300',  bar: 'bg-amber-500',   emoji: '🥇', label: 'Destacado' },
  elite:     { bg: 'bg-purple-50',  text: 'text-purple-700', border: 'border-purple-300', bar: 'bg-purple-500',  emoji: '💎', label: 'Elite'     },
};
import { calcularRondaActual, calcularEstadoPorParticipante, calcularFechaRonda, DIAS_VENTANA_CUMPLE } from '../utils/tandaCalculos';
import { apiFetch } from '../utils/apiFetch';

export default function PagosView({ tandaData, setTandaData, loadAdminData }) {
  const [matrizPagos, setMatrizPagos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [showEditModal, setShowEditModal] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  const [clickTimeout, setClickTimeout] = useState(null);
  const [showInstrucciones, setShowInstrucciones] = useState(false);
  const [showScores, setShowScores] = useState(() => localStorage.getItem('pagos_show_scores') === 'true');
  const [scoresData, setScoresData] = useState({});
  const [loadingScores, setLoadingScores] = useState(false);
  const [scoreModal, setScoreModal] = useState(null);
  const [editFormData, setEditFormData] = useState({
    fechaPago: '',
    metodoPago: 'Transferencia',
    notas: '',
    monto: 0,
    exentoPago: false
  });

  // Helper para URL de pagos
  const pagosUrl = `/tandas/${tandaData?.tandaId}/pagos`;

  // ====================================
  // WEBHOOK DE PAGOS (score)
  // ====================================

  // Días de gracia para clasificar pagos — debe coincidir con el backend
  const WEBHOOK_DIAS_LIMITE = 5;

  const clasificarTipoPago = (fechaPagoISO, ronda) => {
    if (!tandaData?.fechaInicio) return 'PAYMENT_ON_TIME';

    const fechaPago = new Date(fechaPagoISO);
    fechaPago.setHours(0, 0, 0, 0);

    const fechaBase = new Date(tandaData.fechaInicio + 'T00:00:00');
    const fechaRonda = calcularFechaRonda(fechaBase, ronda, tandaData.frecuencia);
    fechaRonda.setHours(0, 0, 0, 0);

    const fechaLimite = new Date(fechaRonda);
    fechaLimite.setDate(fechaLimite.getDate() + WEBHOOK_DIAS_LIMITE);

    if (fechaPago < fechaRonda) return 'PAYMENT_EARLY';
    if (fechaPago <= fechaLimite) return 'PAYMENT_ON_TIME';
    return 'PAYMENT_LATE';
  };

  const enviarEventoPago = (eventType, participanteId, ronda, fechaPagoISO = '') => {
    const userId = tandaData?.adminId;
    if (!userId || !tandaData?.tandaId) return;

    let fechaRondaISO = '';
    if (tandaData?.fechaInicio) {
      const fechaBase = new Date(tandaData.fechaInicio + 'T00:00:00');
      const fechaRonda = calcularFechaRonda(fechaBase, ronda, tandaData.frecuencia);
      fechaRondaISO = fechaRonda.toISOString().split('T')[0];
    }

    const fechaPagoStr = fechaPagoISO ? fechaPagoISO.split('T')[0] : '';

    apiFetch('/webhooks/pagos', {
      method: 'POST',
      body: JSON.stringify({
        userId,
        actorType: 'participante',
        participanteId,
        eventType,
        tandaId: tandaData.tandaId,
        metadata: {
          roundNumber: ronda,
          fechaRonda: fechaRondaISO,
          fechaPago:  fechaPagoStr,
        },
      }),
    }).catch(err => console.warn('Webhook score pago:', err));
  };

  // ====================================
  // CARGAR MATRIZ DE PAGOS
  // ====================================
  
  const cargarMatrizPagos = useCallback(async () => {
    if (!tandaData?.tandaId) { setMatrizPagos(null); return; }

    setLoading(true);
    try {
      const data = await apiFetch(`${pagosUrl}/matriz`);

      if (data.success) {
        const matrizApi = data.data?.matriz || [];
        const pagosArray = [];
        
        matrizApi.forEach(participante => {
          const participanteId = participante.participanteId;
          const pagos = participante.pagos || {};
          
          Object.keys(pagos).forEach(ronda => {
            const pagoData = pagos[ronda];
            const tieneInfoRelevante = pagoData && (
              pagoData.pagado || pagoData.notas || pagoData.exentoPago ||
              pagoData.monto || pagoData.fechaPago || pagoData.metodoPago
            );
            
            if (tieneInfoRelevante) {
              pagosArray.push({
                participanteId,
                ronda: parseInt(ronda),
                pagado: pagoData.pagado || false,
                fechaPago: pagoData.fechaPago,
                metodoPago: pagoData.metodoPago || 'Transferencia',
                notas: pagoData.notas || '',
                monto: pagoData.monto || tandaData.montoPorRonda,
                exentoPago: pagoData.exentoPago || false
              });
            }
          });
        });
        
        setMatrizPagos(pagosArray);
      }
    } catch (error) {
      console.error('Error cargando matriz:', error);
      setError('Error al cargar matriz de pagos');
    } finally {
      setLoading(false);
    }
  }, [tandaData]);

  useEffect(() => {
    if (tandaData?.tandaId) cargarMatrizPagos();
  }, [tandaData?.tandaId, cargarMatrizPagos]);

  // ====================================
  // SCORES DE PARTICIPANTES
  // ====================================

  const cargarScores = useCallback(async () => {
    if (!tandaData?.tandaId) return;
    setLoadingScores(true);
    try {
      const data = await apiFetch(`/tandas/${tandaData.tandaId}/scores`);
      if (data.participantes) {
        const map = {};
        data.participantes.forEach(p => { map[p.participanteId] = p; });
        setScoresData(map);
      }
    } catch (err) {
      console.warn('Error cargando scores:', err);
    } finally {
      setLoadingScores(false);
    }
  }, [tandaData?.tandaId]);

  const toggleScores = () => {
    const nuevo = !showScores;
    setShowScores(nuevo);
    localStorage.setItem('pagos_show_scores', String(nuevo));
  };

  useEffect(() => {
    if (showScores && tandaData?.tandaId && tandaData?.frecuencia !== 'cumpleaños') cargarScores();
  }, [showScores, tandaData?.tandaId, tandaData?.frecuencia, cargarScores]);

  // ====================================
  // VALIDACIONES Y GESTIÓN DE PAGOS
  // ====================================
  
  const puedePagarRonda = (participanteId, ronda) => {
    if (!matrizPagos || !Array.isArray(matrizPagos) || ronda === 1) return true;
    for (let r = 1; r < ronda; r++) {
      if (!matrizPagos.some(p => p.participanteId === participanteId && p.ronda === r && p.pagado)) return false;
    }
    return true;
  };

  const handleCellClick = (participanteId, ronda, estaPagado) => {
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      setClickTimeout(null);
      if (estaPagado) abrirModalEdicion(participanteId, ronda);
    } else {
      const timeout = setTimeout(() => {
        setClickTimeout(null);
        togglePago(participanteId, ronda);
      }, 250);
      setClickTimeout(timeout);
    }
  };

  const abrirModalEdicion = (participanteId, ronda) => {
    const pago = matrizPagos?.find(p => p.participanteId === participanteId && p.ronda === ronda);
    if (!pago) return;
    
    const participante = tandaData.participantes.find(p => p.participanteId === participanteId);
    setPagoSeleccionado({ participanteId, ronda, participante });
    setEditFormData({
      fechaPago: pago.fechaPago ? new Date(pago.fechaPago).toISOString().split('T')[0] : '',
      metodoPago: pago.metodoPago || 'Transferencia',
      notas: pago.notas || '',
      monto: pago.monto || tandaData.montoPorRonda,
      exentoPago: pago.exentoPago || false
    });
    setShowEditModal(true);
  };

  const registrarPago = async (bodyData) => {
    return await apiFetch(pagosUrl, {
      method: 'POST',
      body: JSON.stringify(bodyData)
    });
  };

  const guardarEdicionPago = async () => {
    if (!pagoSeleccionado) return;
    setLoading(true);
    setError(null);

    try {
      const data = await registrarPago({
        participanteId: pagoSeleccionado.participanteId,
        ronda: pagoSeleccionado.ronda,
        pagado: true,
        monto: parseFloat(editFormData.monto),
        fechaPago: editFormData.fechaPago ? new Date(editFormData.fechaPago).toISOString() : new Date().toISOString(),
        metodoPago: editFormData.metodoPago,
        notas: editFormData.notas,
        exentoPago: editFormData.exentoPago
      });

      if (data.success) {
        setMatrizPagos(prev => {
          if (!Array.isArray(prev)) return prev;
          return prev.map(p => {
            if (p.participanteId === pagoSeleccionado.participanteId && p.ronda === pagoSeleccionado.ronda) {
              return {
                ...p,
                fechaPago: editFormData.fechaPago ? new Date(editFormData.fechaPago).toISOString() : p.fechaPago,
                metodoPago: editFormData.metodoPago,
                notas: editFormData.notas,
                monto: parseFloat(editFormData.monto),
                exentoPago: editFormData.exentoPago
              };
            }
            return p;
          });
        });
        setShowEditModal(false);
        setPagoSeleccionado(null);
      }
    } catch (error) {
      console.error('Error actualizando pago:', error);
      setError(error.message || 'Error al actualizar pago');
    } finally {
      setLoading(false);
    }
  };

  const togglePago = async (participanteId, ronda) => {
    if (!tandaData?.tandaId) {
      setError('No se puede registrar el pago. Tanda no seleccionada.');
      return;
    }

    const pagoActual = Array.isArray(matrizPagos)
      ? matrizPagos.find(p => p.participanteId === participanteId && p.ronda === ronda)
      : null;

    const estaPagadoAhora = pagoActual?.pagado || false;

    if (!estaPagadoAhora && !puedePagarRonda(participanteId, ronda)) {
      setError(`Debe pagar las rondas anteriores primero. No se puede pagar la ronda ${ronda} sin haber pagado las anteriores.`);
      setTimeout(() => setError(null), 4000);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let bodyData;
      
      if (estaPagadoAhora) {
        const tieneInfoAdicional = pagoActual && (
          pagoActual.notas || pagoActual.exentoPago ||
          pagoActual.monto !== tandaData.montoPorRonda ||
          pagoActual.metodoPago !== (tandaData.metodoPago || 'Transferencia')
        );

        bodyData = tieneInfoAdicional ? {
          participanteId, ronda, pagado: false,
          monto: pagoActual.monto, fechaPago: pagoActual.fechaPago,
          metodoPago: pagoActual.metodoPago, notas: pagoActual.notas,
          exentoPago: pagoActual.exentoPago
        } : {
          participanteId, ronda, pagado: false,
          monto: tandaData.montoPorRonda, fechaPago: new Date().toISOString(),
          metodoPago: tandaData.metodoPago || 'Transferencia', notas: '', exentoPago: false
        };
      } else {
        bodyData = {
          participanteId, ronda, pagado: true,
          monto: tandaData.montoPorRonda, fechaPago: new Date().toISOString(),
          metodoPago: tandaData.metodoPago || 'Transferencia', notas: '', exentoPago: false
        };
      }

      const data = await registrarPago(bodyData);

      if (data.success) {
        // Enviar evento de score al webhook (fire-and-forget, no bloquea la UI)
        if (estaPagadoAhora) {
          // Desmarcando: cancelar el pago anterior (solo si no era exento)
          if (!pagoActual?.exentoPago) {
            enviarEventoPago('PAYMENT_CANCEL', participanteId, ronda, pagoActual?.fechaPago || '');
          }
        } else if (!bodyData.exentoPago) {
          // Marcando como pagado: clasificar según fecha de pago vs fecha de ronda
          const tipoPago = clasificarTipoPago(bodyData.fechaPago, ronda);
          enviarEventoPago(tipoPago, participanteId, ronda, bodyData.fechaPago);
        }

        setMatrizPagos(prev => {
          if (!Array.isArray(prev)) prev = [];

          if (estaPagadoAhora) {
            return prev.map(p => {
              if (p.participanteId === participanteId && p.ronda === ronda) {
                return { ...p, pagado: false };
              }
              return p;
            });
          } else {
            const existeRegistro = prev.find(p => p.participanteId === participanteId && p.ronda === ronda);
            
            if (existeRegistro) {
              return prev.map(p => {
                if (p.participanteId === participanteId && p.ronda === ronda) {
                  return {
                    ...p, pagado: true,
                    fechaPago: p.fechaPago || new Date().toISOString(),
                    metodoPago: p.metodoPago || tandaData.metodoPago || 'Transferencia',
                    monto: p.monto || tandaData.montoPorRonda,
                  };
                }
                return p;
              });
            } else {
              return [...prev, { 
                participanteId, ronda, pagado: true,
                fechaPago: new Date().toISOString(),
                metodoPago: tandaData.metodoPago || 'Transferencia',
                notas: '', monto: tandaData.montoPorRonda, exentoPago: false
              }];
            }
          }
        });
      }
    } catch (error) {
      console.error('Error registrando pago:', error);
      setError(error.message || 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  // ====================================
  // RENDER
  // ====================================
  
  if (!tandaData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block p-6 bg-gradient-to-br from-blue-100 to-sky-100 rounded-3xl mb-6">
            <CreditCard className="w-20 h-20 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Selecciona una Tanda</h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Para ver y gestionar los pagos, primero selecciona una tanda desde la vista de Inicio
          </p>
        </div>
      </div>
    );
  }

  const esCumpleañera = tandaData.frecuencia === 'cumpleaños';
  const participantes = tandaData.participantes || [];
  const rondas = Array.from({ length: tandaData.totalRondas }, (_, i) => i + 1);
  const rondaActual = calcularRondaActual(tandaData);


  const participantesFiltrados = participantes.filter(p => {
    if (filtroEstado === 'todos') return true;
    const { estado } = calcularEstadoPorParticipante(matrizPagos, tandaData, p.participanteId);
    return estado === filtroEstado;
  });

  const countAlCorriente = participantes.filter(p =>
    calcularEstadoPorParticipante(matrizPagos, tandaData, p.participanteId).estado === 'al_corriente'
  ).length;
  const countAtrasado = participantes.filter(p =>
    calcularEstadoPorParticipante(matrizPagos, tandaData, p.participanteId).estado === 'atrasado'
  ).length;

  const estaPagado = (participanteId, ronda) => {
    if (!matrizPagos || !Array.isArray(matrizPagos)) return false;
    return matrizPagos.some(p => p.participanteId === participanteId && p.ronda === ronda && p.pagado);
  };

  return (
    <div className="space-y-4">
      {/* Header con filtros integrados */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
        {/* Fila 1: Título + Refresh */}
        <div className="flex items-center gap-3 mb-3">
          <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-800 truncate">Control de Pagos</h2>
            <p className="text-xs text-gray-500 truncate">
              {tandaData.nombre} • Ronda <span className="font-semibold text-green-600">{rondaActual}</span> de {tandaData.totalRondas}
            </p>
          </div>
          <button
            onClick={cargarMatrizPagos}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Actualizar pagos"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Fila 2: Filtros como chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-0.5">
          {[
            { key: 'todos',       label: 'Todos',      count: participantes.length, active: 'bg-gradient-to-r from-blue-600 to-blue-800 text-white' },
            { key: 'al_corriente',label: 'Al corriente',count: countAlCorriente,    active: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' },
            { key: 'atrasado',    label: 'Atrasados',  count: countAtrasado,        active: 'bg-gradient-to-r from-red-500 to-red-600 text-white' }
          ].map(filtro => (
            <button
              key={filtro.key}
              onClick={() => setFiltroEstado(filtro.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                filtroEstado === filtro.key
                  ? filtro.active + ' shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{filtro.label}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                filtroEstado === filtro.key ? 'bg-white/25 text-white' : 'bg-white text-gray-500'
              }`}>{filtro.count}</span>
            </button>
          ))}

          {/* Instrucciones colapsables — chip al final */}
          <button
            onClick={() => setShowInstrucciones(v => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ml-auto ${
              showInstrucciones ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {showInstrucciones ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Instrucciones
          </button>
        </div>

        {/* Fila 3: Botón de puntajes — solo tandas normales */}
        {!esCumpleañera && <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            onClick={toggleScores}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
              showScores
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-sm shadow-amber-200'
                : 'bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100'
            }`}
            title={showScores ? 'Ocultar puntajes de confianza' : 'Ver puntaje de confianza de cada participante'}
          >
            <Award className={`w-3.5 h-3.5 ${loadingScores ? 'animate-pulse' : ''}`} />
            {showScores ? 'Ocultar puntajes' : '✨ Ver puntajes de confianza'}
          </button>
        </div>}

        {/* Panel de instrucciones colapsable */}
        {showInstrucciones && (
          <div className="mt-3 pt-3 border-t border-blue-100 text-sm text-blue-800 animate-fadeIn">
            <ul className="space-y-1 list-disc list-inside text-xs">
              <li><strong>1 click:</strong> Marcar/desmarcar pago</li>
              <li><strong>Doble click:</strong> Editar detalles del pago (solo pagos marcados)</li>
              <li><strong>Pagos secuenciales:</strong> Debes pagar las rondas en orden (1, 2, 3...)</li>
              <li><strong>🔒 Datos protegidos:</strong> Si un pago tiene notas, monto u otras personalizaciones, se conservan aunque lo desmarques</li>
              <li><strong>⭐ Turno actual:</strong> El participante marcado con estrella es quien recibe en la ronda actual</li>
            </ul>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 font-semibold text-sm">{error}</p>
        </div>
      )}

      {/* Matriz de Pagos */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-sky-50 border-b-2 border-blue-200">
              <tr>
                <th className="px-3 md:px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase sticky left-0 bg-gradient-to-r from-blue-50 to-sky-50 z-10 w-[50%] md:w-auto">
                  Participante
                </th>
                {rondas.map(ronda => (
                  <th
                    key={ronda}
                    className={`px-2 md:px-4 py-3 text-center text-xs font-bold uppercase ${
                      ronda === rondaActual ? 'bg-green-100 text-green-700 border-2 border-green-300' : 'text-gray-600'
                    }`}
                  >
                    <span className="hidden md:inline">R{ronda}</span>
                    <span className="md:hidden">{ronda}</span>
                  </th>
                ))}
                <th className="hidden md:table-cell px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {participantesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={rondas.length + 2} className="px-6 py-12 text-center text-gray-500">
                    No hay participantes con este filtro
                  </td>
                </tr>
              ) : (
                participantesFiltrados
                  .sort((a, b) => a.numeroAsignado - b.numeroAsignado)
                  .map((participante) => {
                    const { estado } = calcularEstadoPorParticipante(matrizPagos, tandaData, participante.participanteId);
                    
                    return (
                      <tr key={participante.participanteId} className={`hover:bg-gray-50 ${participante.numeroAsignado === rondaActual ? 'bg-green-50/60' : ''}`}>
                        <td className={`px-3 md:px-4 py-3 sticky left-0 z-10 w-[50%] md:w-auto ${participante.numeroAsignado === rondaActual ? 'bg-green-50' : 'bg-white'}`}>
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center font-bold text-sm md:text-base shadow-md flex-shrink-0 ${
                              participante.numeroAsignado === rondaActual
                                ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                                : 'bg-gradient-to-br from-blue-600 to-blue-800 text-white'
                            }`}>
                              {participante.numeroAsignado}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-gray-800 text-xs md:text-sm truncate">{participante.nombre}</span>
                                {participante.numeroAsignado === rondaActual && (
                                  <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                                    <Star className="w-2.5 h-2.5 fill-green-600 text-green-600" />
                                    <span className="hidden sm:inline">Turno</span>
                                  </span>
                                )}
                                {esCumpleañera && participante.fechaCumpleaños && (() => {
                                  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
                                  const base = new Date(participante.fechaCumpleaños + 'T00:00:00');
                                  const cumpleAno = new Date(hoy.getFullYear(), base.getMonth(), base.getDate());
                                  const diasDesde = Math.round((hoy - cumpleAno) / 86400000);
                                  return diasDesde >= 0 && diasDesde <= DIAS_VENTANA_CUMPLE;
                                })() && (
                                  <span className="flex-shrink-0 text-[10px] font-bold text-pink-700 bg-pink-100 px-1.5 py-0.5 rounded-full">
                                    🎂
                                  </span>
                                )}
                              </div>
                              {showScores && !esCumpleañera && (() => {
                                const sc = scoresData[participante.participanteId];
                                const level = sc?.scoreLevel || 'nuevo';
                                const style = LEVEL_STYLES[level] || LEVEL_STYLES.nuevo;
                                return (
                                  <button
                                    onClick={e => { e.stopPropagation(); setScoreModal({ participante, score: sc }); }}
                                    className={`mt-0.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold transition-all hover:opacity-80 ${style.bg} ${style.text} ${style.border}`}
                                    title="Ver puntaje de confianza"
                                  >
                                    <span>{style.emoji}</span>
                                    <span>{sc ? sc.scoreGlobal : '—'}</span>
                                    <span className="hidden sm:inline">· {style.label}</span>
                                    <ChevronRight className="w-2.5 h-2.5 opacity-60" />
                                  </button>
                                );
                              })()}
                              <div className="text-[10px] md:text-xs text-gray-500 truncate hidden md:block">{participante.telefono}</div>
                            </div>
                          </div>
                        </td>
                        {rondas.map(ronda => {
                          const pagado = estaPagado(participante.participanteId, ronda);
                          const esRondaActual = ronda === rondaActual;
                          const esPasado = ronda < rondaActual;
                          const puedePagar = puedePagarRonda(participante.participanteId, ronda);
                          const pago = matrizPagos?.find(p => p.participanteId === participante.participanteId && p.ronda === ronda);
                          
                          return (
                            <td key={ronda} className={`px-1 md:px-2 py-2 md:py-3 text-center ${esRondaActual ? 'bg-green-50' : ''}`}>
                              <button
                                onClick={() => handleCellClick(participante.participanteId, ronda, pagado)}
                                disabled={loading || (!pagado && !puedePagar)}
                                className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center transition-all relative group ${
                                  pagado
                                    ? pago?.exentoPago
                                      ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md'
                                      : pago?.monto < tandaData.montoPorRonda
                                      ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md'
                                      : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md'
                                    : !puedePagar
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : esPasado
                                    ? 'bg-red-100 hover:bg-red-200 text-red-600 border-2 border-red-300'
                                    : 'bg-blue-100 hover:bg-blue-200 text-blue-600 border-2 border-blue-300'
                                } disabled:opacity-50`}
                                title={
                                  !puedePagar && !pagado ? 'Debe pagar las rondas anteriores primero'
                                    : pagado ? `Pagado ${pago?.exentoPago ? '(Exento de pago)' : ''} - Doble click para editar`
                                    : esPasado ? 'Pendiente (atrasado)' : 'Click para marcar como pagado'
                                }
                              >
                                {pagado ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                                    {pago?.exentoPago && (
                                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 md:w-3 md:h-3 bg-purple-700 rounded-full text-white text-[7px] md:text-[8px] flex items-center justify-center font-bold">E</span>
                                    )}
                                    {pago?.monto < tandaData.montoPorRonda && !pago?.exentoPago && (
                                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 md:w-3 md:h-3 bg-orange-700 rounded-full text-white text-[7px] md:text-[8px] flex items-center justify-center font-bold">P</span>
                                    )}
                                  </>
                                ) : (
                                  <XCircle className="w-4 h-4 md:w-5 md:h-5" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                        <td className="hidden md:table-cell px-4 py-3 text-center">
                          <span className={`px-3 py-1 bg-gradient-to-r ${
                            estado === 'al_corriente' 
                              ? 'from-green-50 to-emerald-50 text-green-700 border-green-200' 
                              : 'from-red-50 to-rose-50 text-red-700 border-red-200'
                          } border-2 rounded-full text-xs font-bold inline-flex items-center gap-1`}>
                            {estado === 'al_corriente' ? <><CheckCircle className="w-3 h-3" />Al día</> : <><XCircle className="w-3 h-3" />Atrasado</>}
                          </span>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edición */}
      {showEditModal && pagoSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-8 h-8" />
                  <div>
                    <h3 className="text-xl font-bold">Editar Pago</h3>
                    <p className="text-sm opacity-90">{pagoSeleccionado.participante?.nombre} - Ronda {pagoSeleccionado.ronda}</p>
                  </div>
                </div>
                <button onClick={() => { setShowEditModal(false); setPagoSeleccionado(null); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />Fecha de Pago
                </label>
                <input type="date" value={editFormData.fechaPago}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, fechaPago: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />Método de Pago
                </label>
                <select value={editFormData.metodoPago}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, metodoPago: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all">
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />Monto
                </label>
                <input type="number" value={editFormData.monto}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, monto: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  min="0" step="0.01" />
                <p className="text-xs text-gray-500 mt-1">Monto completo: ${tandaData.montoPorRonda?.toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />Notas
                </label>
                <textarea value={editFormData.notas}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notas: e.target.value }))}
                  rows={3} className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all resize-none"
                  placeholder="Observaciones adicionales..." maxLength={200} />
                <p className="text-xs text-gray-500 mt-1">{editFormData.notas.length}/200 caracteres</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={editFormData.exentoPago}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, exentoPago: e.target.checked }))}
                    className="mt-1 w-5 h-5 rounded border-2 border-purple-300 text-purple-600 focus:ring-2 focus:ring-purple-500" />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-800 block mb-1">Exento de Pago</span>
                    <span className="text-xs text-gray-600">Marcar cuando este participante NO pagó en su turno porque es quien recibe.</span>
                  </div>
                </label>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t-2 border-gray-200 rounded-b-2xl flex-shrink-0">
              <div className="flex gap-3">
                <button onClick={() => { setShowEditModal(false); setPagoSeleccionado(null); }}
                  className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button onClick={guardarEdicionPago} disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Guardando...</>
                  ) : (
                    <><Save className="w-5 h-5" />Guardar</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Score de Confianza */}
      {scoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[9999] animate-fadeIn"
          onClick={() => setScoreModal(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            {(() => {
              const sc = scoreModal.score;
              const level = sc?.scoreLevel || 'nuevo';
              const style = LEVEL_STYLES[level] || LEVEL_STYLES.nuevo;
              const score = sc?.scoreGlobal ?? 20;
              const nextLevel = sc?.nextLevel;
              const levelInfo = sc?.levelInfo || { minScore: 0, maxScore: 30 };
              const progress = Math.min(100, Math.round(
                ((score - levelInfo.minScore) / Math.max(1, levelInfo.maxScore - levelInfo.minScore)) * 100
              ));

              return (
                <>
                  <div className={`p-5 rounded-t-3xl sm:rounded-t-2xl ${style.bg} border-b ${style.border}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Award className={`w-5 h-5 ${style.text}`} />
                        <span className={`text-sm font-bold ${style.text}`}>Puntaje de Confianza</span>
                      </div>
                      <button onClick={() => setScoreModal(null)}
                        className="p-1.5 hover:bg-black/10 rounded-lg transition-colors">
                        <X className={`w-4 h-4 ${style.text}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl font-black border-2 ${style.border} bg-white shadow-sm`}>
                        {style.emoji}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-base">{scoreModal.participante.nombre}</p>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-3xl font-black ${style.text}`}>{score}</span>
                          <span className="text-sm text-gray-500 font-semibold">pts</span>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                          {style.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Barra de progreso dentro del nivel */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                        <span className="font-semibold">Progreso en nivel {style.label}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${style.bar}`}
                          style={{ width: `${progress}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                        <span>{levelInfo.minScore} pts</span>
                        <span>{levelInfo.maxScore} pts</span>
                      </div>
                    </div>

                    {/* Siguiente nivel */}
                    {nextLevel ? (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <TrendingUp className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700">
                            Siguiente nivel: <span className="font-black">{LEVEL_STYLES[nextLevel.level]?.label || nextLevel.level}</span>
                          </p>
                          <p className="text-xs text-gray-500">{nextLevel.pointsLeft} pts para llegar</p>
                        </div>
                        <span className="text-xl">{LEVEL_STYLES[nextLevel.level]?.emoji}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                        <span className="text-xl">💎</span>
                        <p className="text-xs font-bold text-purple-700">¡Nivel máximo alcanzado!</p>
                      </div>
                    )}

                    {/* Cómo se gana el puntaje */}
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-xs font-bold text-blue-800 mb-1.5">¿Cómo se calcula?</p>
                      <div className="space-y-1 text-[11px] text-blue-700">
                        <div className="flex justify-between"><span>✅ Pago anticipado</span><span className="font-bold">+2 pts</span></div>
                        <div className="flex justify-between"><span>✅ Pago a tiempo</span><span className="font-bold">+1 pt</span></div>
                        <div className="flex justify-between"><span>⏰ Pago tardío</span><span className="font-bold text-amber-700">-1 pt</span></div>
                        <div className="flex justify-between"><span>❌ Pago omitido</span><span className="font-bold text-red-700">-3 pts</span></div>
                      </div>
                    </div>

                    <button onClick={() => setScoreModal(null)}
                      className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all text-sm">
                      Cerrar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          Leyenda
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: CheckCircle, gradient: 'from-green-500 to-emerald-600', label: 'Pagado', desc: 'Doble click para editar' },
            { icon: CheckCircle, gradient: 'from-purple-500 to-indigo-600', label: 'Exento de Pago', desc: 'Es quien recibe en esa ronda', badge: 'E' },
            { icon: CheckCircle, gradient: 'from-orange-500 to-amber-600', label: 'Pago Parcial', desc: 'Monto menor al total', badge: 'P' },
            { icon: XCircle, bg: 'bg-red-100 border-2 border-red-300', color: 'text-red-600', label: 'Atrasado', desc: 'Rondas pasadas sin pagar' },
            { icon: XCircle, bg: 'bg-blue-100 border-2 border-blue-300', color: 'text-blue-600', label: 'Ronda Actual', desc: 'Click para marcar pagado' },
            { icon: XCircle, bg: 'bg-gray-200', color: 'text-gray-400', label: 'Bloqueado', desc: 'Pagar rondas anteriores' }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shadow-sm relative flex-shrink-0 ${
                item.gradient ? `bg-gradient-to-br ${item.gradient}` : item.bg
              }`}>
                <item.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${item.gradient ? 'text-white' : item.color}`} />
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-purple-700 rounded-full text-white text-[7px] flex items-center justify-center font-bold">{item.badge}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-gray-800 text-sm">{item.label}</div>
                <div className="text-xs text-gray-500 truncate">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
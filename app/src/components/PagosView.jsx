import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, CheckCircle, XCircle, Clock, Filter, RefreshCw, X, Save, DollarSign, Calendar, FileText, AlertCircle } from 'lucide-react';
import { calcularRondaActual, calcularEstadoPorParticipante } from '../utils/tandaCalculos';
import { apiFetch } from '../utils/apiFetch';

export default function PagosView({ tandaData, setTandaData, loadAdminData }) {
  const [matrizPagos, setMatrizPagos] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [showEditModal, setShowEditModal] = useState(false);
  const [pagoSeleccionado, setPagoSeleccionado] = useState(null);
  const [clickTimeout, setClickTimeout] = useState(null);
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

  const participantes = tandaData.participantes || [];
  const rondas = Array.from({ length: tandaData.totalRondas }, (_, i) => i + 1);
  const rondaActual = calcularRondaActual(tandaData);

  const participantesFiltrados = participantes.filter(p => {
    if (filtroEstado === 'todos') return true;
    const { estado } = calcularEstadoPorParticipante(matrizPagos, tandaData, p.participanteId);
    return estado === filtroEstado;
  });

  const estaPagado = (participanteId, ronda) => {
    if (!matrizPagos || !Array.isArray(matrizPagos)) return false;
    return matrizPagos.some(p => p.participanteId === participanteId && p.ronda === ronda && p.pagado);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <CreditCard className="w-7 h-7 text-blue-600" />
              Control de Pagos
            </h2>
            <p className="text-gray-600 mt-1">
              {tandaData.nombre} • Ronda {rondaActual} de {tandaData.totalRondas}
            </p>
          </div>
          <button
            onClick={cargarMatrizPagos}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-600 font-semibold text-sm">{error}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-700">Filtrar:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'todos', label: `Todos (${participantes.length})`, gradient: 'from-blue-600 to-blue-800', shadow: 'blue' },
              { key: 'al_corriente', label: 'Al Corriente', gradient: 'from-green-500 to-emerald-600', shadow: 'green' },
              { key: 'atrasado', label: 'Atrasados', gradient: 'from-red-500 to-red-600', shadow: 'red' }
            ].map(filtro => (
              <button
                key={filtro.key}
                onClick={() => setFiltroEstado(filtro.key)}
                className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                  filtroEstado === filtro.key
                    ? `bg-gradient-to-r ${filtro.gradient} text-white shadow-lg shadow-${filtro.shadow}-500/30`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filtro.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <div className="bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-2">💡 Instrucciones de uso:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>1 click:</strong> Marcar/desmarcar pago</li>
              <li><strong>Doble click:</strong> Editar detalles del pago (solo pagos marcados)</li>
              <li><strong>Pagos secuenciales:</strong> Debes pagar las rondas en orden (1, 2, 3...)</li>
              <li><strong>🔒 Datos protegidos:</strong> Si un pago tiene notas, monto diferente u otras personalizaciones, estos datos se conservan aunque lo desmarques</li>
            </ul>
          </div>
        </div>
      </div>

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
                      <tr key={participante.participanteId} className="hover:bg-gray-50">
                        <td className="px-3 md:px-4 py-3 sticky left-0 bg-white z-10 w-[50%] md:w-auto">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center font-bold text-sm md:text-base shadow-md flex-shrink-0">
                              {participante.numeroAsignado}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-gray-800 text-xs md:text-sm truncate">{participante.nombre}</div>
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
      `}</style>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, Trash2, AlertTriangle, DollarSign, Calendar, Clock, X, Info, Users, Download, Share2, Gift } from 'lucide-react';
import { calcularFechasRondas, formatearFechaLarga, obtenerFechaHoyISO } from '../utils/tandaCalculos';
import {
  exportarCalendarioComoImagen,
  enviarCalendarioComoImagen
} from '../utils/tandaExport';
import { apiFetch } from '../utils/apiFetch'; // ✅ NUEVO


export default function ConfiguracionView({ tandaData, setTandaData, loadAdminData }) {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nombre: tandaData?.nombre || '',
    montoPorRonda: tandaData?.montoPorRonda || '',
    fechaInicio: tandaData?.fechaInicio || '',
    frecuencia: tandaData?.frecuencia || 'semanal',
    diasRecordatorio: tandaData?.diasRecordatorio || 1
  });

  const fechasCalendarRef = useRef(null);
  const [exportando, setExportando] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmacionTexto, setConfirmacionTexto] = useState('');

  const esCumpleañera = tandaData?.frecuencia === 'cumpleaños';

  useEffect(() => {
    if (tandaData) {
      setFormData({
        nombre: tandaData.nombre || '',
        montoPorRonda: tandaData.montoPorRonda || '',
        fechaInicio: tandaData.fechaInicio || '',
        frecuencia: tandaData.frecuencia || 'semanal',
        diasRecordatorio: tandaData.diasRecordatorio || 1
      });
    }
  }, [tandaData]);


  const exportarComoImagen = async () => {
    if (!fechasCalendarRef.current) return;

    setExportando(true);
    try {
      await exportarCalendarioComoImagen({
        elementRef: fechasCalendarRef,
        fileName: `calendario-${tandaData.nombre.replace(/\s+/g, '-')}.png`
      });

      setSuccess('✅ Imagen exportada correctamente');
    } catch (e) {
      console.error(e);
      setError('Error al exportar la imagen');
    } finally {
      setExportando(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
    }
  };

  const compartirPorWhatsApp = async () => {
    if (!fechasCalendarRef.current) return;

    setExportando(true);
    try {
      await enviarCalendarioComoImagen({
        elementRef: fechasCalendarRef,
        fileName: `calendario-${tandaData.nombre.replace(/\s+/g, '-')}.png`,
        mensaje: esCumpleañera
          ? `🎂 Calendario de Cumpleaños\n\nTanda: ${tandaData.nombre}`
          : `📅 Calendario de Pagos\n\nTanda: ${tandaData.nombre}`
      });

      setSuccess('✅ Calendario compartido');
    } catch (e) {
      console.error(e);
      setError('Error al compartir el calendario');
    } finally {
      setExportando(false);
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
    }
  };


  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!esCumpleañera) {
      const fechaSeleccionada = new Date(formData.fechaInicio);
      const fechaActual = new Date();
      fechaActual.setHours(0, 0, 0, 0);
      
      if (fechaSeleccionada < fechaActual) {
        setError('La fecha de inicio no puede ser anterior a la fecha actual');
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        nombre: formData.nombre,
        montoPorRonda: parseFloat(formData.montoPorRonda),
        diasRecordatorio: parseInt(formData.diasRecordatorio),
        totalRondas: parseInt(formData.totalRondas)
      };

      if (!esCumpleañera) {
        payload.fechaInicio = formData.fechaInicio;
        payload.frecuencia = formData.frecuencia;
      }
      
      // ✅ CAMBIO: usar apiFetch en lugar de fetch directo
      const data = await apiFetch(`/tandas/${tandaData.tandaId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (data.success) {
        setSuccess('✅ Configuración actualizada exitosamente');
        await loadAdminData();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      setError(error.message || 'Error al actualizar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarTanda = async () => {
    if (confirmacionTexto.trim() !== tandaData.nombre.trim()) {
      setError('El nombre de la tanda no coincide. Por favor, escríbelo correctamente.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ CAMBIO: usar apiFetch en lugar de fetch directo
      const data = await apiFetch(`/tandas/${tandaData.tandaId}`, {
        method: 'DELETE'
      });

      if (data.success) {
        setShowDeleteModal(false);
        setConfirmacionTexto('');
        setSuccess('✅ Tanda eliminada exitosamente');
        
        setTimeout(() => {
          setTandaData(null);
          navigate('/inicio');
          loadAdminData();
        }, 1500);
      }
    } catch (error) {
      console.error('Error eliminando tanda:', error);
      setError(error.message || 'Error al eliminar tanda');
    } finally {
      setLoading(false);
    }
  };


  if (!tandaData) return null;

  return (
    <div className="space-y-4 md:space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className={`bg-gradient-to-r ${esCumpleañera ? 'from-pink-600 to-purple-600' : 'from-blue-600 to-blue-800'} rounded-2xl md:rounded-3xl shadow-xl p-4 md:p-6 text-white`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
            {esCumpleañera ? <Gift className="w-6 h-6 md:w-7 md:h-7" /> : <Settings className="w-6 h-6 md:w-7 md:h-7" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold truncate">
              Configuración {esCumpleañera && '🎂'}
            </h2>
            <p className="text-xs md:text-sm text-blue-100 truncate">{tandaData.nombre}</p>
          </div>
        </div>
      </div>

      {/* Mensajes */}
      {success && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl md:rounded-2xl p-3 md:p-4 animate-fadeIn">
          <p className="text-green-700 font-semibold text-sm md:text-base">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-300 rounded-xl md:rounded-2xl p-3 md:p-4 animate-fadeIn">
          <p className="text-red-600 font-semibold text-sm md:text-base">{error}</p>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        {/* Información General */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className={`p-2 ${esCumpleañera ? 'bg-pink-100' : 'bg-blue-100'} rounded-lg`}>
              <Info className={`w-4 h-4 md:w-5 md:h-5 ${esCumpleañera ? 'text-pink-600' : 'text-blue-600'}`} />
            </div>
            <h3 className="text-base md:text-lg font-bold text-gray-800">Información General</h3>
          </div>
          
          {/* Nombre */}
          <div className="mb-4">
            <label htmlFor="config-nombre" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
              Nombre de la Tanda
            </label>
            <input
              id="config-nombre"
              name="nombre"
              type="text"
              value={formData.nombre}
              onChange={handleChange}
              className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              required
            />
          </div>

          {/* Monto y Fecha */}
          <div className={`grid grid-cols-1 ${esCumpleañera ? '' : 'md:grid-cols-2'} gap-4`}>
            <div>
              <label htmlFor="config-monto" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
                Monto por Ronda
              </label>
              <input
                id="config-monto"
                name="montoPorRonda"
                type="number"
                min="1"
                step="0.01"
                value={formData.montoPorRonda}
                onChange={handleChange}
                className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                required
              />
            </div>

            {!esCumpleañera && (
              <div>
                <label htmlFor="config-fecha" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                  Fecha de Inicio
                </label>
                <input
                  id="config-fecha"
                  name="fechaInicio"
                  type="date"
                  min={obtenerFechaHoyISO()}
                  value={formData.fechaInicio}
                  onChange={handleChange}
                  className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                  required
                />
                {formData.fechaInicio && (
                  <p className="mt-1 text-[10px] md:text-xs text-gray-500">
                    <strong>{formatearFechaLarga(formData.fechaInicio)}</strong>
                  </p>
                )}              
              </div>
            )}
          </div>

          {/* CALENDARIOS */}
          {esCumpleañera ? (
            /* CALENDARIO DE CUMPLEAÑOS */
            <div className="mt-4 p-3 md:p-4 bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-pink-200 rounded-xl" ref={fechasCalendarRef}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-pink-600" />
                  <div className="text-xs md:text-sm font-semibold text-pink-800">
                    Calendario de Cumpleaños 🎂
                  </div>
                </div>
                
                {/* Botones de exportar */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={exportarComoImagen}
                    disabled={exportando}
                    className="p-2 bg-white border border-pink-300 text-pink-600 rounded-lg hover:bg-pink-50 transition-all disabled:opacity-50 flex items-center gap-1 text-xs"
                    title="Descargar imagen"
                  >
                    {exportando ? (
                      <div className="w-3 h-3 border-2 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline">Descargar</span>
                  </button>
                  {/*
                  <button
                    type="button"
                    onClick={compartirPorWhatsApp}
                    disabled={exportando}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 flex items-center gap-1 text-xs"
                    title="Compartir por WhatsApp"
                  >
                    {exportando ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Share2 className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline">Compartir</span>
                  </button> 
                  */}
                </div>
              </div>

              <div className="scroll-container max-h-48 md:max-h-64 overflow-y-auto space-y-2">
                {(() => {
                  const participantes = tandaData.participantes || [];
                  
                  const participantesOrdenados = [...participantes]
                    .filter(p => p.fechaCumpleaños)
                    .sort((a, b) => {
                      const fechaA = new Date(a.fechaCumpleaños);
                      const fechaB = new Date(b.fechaCumpleaños);
                      
                      const mesA = fechaA.getMonth();
                      const diaA = fechaA.getDate();
                      const mesB = fechaB.getMonth();
                      const diaB = fechaB.getDate();

                      if (mesA !== mesB) return mesA - mesB;
                      if (diaA !== diaB) return diaA - diaB;
                      
                      return new Date(a.createdAt) - new Date(b.createdAt);
                    });

                  if (participantesOrdenados.length === 0) {
                    return (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        No hay participantes registrados aún
                      </div>
                    );
                  }

                  return participantesOrdenados.map((participante, index) => {
                    const fechaCumple = new Date(participante.fechaCumpleaños + 'T00:00:00');
                    const primerNombre = participante.nombre.split(' ').slice(0, 2).join(' ');
                    
                    return (
                      <div
                        key={participante.participanteId}
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          index % 2 === 0 ? "bg-pink-100" : "bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-purple-500 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                            {participante.numeroAsignado}
                          </div>
                          <span className="text-[10px] md:text-xs font-semibold text-pink-900">
                            {primerNombre}
                          </span>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] md:text-xs text-pink-700 font-semibold flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {fechaCumple.toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "long"
                            })}
                          </div>
                          <div className="text-[9px] md:text-[10px] text-pink-600">
                            Recibe: ${(tandaData.montoPorRonda * (tandaData.totalRondas - 1)).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="mt-3 text-[10px] md:text-xs text-pink-600 border-t border-pink-300 pt-2">
                🎁 <strong>Cada persona recibe</strong> en su cumpleaños: ${tandaData.montoPorRonda?.toLocaleString()} × {tandaData.totalRondas - 1} participantes = ${(tandaData.montoPorRonda * (tandaData.totalRondas - 1))?.toLocaleString()}
              </div>
            </div>
          ) : (
            /* CALENDARIO NORMAL DE RONDAS */
            formData.fechaInicio && formData.frecuencia && (
              <div className="mt-4 p-3 md:p-4 bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl" ref={fechasCalendarRef}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <div className="text-xs md:text-sm font-semibold text-blue-800">
                      Fechas calculadas
                    </div>
                  </div>
                  
                  {/* Botones de exportar */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={exportarComoImagen}
                      disabled={exportando}
                      className="p-2 bg-white border border-pink-300 text-pink-600 rounded-lg hover:bg-pink-50 transition-all disabled:opacity-50 flex items-center gap-1 text-xs"
                      title="Descargar imagen"
                    >
                      {exportando ? (
                        <div className="w-3 h-3 border-2 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">Descargar</span>
                    </button>
                    {/*<button
                      type="button"
                      onClick={compartirPorWhatsApp}
                      disabled={exportando}
                      className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 flex items-center gap-1 text-xs"
                      title="Compartir por WhatsApp"
                    >
                      {exportando ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Share2 className="w-3 h-3" />
                      )}
                      <span className="hidden sm:inline">Compartir</span>
                    </button>*/}
                  </div>
                </div>

                <div className="scroll-container max-h-48 md:max-h-64 overflow-y-auto space-y-2">
                  {(() => {
                    const participantes = tandaData.participantes || [];
                    const participantesPorNumero = {};
                    participantes.forEach(p => {
                      participantesPorNumero[p.numeroAsignado] = p;
                    });

                    const fechasRondas = calcularFechasRondas(
                      formData.fechaInicio,
                      tandaData.totalRondas,
                      formData.frecuencia
                    );

                    return fechasRondas.map((ronda, index) => {
                      const participante = participantesPorNumero[ronda.numero];
                      const primerNombre = participante ? participante.nombre.split(' ')[0] : null;

                      return (
                        <div
                          key={ronda.numero}
                          className={`flex justify-between items-center p-2 rounded-lg ${
                            ronda.numero % 2 === 0 ? "bg-blue-100" : "bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {ronda.numero}
                            </div>
                            {primerNombre ? (
                              <span className="text-[10px] md:text-xs font-semibold text-blue-900">
                                {primerNombre}
                              </span>
                            ) : (
                              <span className="text-[9px] md:text-[10px] text-gray-400 italic">
                                Sin asignar
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] md:text-xs text-blue-700 font-semibold">
                              Inicio:{" "}
                              {ronda.fechaInicio.toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>

                            <div className="text-[9px] md:text-[10px] text-blue-600">
                              Fecha límite de pago:{" "}
                              {ronda.fechaLimite.toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <div className="mt-3 text-[10px] md:text-xs text-blue-600 border-t border-blue-300 pt-2">
                  💡 <strong>Fecha límite de pago</strong> = Fecha inicio de ronda + 5 días
                </div>
              </div>
            )
          )}
        </div>

        {/* Configuración de Rondas */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-gray-800">Configuración de Rondas</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="config-total-rondas" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
                Total de Rondas {esCumpleañera && <span className="text-blue-600">(Editable)</span>}
              </label>
              <input
                id="config-total-rondas"
                type={esCumpleañera ? "number" : "text"}
                name="totalRondas"
                min={esCumpleañera ? "1" : undefined}
                value={esCumpleañera ? formData.totalRondas || tandaData.totalRondas : tandaData.totalRondas}
                onChange={esCumpleañera ? handleChange : undefined}
                readOnly={!esCumpleañera}
                className={`w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 rounded-xl transition-all ${
                  esCumpleañera 
                    ? 'border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-gray-800' 
                    : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
                }`}
              />
              <p className="mt-1 text-[10px] md:text-xs text-gray-500 flex items-start gap-1">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>
                  {esCumpleañera 
                    ? 'Ajusta el total según los participantes con cumpleaños' 
                    : 'No se puede modificar después de crear la tanda'}
                </span>
              </p>
            </div>

            <div>
              <label htmlFor="config-frecuencia" className="block text-xs md:text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3 md:w-4 md:h-4" />
                Frecuencia
              </label>
              <input
                id="config-frecuencia"
                type="text"
                value={
                  formData.frecuencia === 'semanal' ? 'Semanal (cada 7 días)' : 
                  formData.frecuencia === 'quincenal' ? 'Quincenal' : 
                  formData.frecuencia === 'cumpleaños' ? 'Por Cumpleaños 🎂' :
                  'Mensual'
                }
                readOnly
                className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="mt-1 text-[10px] md:text-xs text-gray-500 flex items-start gap-1">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>No se puede modificar después de crear la tanda</span>
              </p>
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 md:px-6 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 md:w-5 md:h-5" />
              Guardar Cambios
            </>
          )}
        </button>
      </form>

      {/* Zona de Peligro */}
      <div className="bg-gradient-to-br from-red-50 to-rose-50 border-2 border-red-300 rounded-xl md:rounded-2xl p-4 md:p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-bold text-red-800 mb-2">Zona de Peligro</h3>
            <p className="text-xs md:text-sm text-red-700 mb-4">
              Las acciones en esta sección son <strong>irreversibles</strong> y eliminarán todos los datos permanentemente.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={loading}
          className="w-full md:w-auto px-4 py-2 md:py-2.5 bg-white border-2 border-red-400 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
        >
          <Trash2 className="w-4 h-4" />
          Eliminar Tanda
        </button>

        <div className="mt-4 p-3 bg-red-100 rounded-xl border border-red-200">
          <p className="text-[10px] md:text-xs text-red-800">
            <strong>⚠️ Advertencia:</strong> Al eliminar la tanda se perderán todos los datos:
            participantes, pagos, historial y configuración. Esta acción no se puede deshacer.
          </p>
        </div>
      </div>

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scaleIn">
            <div className="p-4 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-xl flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-800">Eliminar Tanda</h2>
                  <p className="text-xs md:text-sm text-gray-600">Esta acción no se puede deshacer</p>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmacionTexto('');
                    setError(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="mb-4 p-3 md:p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <p className="text-xs md:text-sm text-red-800 font-semibold mb-2">
                  ⚠️ Se eliminarán permanentemente:
                </p>
                <p className="text-xs md:text-sm text-red-700">
                  La tanda, todos los participantes, todos los pagos, todas las notificaciones y la referencia en tu cuenta.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
                  Para confirmar, escribe el nombre de la tanda:
                </label>
                <div className="mb-2 p-3 bg-gray-100 rounded-xl border border-gray-300">
                  <p className="text-sm md:text-base font-bold text-gray-800 text-center break-words">
                    {tandaData.nombre}
                  </p>
                </div>
                <input
                  type="text"
                  value={confirmacionTexto}
                  onChange={(e) => setConfirmacionTexto(e.target.value)}
                  placeholder="Escribe el nombre aquí"
                  className="w-full px-3 md:px-4 py-2 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-xl focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200 transition-all"
                  autoFocus
                />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-xl">
                  <p className="text-xs md:text-sm text-red-800">{error}</p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setConfirmacionTexto('');
                    setError(null);
                  }}
                  disabled={loading}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-all disabled:opacity-50 text-sm md:text-base"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEliminarTanda}
                  disabled={loading || confirmacionTexto.trim() !== tandaData.nombre.trim()}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                      Eliminar Permanentemente
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información */}
      <div className="bg-gradient-to-r from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl p-3 md:p-4">
        <p className="text-xs md:text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Nota:</strong> Algunos campos como el "Total de Rondas" y "Frecuencia" no se pueden modificar 
            después de crear la tanda para mantener la integridad de los datos.
          </span>
        </p>
      </div>
    </div>
  );
}

// Estilos para animaciones
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out;
    }
    .animate-scaleIn {
      animation: scaleIn 0.2s ease-out;
    }
  `;
  if (!document.querySelector('style[data-modal-animations]')) {
    style.setAttribute('data-modal-animations', 'true');
    document.head.appendChild(style);
  }
}
import React, { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Calendar, Users, Clock, Save, AlertCircle, Download, Share2, Gift, HelpCircle } from 'lucide-react';
import { calcularFechasRondas, obtenerFechaHoyISO, formatearFechaLarga } from '../utils/tandaCalculos';
import {
  exportarCalendarioComoImagen,
  enviarCalendarioComoImagen
} from '../utils/tandaExport';
import { apiFetch } from '../utils/apiFetch';

// ==================== COMPONENTE CALENDARIO RONDAS ====================
function CalendarioRondas({ fechasEjemplo, totalRondas, nombreTanda, montoPorRonda, frecuencia, diasLimitePago }) {
  const calendarioRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  const diasLimite = diasLimitePago != null && diasLimitePago !== '' ? Math.max(0, parseInt(diasLimitePago)) : 5;

  const exportarCalendario = async () => {
    if (!calendarioRef.current) return;
    setIsExporting(true);
    try {
      await exportarCalendarioComoImagen({
        elementRef: calendarioRef,
        fileName: `calendario-${nombreTanda || 'tanda'}.png`
      });
    } catch (e) {
      alert('Error al exportar calendario');
    } finally {
      setIsExporting(false);
    }
  };

  const compartirCalendario = async () => {
    if (!calendarioRef.current) return;
    setIsExporting(true);
    try {
      await enviarCalendarioComoImagen({
        elementRef: calendarioRef,
        fileName: `calendario-${nombreTanda || 'tanda'}.png`,
        mensaje: '📅 Te comparto el calendario de rondas de nuestra tanda'
      });
    } catch (e) {
      alert('No se pudo compartir el calendario');
    } finally {
      setIsExporting(false);
    }
  };

  const totalRecibir = montoPorRonda && totalRondas
    ? (parseFloat(montoPorRonda) * (totalRondas - 1)).toLocaleString()
    : null;

  return (
    <div className="rounded-xl border-2 border-blue-200 overflow-hidden">

      {/* Barra de acciones — fuera del ref, no aparece en la imagen */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4" />
          Calendario de Rondas
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={compartirCalendario}
            disabled={isExporting}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compartir</span>
          </button>
          <button
            type="button"
            onClick={exportarCalendario}
            disabled={isExporting}
            className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isExporting ? 'Generando...' : 'Descargar'}</span>
          </button>
        </div>
      </div>

      {/* ── Contenido capturado por html2canvas (preview = export) ── */}
      <div ref={calendarioRef} className="bg-white p-5">

        {/* Encabezado del documento */}
        <div className="mb-4 pb-3 border-b-2 border-blue-200 text-center">
          <h2 className="text-base font-black text-gray-800 mb-2">
            📅 {nombreTanda || 'Calendario de Tanda'}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-600">
            <span className="flex items-center gap-1 font-semibold">
              <Users className="w-3 h-3 text-blue-600" />{totalRondas} participantes
            </span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1 font-semibold">
              <DollarSign className="w-3 h-3 text-green-600" />
              ${montoPorRonda ? parseFloat(montoPorRonda).toLocaleString() : '0'} por ronda
            </span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1 font-semibold capitalize">
              <Clock className="w-3 h-3 text-purple-600" />{frecuencia}
            </span>
            <span className="text-gray-300">·</span>
            <span className="font-semibold text-amber-700">⏰ Límite Pago: {diasLimite} días</span>
          </div>
        </div>

        {/* Grid de rondas — scroll-container se expande al exportar */}
        <div className="scroll-container max-h-[360px] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {fechasEjemplo.map((item) => {
              const fechaLimite = new Date(item.fechaInicio);
              fechaLimite.setDate(fechaLimite.getDate() + diasLimite);
              return (
                <div
                  key={item.numero}
                  className="flex flex-col items-center p-2.5 rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-lg flex items-center justify-center font-bold text-sm mb-1.5 shadow-sm">
                    {item.numero}
                  </div>
                  <div className="text-xs font-bold text-gray-800 text-center">
                    {item.fechaInicio.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div className="text-[10px] text-amber-700 font-medium mt-0.5 text-center">
                    Límite Pago: {fechaLimite.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pie del documento */}
        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
          {totalRecibir && (
            <div className="flex items-center justify-between text-sm px-0.5">
              <span className="text-gray-500">Total a recibir por participante:</span>
              <span className="font-black text-green-700">${totalRecibir}</span>
            </div>
          )}
          <div className="flex items-center justify-between px-0.5">
            <p className="text-[10px] text-gray-400">
              💡 Límite Pago (Fecha) = Fecha inicio de ronda  + {diasLimite} días 
            </p>
            <p className="text-[10px] text-gray-400">
              📱 TandasMX · {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}


// ==================== COMPONENTE PRINCIPAL ====================
export default function CrearTandaView({ setTandaData, setLoading, setError, loadAdminData }) {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nombre: '',
    montoPorRonda: '500',
    totalRondas: '10',
    fechaInicio: obtenerFechaHoyISO(),
    frecuencia: 'semanal',
    diasRecordatorio: '1',
    metodoPago: 'Transferencia',
    diasLimitePago: '',
  });

  const [errors, setErrors] = useState({});
  const [mostrarAyudaCumpleañera, setMostrarAyudaCumpleañera] = useState(false);

  // ==================== CALCULAR FECHAS DE EJEMPLO ====================
  const fechasEjemplo = useMemo(() => {
    // Para tanda cumpleañera, no mostramos calendario hasta que haya participantes registrados
    if (formData.frecuencia === 'cumpleaños') {
      return [];
    }

    if (!formData.fechaInicio || !formData.totalRondas) return [];
    
    const totalRondas = parseInt(formData.totalRondas);
    if (isNaN(totalRondas) || totalRondas < 1) return [];

    // Usar la función de utils/tandaCalculos.js
    return calcularFechasRondas(formData.fechaInicio, totalRondas, formData.frecuencia);
  }, [formData.fechaInicio, formData.totalRondas, formData.frecuencia]);

  // ==================== VALIDACIÓN ====================
  const FIELD_IDS = {
    nombre:        'nombre-tanda',
    montoPorRonda: 'monto-ronda',
    totalRondas:   'total-rondas',
    fechaInicio:   'fecha-inicio',
    diasLimitePago:'dias-limite-pago',
  };

  const scrollToFirstError = (errorsObj) => {
    const firstKey = Object.keys(errorsObj)[0];
    const id = FIELD_IDS[firstKey];
    if (!id) return;
    setTimeout(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
    }, 50);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }

    if (!formData.montoPorRonda || formData.montoPorRonda <= 0) {
      newErrors.montoPorRonda = 'El monto debe ser mayor a 0';
    }

    if (!formData.totalRondas || formData.totalRondas < 2) {
      newErrors.totalRondas = 'Debe haber al menos 2 participantes';
    }

    if (formData.frecuencia !== 'cumpleaños' && !formData.fechaInicio) {
      newErrors.fechaInicio = 'La fecha de inicio es requerida';
    }

    if (formData.frecuencia !== 'cumpleaños' && formData.fechaInicio) {
      const fechaSeleccionada = new Date(formData.fechaInicio);
      const hoy = new Date(obtenerFechaHoyISO());
      if (fechaSeleccionada < hoy) {
        newErrors.fechaInicio = 'La fecha de inicio no puede ser anterior a hoy';
      }
    }

    if (formData.frecuencia !== 'cumpleaños') {
      const dias = parseInt(formData.diasLimitePago);
      if (formData.diasLimitePago === '' || isNaN(dias) || dias < 0) {
        newErrors.diasLimitePago = 'Solo se permiten números enteros positivos (0 o más)';
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) scrollToFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ==================== SUBMIT ====================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiFetch('/tandas', {
        method: 'POST',
        body: JSON.stringify({
          nombre: formData.nombre,
          montoPorRonda: parseFloat(formData.montoPorRonda),
          totalRondas: parseInt(formData.totalRondas),
          fechaInicio: formData.frecuencia === 'cumpleaños' ? null : formData.fechaInicio,
          frecuencia: formData.frecuencia,
          diasRecordatorio: parseInt(formData.diasRecordatorio),
          metodoPago: formData.metodoPago,
          diasLimitePago: parseInt(formData.diasLimitePago) || 5,
          rondaActual: 1,
          status: 'active'
        })
      });

      if (data.success) {
        console.log('✅ Tanda creada exitosamente:', data.data);
        
        await loadAdminData();
        setTandaData(data.data);
        
        // Navegar a participantes
        navigate('/participantes');
      }
    } catch (error) {
      console.error('Error creando tanda:', error);
      setError(error.message || 'Error al crear la tanda');
    } finally {
      setLoading(false);
    }
  };

  // ==================== HANDLERS ====================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'diasLimitePago') {
      const dias = parseInt(value);
      if (value !== '' && (isNaN(dias) || dias < 0)) {
        setErrors(prev => ({ ...prev, diasLimitePago: 'Solo se permiten números enteros positivos (0 o más)' }));
      } else {
        setErrors(prev => ({ ...prev, diasLimitePago: null }));
      }
    } else if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const esCumpleañera = formData.frecuencia === 'cumpleaños';

  const handleMontoKeyDown = (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const current = parseFloat(e.target.value) || 0;
    const nuevo = e.key === 'ArrowUp'
      ? Math.ceil((current + 1) / 100) * 100
      : Math.max(100, Math.floor((current - 1) / 100) * 100);
    setFormData(prev => ({ ...prev, montoPorRonda: String(nuevo) }));
  };

  // Función para obtener el texto del monto a recibir
  const obtenerTextoMontoRecibir = () => {
    if (!formData.montoPorRonda || !formData.totalRondas) {
      return 'Completa los datos para calcular';
    }
    const monto = parseFloat(formData.montoPorRonda) * (parseInt(formData.totalRondas) - 1);
    return `$${monto.toLocaleString()}`;
  };

  // ==================== RENDER ====================
  return (
    <div className="max-w-4xl mx-auto pb-24"> {/* Agregado pb-24 para área segura inferior */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Crear Nueva Tanda</h2>
              <p className="text-sm opacity-90">
                {esCumpleañera 
                  ? 'Tanda Cumpleañera 🎂'
                  : 'Configura los detalles de tu tanda'}
              </p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8">
          <div className="space-y-6">
            {/* Nombre de la Tanda */}
            <div>
              <label htmlFor="nombre-tanda" className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre de la Tanda *
              </label>
              <input
                id="nombre-tanda"
                name="nombre"
                type="text"
                value={formData.nombre}
                onChange={handleChange}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  errors.nombre 
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                }`}
                placeholder={esCumpleañera ? "Ej: Tanda Cumpleañera Familia 2025" : "Ej: Tanda Familiar 2025"}
              />
              {errors.nombre && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.nombre}
                </p>
              )}
            </div>

            {/* Frecuencia */}
            <div>
              <label htmlFor="frecuencia" className="block text-sm font-semibold text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Tipo de Tanda *
              </label>
              <select
                id="frecuencia"
                name="frecuencia"
                value={formData.frecuencia}
                onChange={handleChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
              >
                <option value="semanal">Semanal (cada 7 días)</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
                <option value="cumpleaños">Cumpleañera 🎂</option>
              </select>
            </div>

            {/* Botón de ayuda para tanda cumpleañera */}
            {esCumpleañera && (
              <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMostrarAyudaCumpleañera(!mostrarAyudaCumpleañera)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-blue-800 hover:text-blue-900 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" />
                    ¿Cómo funciona la tanda cumpleañera?
                  </span>
                  <span className="text-xl">{mostrarAyudaCumpleañera ? '−' : '+'}</span>
                </button>
                
                {mostrarAyudaCumpleañera && (
                  <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-900">
                    <p className="mb-2">🎂 <strong>Es muy sencillo:</strong></p>
                    <ul className="list-disc list-inside space-y-1.5 text-xs ml-2">
                      <li>El día de tu cumpleaños, recibes dinero de todos los demás</li>
                      <li>Cuando es el cumpleaños de otro participante, tú le das dinero</li>
                      <li>Al final del año, todos reciben y dan la misma cantidad</li>
                      <li>El calendario se genera cuando registres a todos los participantes</li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Monto y Participantes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="monto-ronda" className="block text-sm font-semibold text-gray-700 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-1" />
                  {esCumpleañera ? 'Monto por Participante *' : 'Monto por Ronda *'}
                </label>
                <input
                  id="monto-ronda"
                  name="montoPorRonda"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.montoPorRonda}
                  onChange={handleChange}
                  onKeyDown={handleMontoKeyDown}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.montoPorRonda
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                  }`}
                  placeholder="1000"
                />
                {esCumpleañera && (
                  <p className="mt-1.5 text-xs text-blue-600">
                    Lo que cada persona da al cumpleañero
                  </p>
                )}
                {errors.montoPorRonda && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.montoPorRonda}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="total-rondas" className="block text-sm font-semibold text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  {esCumpleañera ? 'Total de Participantes *' : 'Total de Rondas *'}
                </label>
                <input
                  id="total-rondas"
                  name="totalRondas"
                  type="number"
                  min="2"
                  value={formData.totalRondas}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.totalRondas 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                  }`}
                  placeholder="10"
                />
                {esCumpleañera && (
                  <p className="mt-1.5 text-xs text-blue-600">
                    Cuántas personas participarán
                  </p>
                )}
                {errors.totalRondas && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.totalRondas}
                  </p>
                )}
              </div>
            </div>

            {/* Fecha de Inicio - SOLO para tandas normales */}
            {!esCumpleañera && (
              <div>
                <label htmlFor="fecha-inicio" className="block text-sm font-semibold text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Fecha de Inicio *
                </label>
                <input
                  id="fecha-inicio"
                  name="fechaInicio"
                  type="date"
                  min={obtenerFechaHoyISO()}
                  value={formData.fechaInicio}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.fechaInicio 
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-200' 
                      : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                  }`}
                />
                {formData.fechaInicio && !errors.fechaInicio && (
                  <p className="mt-1.5 text-xs text-gray-600">
                    {formatearFechaLarga(formData.fechaInicio)}
                  </p>
                )}
                {errors.fechaInicio && (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.fechaInicio}
                  </p>
                )}
              </div>
            )}

            {/* Días Límite de Pago */}
            {!esCumpleañera && (
              <div>
                <label htmlFor="dias-limite-pago" className="block text-sm font-semibold text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Días Límite de Pago
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="dias-limite-pago"
                    name="diasLimitePago"
                    type="number"
                    min="0"
                    max="30"
                    placeholder="5"
                    value={formData.diasLimitePago}
                    onChange={handleChange}
                    className={`w-24 px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 transition-all text-center font-bold text-lg ${
                      errors.diasLimitePago
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                        : 'border-gray-200 focus:border-blue-500 focus:ring-blue-200'
                    }`}
                  />
                  <span className="text-sm text-gray-500">días después.</span>
                </div>
                {errors.diasLimitePago ? (
                  <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {errors.diasLimitePago}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-400">
                    Recomendado: 3–7 días.
                  </p>
                )}
              </div>
            )}

            {/* Calendario de Rondas - SOLO para tandas normales */}
            {!esCumpleañera && fechasEjemplo.length > 0 && formData.diasLimitePago !== '' && (
              <CalendarioRondas
                fechasEjemplo={fechasEjemplo}
                totalRondas={parseInt(formData.totalRondas)}
                nombreTanda={formData.nombre}
                montoPorRonda={formData.montoPorRonda}
                frecuencia={formData.frecuencia}
                diasLimitePago={formData.diasLimitePago !== '' ? parseInt(formData.diasLimitePago) : 5}
              />
            )}

            {/* Resumen Financiero */}
            <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-5 border-2 border-blue-200">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-blue-600" />
                Resumen Financiero
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Número de Participantes:</span>
                  <span className="font-semibold text-gray-800">
                    {formData.totalRondas || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {esCumpleañera ? 'Aportación por persona:' : 'Monto por ronda:'}
                  </span>
                  <span className="font-semibold text-gray-800">
                    {formData.montoPorRonda ? `$${parseFloat(formData.montoPorRonda).toLocaleString()}` : '—'}
                  </span>
                </div>
                {esCumpleañera ? (
                  <>
                    <div className="pt-3 border-t-2 border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-semibold">Recibirás en tu cumpleaños:</span>
                        <span className="font-black text-blue-700 text-xl">
                          {obtenerTextoMontoRecibir()}
                        </span>
                      </div>
                      {formData.montoPorRonda && formData.totalRondas && (
                        <p className="text-xs text-blue-600 mt-1 text-right">
                          ({parseInt(formData.totalRondas) - 1} personas × ${formData.montoPorRonda})
                        </p>
                      )}
                    </div>
                    <div className="pt-3 border-t border-blue-200">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Darás en el año:</span>
                        <span className="font-bold text-green-600">
                          {formData.montoPorRonda && formData.totalRondas 
                            ? `$${(parseFloat(formData.montoPorRonda) * (parseInt(formData.totalRondas) - 1)).toLocaleString()}`
                            : '—'}
                        </span>
                      </div>
                      {formData.montoPorRonda && formData.totalRondas && (
                        <p className="text-xs text-gray-500 mt-1 text-right">
                          (${formData.montoPorRonda} a {parseInt(formData.totalRondas) - 1} participantes)
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                  {/*
                    <div className="pt-3 border-t-2 border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-700 font-semibold">Total de la tanda:</span>
                        <span className="font-black text-blue-700 text-xl">
                          {formData.montoPorRonda && formData.totalRondas 
                            ? `$${(parseFloat(formData.montoPorRonda) * parseInt(formData.totalRondas)).toLocaleString()}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                    */}
                    <div className="pt-3 border-t border-blue-200">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total a recibir (cada participante):</span>
                        <span className="font-bold text-green-600">
                          {formData.montoPorRonda && formData.totalRondas 
                            ? `$${(parseFloat(formData.montoPorRonda) * parseInt(formData.totalRondas-1)).toLocaleString()}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Mensaje de primera impresión: puntaje de confianza — solo tandas normales */}
            {!esCumpleañera && <div className="rounded-xl border border-blue-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 flex items-center gap-2">
                <span className="text-base">⭐</span>
                <p className="text-white text-xs font-bold tracking-wide uppercase">Sistema de Puntaje de Confianza</p>
              </div>
              <div className="bg-blue-50 px-4 py-3 space-y-2">
                <p className="text-xs text-blue-900 leading-relaxed">
                  Cada participante tiene un <strong>puntaje de confianza</strong> que se construye con cada pago: pagos a tiempo suman puntos, pagos tardíos o no realizados los restan.
                </p>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Esto te permite saber <strong>quién es buen pagador</strong> y considerarlos primero en futuras tandas. Los participantes con mayor puntaje son tu equipo más confiable.
                </p>
                <div className="pt-1.5 border-t border-blue-200 flex items-start gap-2">
                  <span className="text-sm flex-shrink-0">⏰</span>
                  <p className="text-[11px] text-blue-700 font-medium leading-relaxed">
                    <strong>Importante:</strong> Registra los pagos el mismo día en que te paguen. El sistema calcula el puntaje con base en la fecha que tú registras — si lo haces tarde, puede penalizar a alguien que sí cumplió a tiempo.
                  </p>
                </div>
              </div>
            </div>}

            {/* Nota adicional según tipo */}
            <div className="flex items-start gap-2 px-1">
              <AlertCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500">
                {esCumpleañera
                  ? 'Registra a todos los participantes con su fecha de cumpleaños. El calendario se genera automáticamente.'
                  : 'Podrás agregar participantes una vez creada la tanda. Las fechas de rondas se calculan automáticamente.'}
              </p>
            </div>

            {/* Botón de Crear */}
            <div className="pt-4 border-t-2 border-gray-200">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold py-3 px-6 rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Crear Tanda {esCumpleañera && '🎂'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
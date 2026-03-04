import React from 'react';
import { Users, Plus, Calendar, DollarSign, TrendingUp, ArrowRight, Trash2, AlertTriangle, Gift, CheckCircle, AlertCircle, Sparkles, Loader } from 'lucide-react';
import { calcularFechasRondas, calcularRondaActual, calcularProximoCumpleanos, calcularEstadoTanda } from '../utils/tandaCalculos';
import { apiFetch } from '../utils/apiFetch';

export default function InicioView({ tandas, setActiveView, onSeleccionarTanda, onCrearNueva, onEliminarTanda, loading = false }) {
  const [filtroActivo, setFiltroActivo] = React.useState('todas');
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [tandaToDelete, setTandaToDelete] = React.useState(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // ====================================
  // LOADING STATE
  // ====================================
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block p-6 bg-gradient-to-br from-blue-100 to-sky-100 rounded-full mb-4">
            <Loader className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Cargando tus tandas...</h3>
          <p className="text-gray-600">Un momento por favor</p>
        </div>
      </div>
    );
  }

  // ====================================
  // ESTADO VACÍO
  // ====================================
  if (!tandas || tandas.length === 0) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4 md:p-6">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-12 text-center border-2 border-gray-100">
            <div className="mb-6 md:mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-100 to-sky-100 mb-4 md:mb-6">
                <Sparkles className="w-12 h-12 md:w-16 md:h-16 text-blue-600" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 md:mb-3">¡Comienza tu Primera Tanda!</h2>
              <p className="text-base md:text-lg text-gray-600 max-w-md mx-auto">Crea y administra tandas de forma profesional, transparente y segura</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
              {[
                { icon: Users, title: 'Gestión Simple', desc: 'Control total de participantes y pagos', colors: 'from-blue-50 to-sky-50', border: 'border-blue-200', iconBg: 'from-blue-600 to-blue-800' },
                { icon: CheckCircle, title: 'Transparencia', desc: 'Tablero público compartible en tiempo real', colors: 'from-green-50 to-emerald-50', border: 'border-green-200', iconBg: 'from-green-500 to-emerald-600' },
                { icon: AlertCircle, title: 'Seguimiento', desc: 'Estadísticas y reportes automáticos', colors: 'from-purple-50 to-indigo-50', border: 'border-purple-200', iconBg: 'from-purple-600 to-indigo-600' }
              ].map((feat, idx) => (
                <div key={idx} className={`p-3 md:p-4 bg-gradient-to-br ${feat.colors} rounded-xl border-2 ${feat.border}`}>
                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${feat.iconBg} flex items-center justify-center mx-auto mb-2 md:mb-3 shadow-md`}>
                    <feat.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 text-sm md:text-base">{feat.title}</h3>
                  <p className="text-xs md:text-sm text-gray-600">{feat.desc}</p>
                </div>
              ))}
            </div>
            <button onClick={onCrearNueva} className="inline-flex items-center gap-2 md:gap-3 px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold text-base md:text-lg rounded-xl hover:shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all">
              <Plus className="w-5 h-5 md:w-6 md:h-6" />
              Crear Mi Primera Tanda
            </button>
            <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-gray-200">
              <p className="text-xs md:text-sm text-gray-500">💡 <span className="font-semibold">Tip:</span> Una tanda bien organizada genera confianza y facilita el ahorro en grupo</p>
            </div>
          </div>
          <div className="mt-6 md:mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            {[
              { num: '1', title: 'Configura', desc: 'Define monto, frecuencia y participantes' },
              { num: '2', title: 'Comparte', desc: 'Invita a participantes con un link' },
              { num: '3', title: 'Administra', desc: 'Registra pagos y da seguimiento' }
            ].map(step => (
              <div key={step.num} className="bg-white rounded-xl p-3 md:p-4 shadow-md border-2 border-gray-100">
                <div className="flex items-center gap-2 md:gap-3 mb-2">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 text-white flex items-center justify-center font-bold text-xs md:text-sm shadow-md">{step.num}</div>
                  <h4 className="font-bold text-gray-900 text-sm md:text-base">{step.title}</h4>
                </div>
                <p className="text-xs md:text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalTandas = tandas.length;
  const tandasVigentes = tandas.filter(t => calcularEstadoTanda(t) === 'vigentes').length;
  const tandasPasadas = tandas.filter(t => calcularEstadoTanda(t) === 'pasadas').length;
  const tandasProximas = tandas.filter(t => calcularEstadoTanda(t) === 'proximas').length;

  // ====================================
  // HANDLERS
  // ====================================

  const handleDeleteClick = (e, tanda) => {
    e.stopPropagation();
    setTandaToDelete(tanda);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!tandaToDelete) return;
    setIsDeleting(true);
    try {
      const data = await apiFetch(`/tandas/${tandaToDelete.tandaId}`, { method: 'DELETE' });
      setShowDeleteModal(false);
      setTandaToDelete(null);
      if (onEliminarTanda) {
        try { await onEliminarTanda(tandaToDelete.tandaId); } catch (e) { console.error('Error en callback:', e); }
      }
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error al eliminar tanda:', error);
      alert(`No se pudo eliminar la tanda:\n\n${error.message}\n\nPor favor intenta de nuevo.`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setTandaToDelete(null);
  };

  // ====================================
  // RENDER PRINCIPAL
  // ====================================

  return (
    <div className="space-y-4">
      <style>{`
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Encabezado: título dinámico + botón Nueva Tanda */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800">
          {filtroActivo === 'todas' && 'Mis Tandas'}
          {filtroActivo === 'vigentes' && 'Vigentes'}
          {filtroActivo === 'pasadas' && 'Pasadas'}
          {filtroActivo === 'proximas' && 'Próximas'}
        </h2>
        <button
          onClick={onCrearNueva}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-md hover:shadow-blue-500/30 transition-all text-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva Tanda
        </button>
      </div>

      {/* Filtros compactos */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-2 pb-1">
          {[
            { key: 'todas',    label: 'Todas',    count: totalTandas,    icon: Users,      active: 'bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-sm' },
            { key: 'vigentes', label: 'Vigentes', count: tandasVigentes, icon: TrendingUp, active: 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm' },
            { key: 'pasadas',  label: 'Pasadas',  count: tandasPasadas,  icon: Calendar,   active: 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-sm' },
            { key: 'proximas', label: 'Próximas', count: tandasProximas, icon: ArrowRight, active: 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-sm' }
          ].map(filtro => (
            <button
              key={filtro.key}
              onClick={() => setFiltroActivo(filtro.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                filtroActivo === filtro.key
                  ? filtro.active
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <filtro.icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{filtro.label}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                filtroActivo === filtro.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{filtro.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Carrusel */}
      <div>
        {(() => {
          const tandasFiltradas = tandas.filter(tanda => filtroActivo === 'todas' || calcularEstadoTanda(tanda) === filtroActivo);

          if (tandasFiltradas.length === 0) {
            return (
              <div className="text-center py-12 bg-gray-50 rounded-2xl">
                <div className="inline-block p-4 bg-gray-100 rounded-full mb-3"><Users className="w-8 h-8 text-gray-400" /></div>
                <p className="text-gray-500 font-medium">No hay tandas {filtroActivo === 'todas' ? '' : filtroActivo}</p>
              </div>
            );
          }

          return (
            <div className="relative">
              <div className="overflow-x-auto pb-4 scrollbar-hide -mx-4 md:mx-0">
                <div className="flex gap-4 px-4 md:px-0" style={{ scrollSnapType: 'x mandatory' }}>
                  {tandasFiltradas.map((tanda) => {
                    const esCumpleañera = tanda.frecuencia === 'cumpleaños';
                    const proximoCumple = esCumpleañera ? calcularProximoCumpleanos(tanda) : null;
                    const rondaActualCalculada = calcularRondaActual(tanda);

                    const progreso = (() => {
                      const completadas = rondaActualCalculada - 1;
                      if (esCumpleañera) return tanda.totalRondas > 0 ? Math.round((completadas / tanda.totalRondas) * 100) : 0;
                      if (!tanda.fechaInicio) return 0;
                      return tanda.totalRondas > 0 ? Math.round((Math.max(0, completadas) / tanda.totalRondas) * 100) : 0;
                    })();

                    const proximoNumero = tanda.participantes?.find(p => p.numeroAsignado === rondaActualCalculada);
                    const totalParticipantes = Array.isArray(tanda.participantes) ? tanda.participantes.length : 0;
                    const cantidadARecibir = (totalParticipantes - 1) * tanda.montoPorRonda;

                    const colores = esCumpleañera
                      ? { header: 'from-pink-500 to-purple-600', headerHover: 'hover:from-pink-600 hover:to-purple-700', progreso: 'from-pink-500 to-purple-600' }
                      : { header: 'from-blue-600 to-blue-800', headerHover: 'hover:from-blue-700 hover:to-blue-900', progreso: 'from-blue-600 to-blue-800' };

                    return (
                      <div key={tanda.tandaId} className="flex-shrink-0 w-[280px] sm:w-[320px] bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden" style={{ scrollSnapAlign: 'start' }}>
                        {/* Header */}
                        <div className={`bg-gradient-to-r ${colores.header} ${colores.headerHover} p-4 text-white cursor-pointer transition-all relative`} onClick={() => onSeleccionarTanda(tanda.tandaId)}>
                          <h3 className="text-lg font-bold mb-1 pr-8 flex items-center gap-2">
                            {tanda.nombre}
                            {esCumpleañera && <Gift className="w-5 h-5" />}
                          </h3>
                          <div className="flex items-center gap-2 text-xs opacity-90">
                            {esCumpleañera ? <Gift className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                            {esCumpleañera ? 'Tanda Cumpleañera 🎂' : `Ronda ${rondaActualCalculada} de ${tanda.totalRondas}`}
                          </div>
                          <button onClick={(e) => handleDeleteClick(e, tanda)} className="absolute top-3 right-3 p-1.5 bg-white/10 hover:bg-red-500 rounded-lg transition-all group" title="Eliminar tanda">
                            <Trash2 className="w-4 h-4 text-white opacity-70 group-hover:opacity-100" />
                          </button>
                        </div>

                        {/* Contenido */}
                        <div className="p-4 space-y-3 cursor-pointer" onClick={() => onSeleccionarTanda(tanda.tandaId)}>
                          {/* Progreso */}
                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-gray-600">Progreso</span>
                              <span className="text-gray-800">{progreso}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${colores.progreso}`} style={{ width: `${progreso}%` }}></div>
                            </div>
                          </div>

                          {/* Info grid */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className={`text-center p-2 ${esCumpleañera ? 'bg-pink-50' : 'bg-blue-50'} rounded-lg`}>
                              <div className="text-base font-bold text-gray-800">{totalParticipantes}</div>
                              <div className="text-[10px] text-gray-600">Participantes</div>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded-lg">
                              <div className="text-base font-bold text-gray-800">${tanda.montoPorRonda?.toLocaleString() || 0}</div>
                              <div className="text-[10px] text-gray-600">{esCumpleañera ? 'Regalo de' : 'Pago de'}</div>
                            </div>
                          </div>

                          {/* Cantidad a recibir */}
                          <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="text-center">
                              <div className="text-[10px] text-purple-600 font-semibold mb-1">
                                {esCumpleañera ? (proximoCumple?.cantidadCumpleañeros > 1 ? 'Regalo por Cumpleañero' : 'Regalo Total') : 'Cantidad a Recibir'}
                              </div>
                              <div className="text-lg font-black text-purple-700">
                                {esCumpleañera && proximoCumple?.cantidadCumpleañeros > 1
                                  ? `$${((totalParticipantes - 1) * tanda.montoPorRonda).toLocaleString()}`
                                  : `$${cantidadARecibir.toLocaleString()}`}
                              </div>
                              {esCumpleañera && proximoCumple?.cantidadCumpleañeros > 1 && (
                                <div className="text-[9px] text-purple-600 mt-1">
                                  Total: ${((totalParticipantes - 1) * tanda.montoPorRonda * proximoCumple.cantidadCumpleañeros).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Número Actual - Solo tandas normales */}
                          {proximoNumero && !esCumpleañera && (
                            <div className="p-2 bg-green-50 border-green-200 border rounded-lg">
                              <div className="text-[10px] text-green-600 font-semibold mb-1">Número Actual</div>
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-green-500 text-white rounded-lg flex items-center justify-center font-bold text-sm">{proximoNumero.numeroAsignado}</div>
                                <div className="text-xs font-semibold text-gray-800 truncate">{proximoNumero.nombre}</div>
                              </div>
                            </div>
                          )}

                          {/* Contador cumpleañeras */}
                          {esCumpleañera && proximoCumple && (
                            <div className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-200 rounded-xl space-y-2">
                              {proximoCumple.cumpleañerosActuales.length > 0 ? (
                                /* Cumpleaños actual: dentro del rango de ±3 días */
                                <>
                                  <p className="text-[10px] font-bold text-pink-800 tracking-wide">
                                    Cumpleaños Vigente{proximoCumple.cumpleañerosActuales.length > 1 ? 's' : ''}
                                  </p>
                                  {proximoCumple.cumpleañerosActuales.map(p => (
                                    <div key={p.participanteId} className="flex items-center gap-2 bg-pink-100 rounded-lg p-1.5">
                                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                        {p.numeroAsignado}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-pink-900 truncate">{p.nombre.split(' ').slice(0, 2).join(' ')}</div>
                                        <div className="text-[10px] text-pink-600">
                                          {new Date(p.fechaCumpleaños + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                                          {' · '}
                                          {p.diasDesde === 0
                                            ? '¡Hoy!'
                                            : p.diasDesde < 0
                                            ? `Faltan ${-p.diasDesde} día${-p.diasDesde !== 1 ? 's' : ''}`
                                            : `Hace ${p.diasDesde} día${p.diasDesde !== 1 ? 's' : ''}`}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              ) : (
                                /* Sin cumpleaños activo: mostrar recientes + próximos */
                                <>
                                  {proximoCumple.cumpleañerosRecientes.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-amber-800 tracking-wide mb-1">
                                        Cumpleaños Reciente{proximoCumple.cumpleañerosRecientes.length > 1 ? 's' : ''}
                                      </p>
                                      {proximoCumple.cumpleañerosRecientes.map(p => (
                                        <div key={p.participanteId} className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-1.5 mb-1 last:mb-0">
                                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                            {p.numeroAsignado}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-amber-800 truncate">{p.nombre.split(' ').slice(0, 2).join(' ')}</div>
                                            <div className="text-[10px] text-amber-700">
                                              {new Date(p.fechaCumpleaños + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                                              {' · '}hace {p.diasDesde} día{p.diasDesde !== 1 ? 's' : ''}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {proximoCumple.cumpleañerosProximos.length > 0 && (
                                    <div>
                                      <p className="text-[10px] font-semibold text-purple-700 tracking-wide mb-1">
                                        Próximo{proximoCumple.cumpleañerosProximos.length > 1 ? 's' : ''} Cumpleaños
                                      </p>
                                      {proximoCumple.cumpleañerosProximos.map(p => (
                                        <div key={p.participanteId} className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg p-1.5 mb-1 last:mb-0">
                                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                                            {p.numeroAsignado}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-purple-700 truncate">{p.nombre.split(' ').slice(0, 2).join(' ')}</div>
                                            <div className="text-[10px] text-purple-700">
                                              {new Date(p.fechaCumpleaños + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                                              {' · '}dentro de {p.diasHasta} día{p.diasHasta !== 1 ? 's' : ''}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {/* Fechas */}
                          {esCumpleañera && proximoCumple?.cumpleañerosHoy?.length > 0 ? (
                            <div className="p-3 bg-gradient-to-r from-pink-50 to-purple-50 border-2 border-pink-200 rounded-xl">
                              <div className="flex flex-col gap-2">
                                <div className="text-[10px] text-pink-600 font-semibold">
                                  {proximoCumple.cumpleañerosHoy.length > 1 ? `Próximos Cumpleaños (${proximoCumple.cumpleañerosHoy.length})` : 'Próximo Cumpleaños'}
                                </div>
                                <div className="flex flex-col gap-2">
                                  {proximoCumple.cumpleañerosProximos.map((c) => (
                                    <div key={c.numeroAsignado} className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center font-bold shadow-lg">{c.numeroAsignado}</div>
                                      <div className="flex-1">
                                        <div className="text-xs font-bold text-gray-800">{p.nombre.split(' ').slice(0, 2).join(' ')}</div>
                                        <div className="text-xs text-pink-500 font-semibold">
                                          {proximoCumple.fecha?.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {tanda.fechaInicio && (() => {
                                const fi = new Date(tanda.fechaInicio + 'T00:00:00');
                                return (
                                  <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="text-[10px] text-blue-600 font-semibold mb-1">Inicio</div>
                                    <div className="text-xs font-bold text-gray-800">{fi.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                  </div>
                                );
                              })()}
                              {tanda.fechaInicio && (() => {
                                const fechasRondas = calcularFechasRondas(tanda.fechaInicio, tanda.totalRondas, tanda.frecuencia);
                                if (fechasRondas.length === 0) return null;
                                const fechaFin = new Date(fechasRondas[fechasRondas.length - 1].fechaInicio);
                                return (
                                  <div className="p-2 bg-purple-50 border border-purple-200 rounded-lg">
                                    <div className="text-[10px] text-purple-600 font-semibold mb-1">Fin</div>
                                    <div className="text-xs font-bold text-gray-800">{fechaFin.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Spacer para margen derecho en el último elemento del scroll */}
                  <div className="flex-shrink-0 w-4 md:hidden" aria-hidden="true" />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Modal Eliminar */}
      {showDeleteModal && tandaToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-scaleIn">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl"><AlertTriangle className="w-8 h-8" /></div>
                <div>
                  <h3 className="text-xl font-bold">Eliminar Tanda</h3>
                  <p className="text-sm opacity-90">Esta acción no se puede deshacer</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-800 mb-2">¿Estás seguro que deseas eliminar la tanda:</p>
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200 mb-4">
                <p className="font-bold text-gray-900 text-lg mb-2">{tandaToDelete.nombre}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-600">Participantes:</span><span className="font-semibold text-gray-800 ml-1">{Array.isArray(tandaToDelete.participantes) ? tandaToDelete.participantes.length : 0}</span></div>
                  <div><span className="text-gray-600">Rondas:</span><span className="font-semibold text-gray-800 ml-1">{tandaToDelete.totalRondas}</span></div>
                </div>
              </div>
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-1">Advertencia:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Se eliminarán todos los participantes</li>
                      <li>Se perderá todo el historial de pagos</li>
                      <li>Los links de registro dejarán de funcionar</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={handleCancelDelete} disabled={isDeleting}
                  className="flex-1 py-3 px-6 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  Cancelar
                </button>
                <button type="button" onClick={handleConfirmDelete} disabled={isDeleting}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isDeleting ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Eliminando...</>
                  ) : (
                    <><Trash2 className="w-5 h-5" />Eliminar Tanda</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import { Users, DollarSign, Calendar, CheckCircle, AlertCircle, Clock, TrendingUp, Award, Plus, Sparkles, MessageCircle, Share2, X, Check, Gift } from 'lucide-react';
import { 
  calcularRondaActual, 
  calcularFechaRonda
} from '../utils/tandaCalculos';

const BASE_URL_ESTATIC_WEB = 'https://app-tandasmx.s3.us-east-1.amazonaws.com';

export default function DashboardView({ tandaData, estadisticas, onCrearTanda }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [mensajeWhatsApp, setMensajeWhatsApp] = useState('');

  // 🆕 Detectar si es tanda cumpleañera
  const esCumpleañera = tandaData?.frecuencia === 'cumpleaños';

  // ========================================
  // ESTADO VACÍO - Sin tandas creadas
  // ========================================
  if (!tandaData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No hay tanda seleccionada</p>
        </div>
      </div>
    );
  }

  // ========================================
  // FUNCIONES DE CÁLCULO
  // ========================================
  
  // 🔧 Función CORREGIDA para calcular fecha de cumpleaños
  function calcularFechaCumpleañosRonda(numeroRonda) {
      if (!esCumpleañera) return null;
      
      const participantes = tandaData.participantes || [];
      const participante = participantes.find(p => p.numeroAsignado === numeroRonda);
      
      if (!participante || !participante.fechaCumpleaños) return null;
      
      // 🔧 CORRECCIÓN: Parsear la fecha correctamente
      const fechaCumple = new Date(participante.fechaCumpleaños + 'T00:00:00');
      console.log('fecha cumple original de ', numeroRonda, ': ', fechaCumple);
      
      // Obtener hoy sin hora (solo fecha)
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      // 🔧 CORRECCIÓN: Crear la fecha del cumpleaños de este año manteniendo mes y día
      let proximoCumple = new Date(fechaCumple);
      proximoCumple.setFullYear(hoy.getFullYear());
      proximoCumple.setHours(0, 0, 0, 0);
      
      console.log('proximo cumple calculado de ', numeroRonda, ': ', proximoCumple);
      
      // 🔧 Solo pasar al próximo año si YA PASÓ (no si es hoy)
      if (proximoCumple < hoy) {
        proximoCumple.setFullYear(hoy.getFullYear() + 1);
        console.log('proximo cumple ajustado (año siguiente) de ', numeroRonda, ': ', proximoCumple);
      }
      
      return proximoCumple;
  }

  // 🆕 Calcular días hasta el próximo cumpleaños
  function calcularDiasHastaCumpleaños(numeroRonda) {
    const fechaCumple = calcularFechaCumpleañosRonda(numeroRonda);
    if (!fechaCumple) return null;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    console.log('fecha cumple hoy ',hoy,' vs fecha cumpleaños ',fechaCumple)
    
    const diferencia = fechaCumple - hoy;
    const dias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    
    return dias;
  }

  // 🆕 Obtener rango de fechas para tanda cumpleañera
  function obtenerRangoFechasCumpleañera() {
    if (!esCumpleañera) return null;
    
    const participantes = tandaData.participantes || [];
    if (participantes.length === 0) return null;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const cumpleañosProximos = [];
    
    participantes.forEach(p => {
      if (p.fechaCumpleaños) {
        const fechaCumple = new Date(p.fechaCumpleaños + 'T00:00:00');
        let proximoCumple = new Date(hoy.getFullYear(), fechaCumple.getMonth(), fechaCumple.getDate());
        proximoCumple.setHours(0, 0, 0, 0);
        
        if (proximoCumple < hoy) {
          proximoCumple.setFullYear(hoy.getFullYear() + 1);
        }
        
        cumpleañosProximos.push(proximoCumple);
      }
    });
    
    if (cumpleañosProximos.length === 0) return null;
    
    // Ordenar por fecha
    cumpleañosProximos.sort((a, b) => a - b);
    
    return {
      inicio: cumpleañosProximos[0],
      fin: cumpleañosProximos[cumpleañosProximos.length - 1]
    };
  }

  function ultimoDiaDelMes(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
  }
  
  
  
  // Calcular ronda actual basada en fecha
  const rondaActual = calcularRondaActual(tandaData);

  const copyPublicLink = () => {
    if (!tandaData) return;
    
    try {
      const publicUrl = `${BASE_URL_ESTATIC_WEB}/index.html#/public-board/${tandaData.tandaId}`;
      navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Error copiando link:', error);
      alert('No se pudo copiar el link');
    }
  };

  const abrirModalWhatsApp = () => {
    if (!tandaData) return;
    
    const publicUrl = `${BASE_URL_ESTATIC_WEB}/index.html#/public-board/${tandaData.tandaId}`;
    const fechaInicio = new Date(tandaData.fechaInicio + 'T00:00:00');
    fechaInicio.setDate(fechaInicio.getDate());
    
    const mensaje = `📊 Consulta nuestro tablero publico!

📋 Tanda: *${tandaData.nombre}*${esCumpleañera ? ' 🎂' : ''}

En el siguiente enlace puedes consultar:
✅ El avance de los pagos
🔢 El número de ronda actual
👥 El estado general de la tanda

🔗 *Consulta el tablero público aquí:*
${publicUrl}`;

    setMensajeWhatsApp(mensaje);
    setShowWhatsAppModal(true);
  };

  const confirmarEnvioWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}`;
    window.open(whatsappUrl, '_blank');
    setShowWhatsAppModal(false);
  };

  // 🆕 Calcular días hasta próximo cumpleaños
  const diasHastaProximoCumple = calcularDiasHastaCumpleaños(rondaActual);
  console.log('diasHastaProximoCumple: ',diasHastaProximoCumple)

  // Verificar si la tanda ya inició
  const fechaInicioTanda = esCumpleañera 
    ? obtenerRangoFechasCumpleañera()?.inicio 
    : new Date(tandaData.fechaInicio + 'T00:00:00');
  
  const fechaInicioTanda2 = fechaInicioTanda ? new Date(fechaInicioTanda) : null;
  if (fechaInicioTanda2 && !esCumpleañera) {
    fechaInicioTanda2.setDate(fechaInicioTanda2.getDate());
  }
  
  const fechaActual = new Date();
  fechaActual.setHours(0, 0, 0, 0);
  
  const tandaIniciada = fechaInicioTanda ? fechaActual >= fechaInicioTanda : false;
  const diasHastaInicio = fechaInicioTanda ? Math.ceil((fechaInicioTanda - fechaActual) / (1000 * 60 * 60 * 24)) : 0;

  // Calcular fecha de inicio de la ronda actual
  const fechaInicioRondaActual = calcularFechaRonda(fechaInicioTanda,rondaActual,tandaData.frecuencia);

  // 🔧 Texto dinámico para el banner según el número de cumpleaños
  const getTextoCumpleanos = () => {
    if (!esCumpleañera) return null;
    
    const numerales = ['Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto', 'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo'];
    const indice = rondaActual - 1;
    
    if (indice < numerales.length) {
      return `${numerales[indice]} Cumpleaños`;
    }
    return `Cumpleaños ${rondaActual}`;
  };

  // Calcular estadísticas de la RONDA ACTUAL con monto real a recibir
  const statsRondaActual = useMemo(() => {
    const participantes = tandaData.participantes || [];
    const totalParticipantes = participantes.length;

    // 🆕 Para cumpleañeras, calcular cuántos cumplen hoy
    let cumpleañerosHoy = [];
    if (esCumpleañera && fechaInicioRondaActual) {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      participantes.forEach(p => {
        if (p.fechaCumpleaños) {
          const fechaCumple = calcularFechaCumpleañosRonda(p.numeroAsignado);
          if (fechaCumple && fechaCumple.getTime() === fechaInicioRondaActual.getTime()) {
            cumpleañerosHoy.push(p);
          }
        }
      });
    }
    
    const multiplicadorCumpleañeros = cumpleañerosHoy.length || 1;

    let pagadosRondaActual = 0;
    let montoRecaudadoRondaActual = 0;
    let participantesQuePaganRondaActual = 0;

    // 🔧 CORRECCIÓN: Para cumpleañeras con múltiples cumpleañeros, contar pagos de TODOS
    if (esCumpleañera && cumpleañerosHoy.length > 1) {
      // Contar pagos para cada cumpleañero
      cumpleañerosHoy.forEach(cumpleañero => {
        const numRonda = cumpleañero.numeroAsignado;
        
        participantes.forEach(participante => {
          const pagos = participante.pagos || {};
          const pagoRondaActual = pagos[numRonda];

          if (pagoRondaActual && pagoRondaActual.pagado) {
            if (!pagoRondaActual.exentoPago) {
              const montoPagado = pagoRondaActual.monto || tandaData.montoPorRonda || 0;
              montoRecaudadoRondaActual += montoPagado;
            }
          }
        });
      });
      
      // Para el conteo de pagados/pendientes, usar solo una ronda (la del primero)
      participantes.forEach(participante => {
        const pagos = participante.pagos || {};
        const pagoRondaActual = pagos[rondaActual];

        if (pagoRondaActual && pagoRondaActual.pagado) {
          pagadosRondaActual++;
        }
        
        if (!pagoRondaActual?.exentoPago) {
          participantesQuePaganRondaActual++;
        }
      });
    } else {
      // Lógica original para 1 cumpleañero o tandas normales
      participantes.forEach(participante => {
        const pagos = participante.pagos || {};
        const pagoRondaActual = pagos[rondaActual];

        if (pagoRondaActual && pagoRondaActual.pagado) {
          pagadosRondaActual++;
          
          if (!pagoRondaActual.exentoPago) {
            const montoPagado = pagoRondaActual.monto || tandaData.montoPorRonda || 0;
            montoRecaudadoRondaActual += montoPagado;
          }
        }
        
        if (!pagoRondaActual?.exentoPago) {
          participantesQuePaganRondaActual++;
        }
      });
    }

    const pendientesRondaActual = totalParticipantes - pagadosRondaActual;
    
    // 🔧 CORRECCIÓN: Calcular monto esperado TOTAL y monto POR CUMPLEAÑERO
    let montoEsperadoRondaActual;
    let montoRealARecibirPorCumpleañero;
    
    if (esCumpleañera && cumpleañerosHoy.length > 0) {
      // TODOS los participantes dan regalo, incluyendo los cumpleañeros entre ellos
      // Ejemplo: 10 participantes, 2 cumplen = 10 participantes × $100 = $1,000 total
      // Pero se reparte entre 2 cumpleañeros, así que cada uno recibe:
      // (10 - 1) × $100 = $900 (porque ellos mismos no se dan regalo a sí mismos)
      
      const participantesQueReciben = cumpleañerosHoy.length;
      const participantesPorCumpleañero = totalParticipantes - 1; // Todos menos él mismo
      
      montoRealARecibirPorCumpleañero = participantesPorCumpleañero * (tandaData.montoPorRonda || 0);
      montoEsperadoRondaActual = montoRealARecibirPorCumpleañero * participantesQueReciben;
    } else {
      montoEsperadoRondaActual = participantesQuePaganRondaActual * (tandaData.montoPorRonda || 0);
      montoRealARecibirPorCumpleañero = montoEsperadoRondaActual;
    }
    
    const porcentajeRecaudacionRondaActual = montoEsperadoRondaActual > 0
      ? (montoRecaudadoRondaActual / montoEsperadoRondaActual) * 100
      : 0;

    return {
      totalParticipantes,
      pagadosRondaActual,
      pendientesRondaActual,
      montoRecaudadoRondaActual,
      montoEsperadoRondaActual,
      montoRealARecibir: montoEsperadoRondaActual, // Monto total
      montoRealARecibirPorCumpleañero, // 🆕 Monto por cada cumpleañero
      participantesQuePaganRondaActual,
      porcentajeRecaudacionRondaActual,
      cumpleañerosHoy,
      multiplicadorCumpleañeros
    };
  }, [tandaData.participantes, rondaActual, tandaData.montoPorRonda, esCumpleañera, fechaInicioRondaActual]);

  const proximoNumero = tandaData.participantes?.find(
    p => p.numeroAsignado === rondaActual
  );

  // Progreso de rondas
  const rondasCompletadas = Math.max(0, rondaActual - 1);
  const progresoRondas = tandaData.totalRondas > 0
    ? (rondasCompletadas / tandaData.totalRondas) * 100
    : 0;

  // 🆕 Colores para tanda cumpleañera
  const coloresTanda = esCumpleañera ? {
    primary: 'from-pink-500 to-purple-600',
    secondary: 'from-pink-50 to-purple-50',
    border: 'border-pink-200',
    text: 'text-pink-600',
    bg: 'bg-pink-50',
    badge: 'from-pink-600 to-purple-800'
  } : {
    primary: 'from-blue-600 to-blue-800',
    secondary: 'from-blue-50 to-sky-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    bg: 'bg-blue-50',
    badge: 'from-blue-600 to-blue-800'
  };

  // ========================================
  // RENDER PRINCIPAL (CON TANDA)
  // ========================================
  return (
    <div className="space-y-4 md:space-y-6">
      
      {/* Header de Tanda - Mejorado para mobile */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-lg border-2 border-gray-100 p-3 md:p-4">
        <div className="flex items-center justify-between gap-2 md:gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-gray-800 truncate flex items-center gap-2">
              {tandaData.nombre}
              {esCumpleañera && <Gift className="w-5 h-5 md:w-6 md:h-6 text-pink-600" />}
            </h2>
            <p className="text-xs md:text-sm text-gray-600">
              {esCumpleañera ? 'Tanda Cumpleañera 🎂' : `Ronda ${rondaActual} de ${tandaData.totalRondas}`}
            </p>
          </div>
          
          {/* Botones de Acción - Optimizados para mobile */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
            <button
              onClick={abrirModalWhatsApp}
              className="flex items-center justify-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg md:rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all font-semibold text-xs md:text-sm"
              title="Compartir por WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            
            <button
              onClick={copyPublicLink}
              className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 md:py-2 bg-gradient-to-r ${coloresTanda.primary} text-white rounded-lg md:rounded-xl hover:shadow-lg transition-all font-semibold text-xs md:text-sm`}
              title="Copiar enlace"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal WhatsApp */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-4 md:p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                  <MessageCircle className="w-6 h-6 md:w-8 md:h-8" />
                  <div>
                    <h3 className="text-lg md:text-xl font-bold">Compartir por WhatsApp</h3>
                    <p className="text-xs md:text-sm opacity-90">Vista previa del mensaje</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6">
              <div className="mb-4">
                <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-2">
                  Mensaje:
                </label>
                <textarea
                  value={mensajeWhatsApp}
                  onChange={(e) => setMensajeWhatsApp(e.target.value)}
                  rows={14}
                  className="w-full px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 transition-all font-mono resize-none"
                  placeholder="Edita el mensaje aquí..."
                />
                <p className="text-[10px] md:text-xs text-gray-500 mt-2">
                  {mensajeWhatsApp.length} caracteres
                </p>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 md:p-4 mb-4">
                <div className="flex items-start gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-[10px] md:text-xs text-blue-800">
                    <p className="font-semibold mb-1">Este mensaje se enviará a:</p>
                    <p>Tus contactos de WhatsApp (seleccionarás después)</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all text-sm md:text-base"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarEnvioWhatsApp}
                  className="flex-1 px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-green-500/30 transition-all flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <MessageCircle className="w-4 h-4 md:w-5 md:h-5" />
                  Enviar por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Estado de la Tanda - Banner Superior */}
      {!tandaIniciada && fechaInicioTanda2 && (
        <div className={`bg-gradient-to-r ${coloresTanda.primary} rounded-xl md:rounded-2xl shadow-xl p-4 md:p-6 text-white`}>
          <div className="flex items-center gap-2 md:gap-3 mb-3">
            {esCumpleañera ? <Gift className="w-6 h-6 md:w-8 md:h-8" /> : <Clock className="w-6 h-6 md:w-8 md:h-8" />}
            <div>
              <h3 className="text-xl md:text-2xl font-black">
                {esCumpleañera ? 'Próximo Cumpleaños' : 'Tanda Próxima a Iniciar'}
              </h3>
              <p className="text-xs md:text-sm opacity-90">
                {esCumpleañera ? getTextoCumpleanos() : 'La tanda aún no ha comenzado'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-4 bg-white/20 rounded-xl p-3 md:p-4 backdrop-blur-sm">
            <Calendar className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs md:text-sm opacity-90">
                {esCumpleañera ? getTextoCumpleanos() : 'Fecha de Inicio'}
              </div>
              <div className="text-base md:text-xl font-bold truncate">
                {fechaInicioTanda2.toLocaleDateString('es-MX', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </div>
              <div className="text-xs md:text-sm font-semibold mt-1">
                ⏳ Faltan {diasHastaProximoCumple} día{diasHastaProximoCumple !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid Principal - 2 columnas en desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        
        {/* Columna 1: Ronda/Cumpleaños Actual */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
          {/* Header con estado */}
          <div className={`p-3 md:p-4 ${tandaIniciada ? `bg-gradient-to-r ${esCumpleañera ? 'from-pink-500 to-purple-600' : 'from-green-500 to-emerald-600'}` : 'bg-gradient-to-r from-gray-400 to-gray-500'}`}>
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                {esCumpleañera ? <Gift className="w-4 h-4 md:w-5 md:h-5" /> : <Award className="w-4 h-4 md:w-5 md:h-5" />}
                <span className="text-xs md:text-sm font-bold">
                  {esCumpleañera ? (tandaIniciada ? 'Próximo Cumpleaños' : getTextoCumpleanos()) : (tandaIniciada ? 'Ronda Actual' : 'Primera Ronda')}
                </span>
              </div>
              <span className="px-2 py-1 bg-white/20 rounded-lg text-[10px] md:text-xs font-bold">
                {rondaActual} / {tandaData.totalRondas}
              </span>
            </div>
          </div>

          {/* Contenido */}
          <div className="p-4 md:p-6">
            {proximoNumero ? (
              <>
                {/* 🆕 Mostrar TODOS los cumpleañeros si hay múltiples */}
                {esCumpleañera && statsRondaActual.cumpleañerosHoy && statsRondaActual.cumpleañerosHoy.length > 1 ? (
                  <>
                    {/* Múltiples cumpleañeros */}
                    <div className="text-center mb-4">
                      <h4 className="text-sm md:text-base font-bold text-pink-600 mb-3">
                        ¡{statsRondaActual.cumpleañerosHoy.length} Cumpleañeros! 🎉
                      </h4>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        {statsRondaActual.cumpleañerosHoy.map((cumpleañero) => (
                          <div key={cumpleañero.participanteId} className="p-2 bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl border-2 border-pink-200">
                            <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg mb-2">
                              <span className="text-xl md:text-2xl font-black">{cumpleañero.numeroAsignado}</span>
                            </div>
                            <div className="text-xs md:text-sm font-bold text-gray-800 truncate">{cumpleañero.nombre}</div>
                            <div className="text-[10px] md:text-xs text-gray-500 truncate">{cumpleañero.telefono}</div>
                          </div>
                        ))}
                      </div>
                      <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-2 md:p-3">
                        <p className="text-[10px] md:text-xs text-yellow-800">
                          💰 <strong>Cada cumpleañero recibirá ${statsRondaActual.montoRealARecibirPorCumpleañero?.toLocaleString()}</strong>
                        </p>
                        <p className="text-[9px] md:text-[10px] text-yellow-700 mt-1">
                          Todos dan regalo (incluso entre cumpleañeros)
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Un solo cumpleañero (original) */}
                    <div className="text-center mb-4">
                      <div className={`inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br ${esCumpleañera ? 'from-pink-500 to-purple-600' : 'from-green-500 to-emerald-600'} text-white shadow-lg mb-3`}>
                        <span className="text-3xl md:text-4xl font-black">{proximoNumero.numeroAsignado}</span>
                      </div>
                      <div className="text-lg md:text-xl font-bold text-gray-800 truncate">{proximoNumero.nombre}</div>
                      <div className="text-xs md:text-sm text-gray-500 truncate">{proximoNumero.telefono}</div>
                    </div>
                  </>
                )}

                {/* Información de fechas y monto */}
                <div className="space-y-2 md:space-y-3 border-t pt-4">
                  {/* 🆕 Días hasta el cumpleaños (solo para cumpleañeras) */}
                  {esCumpleañera && diasHastaProximoCumple !== null && (
                    <div className={`flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-gradient-to-r ${coloresTanda.secondary} rounded-xl border-2 ${coloresTanda.border}`}>
                      <Clock className={`w-4 h-4 md:w-5 md:h-5 ${coloresTanda.text} mt-0.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] md:text-xs font-semibold ${coloresTanda.text} mb-1`}>
                          {diasHastaProximoCumple === 0 ? '¡Hoy es su cumpleaños!' : 'Faltan'}
                        </div>
                        {diasHastaProximoCumple > 0 && (
                          <div className={`text-xl md:text-2xl lg:text-3xl font-black ${coloresTanda.text}`}>
                            {diasHastaProximoCumple} día{diasHastaProximoCumple !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fecha de inicio de ronda/cumpleaños */}
                  {fechaInicioRondaActual && (
                    <div className={`flex items-start gap-2 md:gap-3 p-2 md:p-3 ${esCumpleañera ? `bg-gradient-to-r ${coloresTanda.secondary}` : 'bg-blue-50'} rounded-xl border-2 ${esCumpleañera ? coloresTanda.border : 'border-blue-200'}`}>
                      <Calendar className={`w-4 h-4 md:w-5 md:h-5 ${esCumpleañera ? coloresTanda.text : 'text-blue-600'} mt-0.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[10px] md:text-xs font-semibold ${esCumpleañera ? coloresTanda.text : 'text-blue-800'} mb-1`}>
                          {esCumpleañera ? 'Fecha de Cumpleaños' : 'Inicio de Ronda'}
                        </div>
                        <div className={`text-xs md:text-sm font-bold ${esCumpleañera ? coloresTanda.text : 'text-blue-900'} truncate`}>
                          {fechaInicioRondaActual.toLocaleDateString('es-MX', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: esCumpleañera ? undefined : 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Monto a recibir REAL */}
                  <div className="flex items-start gap-2 md:gap-3 p-2 md:p-3 bg-green-50 rounded-xl border-2 border-green-200">
                    <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] md:text-xs font-semibold text-green-800 mb-1">
                        {esCumpleañera ? (statsRondaActual.multiplicadorCumpleañeros > 1 ? 'Cada Cumpleañero Recibirá' : 'Recibirá de Regalo') : 'Recibirá'}
                      </div>
                      <div className="text-xl md:text-2xl lg:text-3xl font-black text-green-900">
                        ${statsRondaActual.montoRealARecibirPorCumpleañero?.toLocaleString()}
                      </div>
                      {esCumpleañera && statsRondaActual.multiplicadorCumpleañeros > 1 && (
                        <div className="mt-2 pt-2 border-t border-green-300">
                          <p className="text-[9px] md:text-[10px] text-green-700">
                            💰 Total entre {statsRondaActual.cumpleañerosHoy.length} cumpleañeros: ${statsRondaActual.montoRealARecibir?.toLocaleString()}
                          </p>
                          <p className="text-[9px] md:text-[10px] text-green-700 mt-1">
                            ({statsRondaActual.totalParticipantes - 1} participantes × ${tandaData.montoPorRonda.toLocaleString()} c/u)
                          </p>
                        </div>
                      )}
                      {!esCumpleañera && statsRondaActual.participantesQuePaganRondaActual < statsRondaActual.totalParticipantes && (
                        <p className="text-[9px] md:text-[10px] text-green-700 mt-1">
                          * Monto real ({statsRondaActual.participantesQuePaganRondaActual} participantes pagan)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 md:w-12 md:h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-xs md:text-sm text-gray-500">Sin participante asignado</p>
              </div>
            )}
          </div>
        </div>

        {/* Columna 2: Progreso de Recaudación */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-xl p-4 md:p-6 border-2 border-gray-100">
          <div className="flex items-center gap-2 mb-4 md:mb-5">
            <TrendingUp className={`w-4 h-4 md:w-5 md:h-5 ${coloresTanda.text}`} />
            <h3 className="text-base md:text-lg font-bold text-gray-800">
              {esCumpleañera ? 'Regalos Recibidos' : 'Recaudación Actual'}
            </h3>
          </div>

          {/* Monto Recaudado */}
          <div className="mb-4 md:mb-6">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs md:text-sm font-semibold text-gray-600">
                {esCumpleañera ? `Cumpleaños ${rondaActual}` : `Ronda ${rondaActual}`}
              </span>
              <span className="text-xl md:text-2xl font-black text-gray-800">
                {statsRondaActual.porcentajeRecaudacionRondaActual.toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 md:h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full bg-gradient-to-r ${esCumpleañera ? 'from-pink-500 to-purple-600' : 'from-green-500 to-emerald-600'} transition-all duration-500`}
                style={{ width: `${statsRondaActual.porcentajeRecaudacionRondaActual}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] md:text-xs text-gray-500">
              <span>${statsRondaActual.montoRecaudadoRondaActual.toLocaleString()}</span>
              <span>${statsRondaActual.montoEsperadoRondaActual.toLocaleString()}</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6">
            <div className="p-2 md:p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center gap-1 md:gap-2 mb-1">
                <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                <span className="text-[10px] md:text-xs font-semibold text-green-800">
                  {esCumpleañera ? 'Entregados' : 'Pagados'}
                </span>
              </div>
              <div className="text-xl md:text-2xl font-black text-green-900">
                {statsRondaActual.pagadosRondaActual}
              </div>
            </div>

            <div className="p-2 md:p-3 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200">
              <div className="flex items-center gap-1 md:gap-2 mb-1">
                <Clock className="w-3 h-3 md:w-4 md:h-4 text-yellow-600" />
                <span className="text-[10px] md:text-xs font-semibold text-yellow-800">Pendientes</span>
              </div>
              <div className="text-xl md:text-2xl font-black text-yellow-900">
                {statsRondaActual.pendientesRondaActual}
              </div>
            </div>
          </div>

          {/* Frecuencia */}
          <div className={`p-3 md:p-4 bg-gradient-to-br ${coloresTanda.secondary} rounded-xl border-2 ${coloresTanda.border} mb-4 md:mb-6`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {esCumpleañera ? <Gift className={`w-4 h-4 md:w-5 md:h-5 ${coloresTanda.text}`} /> : <Clock className={`w-4 h-4 md:w-5 md:h-5 ${coloresTanda.text}`} />}
                <span className={`text-xs md:text-sm font-semibold ${coloresTanda.text}`}>
                  {esCumpleañera ? 'Tipo de Tanda' : 'Frecuencia'}
                </span>
              </div>
              <span className={`text-sm md:text-base font-bold ${coloresTanda.text} capitalize`}>
                {esCumpleañera ? 'Cumpleañera 🎂' : tandaData.frecuencia}
              </span>
            </div>
          </div>

          {/* Progreso General */}
          <div className="pt-4 md:pt-6 border-t-2 border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs md:text-sm font-semibold text-gray-600">Progreso General</span>
              <span className="text-xs md:text-sm font-bold text-gray-800">
                {rondasCompletadas} / {tandaData.totalRondas}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${coloresTanda.primary} transition-all duration-500`}
                style={{ width: `${progresoRondas}%` }}
              ></div>
            </div>
            <div className="text-right text-[10px] md:text-xs text-gray-500 mt-1">
              {progresoRondas.toFixed(0)}% completado
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Participantes */}
      <div className="bg-white rounded-xl md:rounded-2xl shadow-xl overflow-hidden border-2 border-gray-100">
        {/* Header */}
        <div className={`bg-gradient-to-r ${coloresTanda.secondary} border-b-2 ${coloresTanda.border} p-4 md:p-6`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-white rounded-xl shadow-sm">
                {esCumpleañera ? <Gift className={`w-5 h-5 md:w-6 md:h-6 ${coloresTanda.text}`} /> : <Users className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />}
              </div>
              <div>
                <h3 className="text-base md:text-xl font-bold text-gray-800">
                  Participantes {esCumpleañera ? '🎂' : `– Ronda ${rondaActual}`}
                </h3>
                <p className="text-xs md:text-sm text-gray-600">
                  {statsRondaActual.pagadosRondaActual} de {statsRondaActual.totalParticipantes} han {esCumpleañera ? 'entregado' : 'pagado'}
                </p>
              </div>
            </div>

            {/* Mini Stats */}
            <div className="flex gap-3 md:gap-4">
              <div className="text-center">
                <div className="text-xl md:text-2xl font-black text-green-600">
                  {statsRondaActual.pagadosRondaActual}
                </div>
                <div className="text-[10px] md:text-xs text-gray-500">{esCumpleañera ? 'Entregados' : 'Pagados'}</div>
              </div>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-black text-yellow-600">
                  {statsRondaActual.pendientesRondaActual}
                </div>
                <div className="text-[10px] md:text-xs text-gray-500">Pendientes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de participantes */}
        <div className="p-4 md:p-6">
          {(tandaData.participantes || []).length === 0 ? (
            <div className="text-center py-8 md:py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-100 mb-4">
                <Users className="w-8 h-8 md:w-10 md:h-10 text-blue-600" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-gray-800 mb-2">Sin participantes aún</h3>
              <p className="text-xs md:text-sm text-gray-600 mb-4">Invita a personas para comenzar la tanda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 max-h-80 md:max-h-96 overflow-y-auto">
              {tandaData.participantes
                .sort((a, b) => a.numeroAsignado - b.numeroAsignado)
                .map((participante) => {
                  const esProximo = participante.numeroAsignado === rondaActual;
                  
                  // 🆕 Verificar si este participante cumple hoy (para cumpleañeras)
                  const cumpleHoy = esCumpleañera && statsRondaActual.cumpleañerosHoy?.some(
                    c => c.participanteId === participante.participanteId
                  );
                  
                  const pagos = participante.pagos || {};
                  const pagoRondaActual = pagos[rondaActual];
                  const pagadoRondaActual = pagoRondaActual && pagoRondaActual.pagado;
                  
                  const esExento = pagoRondaActual?.exentoPago || false;
                  const esParcial = pagoRondaActual?.monto && 
                                   pagoRondaActual.monto < tandaData.montoPorRonda && 
                                   !esExento;

                  return (
                    <div
                      key={participante.participanteId}
                      className={`p-3 md:p-4 rounded-xl border-2 transition-all ${
                        cumpleHoy
                          ? 'border-pink-500 bg-pink-50 shadow-md' 
                          : esProximo
                          ? esCumpleañera 
                            ? 'border-pink-300 bg-pink-50' 
                            : 'border-green-500 bg-green-50 shadow-md'
                          : pagadoRondaActual
                          ? 'border-gray-200 bg-gray-50'
                          : 'border-yellow-200 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                          <div
                            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center font-bold text-base md:text-lg shadow-sm flex-shrink-0 ${
                              cumpleHoy
                                ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white ring-2 ring-pink-400'
                                : esProximo
                                ? esCumpleañera
                                  ? 'bg-gradient-to-br from-pink-500 to-purple-600 text-white'
                                  : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                                : pagadoRondaActual
                                ? esExento
                                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                                  : esParcial
                                  ? 'bg-gradient-to-br from-orange-500 to-amber-600 text-white'
                                  : 'bg-gray-300 text-gray-700'
                                : 'bg-yellow-300 text-yellow-900'
                            }`}
                          >
                            {participante.numeroAsignado}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs md:text-sm text-gray-800 truncate">
                              {participante.nombre}
                              {cumpleHoy && (
                                <span className="ml-1 md:ml-2 text-[10px] md:text-xs text-pink-600">
                                  ← ¡Cumpleaños! 🎂
                                </span>
                              )}
                              {esProximo && !cumpleHoy && (
                                <span className={`ml-1 md:ml-2 text-[10px] md:text-xs ${esCumpleañera ? 'text-pink-600' : 'text-green-600'}`}>
                                  ← {esCumpleañera ? '¡Cumpleaños!' : 'Turno'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] md:text-xs text-gray-500 truncate">{participante.telefono}</div>
                            {/* 🆕 Mostrar fecha de cumpleaños si es tanda cumpleañera */}
                            {esCumpleañera && participante.fechaCumpleaños && (
                              <div className="text-[10px] md:text-xs text-pink-600 font-semibold truncate">
                                🎂 {new Date(participante.fechaCumpleaños + 'T00:00:00').toLocaleDateString('es-MX', { 
                                  day: 'numeric', 
                                  month: 'short'
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {pagadoRondaActual ? (
                            esExento ? (
                              <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border border-purple-300 rounded-lg">
                                <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                                <span className="text-[10px] md:text-xs font-bold">Exento</span>
                                <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-purple-600 text-white text-[8px] md:text-[9px] flex items-center justify-center font-bold">E</span>
                              </div>
                            ) : esParcial ? (
                              <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-300 rounded-lg">
                                <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                                <span className="text-[10px] md:text-xs font-bold">Parcial</span>
                                <span className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-orange-600 text-white text-[8px] md:text-[9px] flex items-center justify-center font-bold">P</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-green-100 text-green-700 rounded-lg border border-green-300">
                                <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                                <span className="text-[10px] md:text-xs font-bold">{esCumpleañera ? 'Entregado' : 'Pagado'}</span>
              </div>
                            )
                          ) : (
                            <div className="flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 bg-yellow-100 text-yellow-700 rounded-lg border border-yellow-300">
                              <Clock className="w-3 h-3 md:w-4 md:h-4" />
                              <span className="text-[10px] md:text-xs font-bold">Pendiente</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Animación fadeIn */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
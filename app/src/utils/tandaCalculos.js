// src/utils/tandaCalculos.js

/**
 * Funciones auxiliares compartidas para cálculos de tandas
 */

// ==================== CONSTANTES ====================

export const DIAS_LIMITE_PAGO = 5;

// ==================== UTILIDADES DE FECHA ====================

/**
 * Obtiene la fecha de hoy en formato ISO (YYYY-MM-DD)
 */
export const obtenerFechaHoyISO = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().split("T")[0];
};

/**
 * Formatea una fecha en formato largo (español)
 * @param {string} fechaStr - Fecha en formato YYYY-MM-DD
 * @returns {string} Fecha formateada (ej: "15 de enero de 2024")
 */
export const formatearFechaLarga = (fechaStr) => {
  if (!fechaStr) return "";
  const [y, m, d] = fechaStr.split("-");
  const fecha = new Date(y, m - 1, d);

  return fecha.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * Obtiene el último día de un mes
 */
export const ultimoDiaDelMes = (fecha) => {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
};

// ==================== CÁLCULO DE FECHAS DE RONDAS ====================

/**
 * Calcula la fecha de una ronda específica
 * @param {Date|string} fechaInicial - Fecha de inicio de la tanda
 * @param {number} indice - Número de ronda (1-based)
 * @param {string} frecuencia - 'semanal', 'quincenal' o 'mensual'
 * @returns {Date} Fecha calculada de la ronda
 */
export const calcularFechaRonda = (fechaInicial, indice, frecuencia) => {
  const fecha = new Date(fechaInicial);

  if (frecuencia === "semanal") {
    if (indice > 1) {
      fecha.setDate(fecha.getDate() + 7 * (indice - 1));
    }
    return fecha;
  }

  if (frecuencia === "mensual") {
    const diaOriginal = fecha.getDate();
    fecha.setMonth(fecha.getMonth() + indice - 1);
    
    if (fecha.getDate() !== diaOriginal) {
      fecha.setDate(0);
    }
    
    return fecha;
  }

  if (frecuencia === "quincenal") {
    let temp = new Date(fecha);
    let diaInicial = temp.getDate();
    let esFinDeMes = diaInicial > 15;

    for (let i = 1; i <= indice; i++) {
      if (esFinDeMes) {
        temp = ultimoDiaDelMes(temp);
      } else {
        temp.setDate(15);
      }

      if (i < indice) {
        if (esFinDeMes) {
          temp.setDate(1);
          temp.setMonth(temp.getMonth() + 1);
          temp.setDate(15);
        } else {
          temp = ultimoDiaDelMes(temp);
        }
        esFinDeMes = !esFinDeMes;
      }
    }
    return temp;
  }

  return fecha;
};

/**
 * Calcula todas las fechas de rondas de una tanda
 * @param {string} fechaInicio - Fecha de inicio en formato YYYY-MM-DD
 * @param {number} totalRondas - Total de rondas
 * @param {string} frecuencia - 'semanal', 'quincenal' o 'mensual'
 * @returns {Array} Array de objetos con {numero, fechaInicio, fechaLimite}
 */
export const calcularFechasRondas = (fechaInicio, totalRondas, frecuencia) => {
  const fechaBase = new Date(fechaInicio + 'T00:00:00');
  const rondas = [];

  for (let i = 1; i <= totalRondas; i++) {
    const fechaInicioRonda = calcularFechaRonda(fechaBase, i, frecuencia);
    
    const fechaLimite = new Date(fechaInicioRonda);
    fechaLimite.setDate(fechaLimite.getDate() + DIAS_LIMITE_PAGO);

    rondas.push({
      numero: i,
      fechaInicio: fechaInicioRonda,
      fechaLimite: fechaLimite
    });
  }

  return rondas;
};

// ==================== CÁLCULO DE RONDA ACTUAL ====================

/**
 * Calcula la ronda actual de una tanda (normal o cumpleañera)
 */
export const calcularRondaActual = (tandaData) => {
  const esCumpleañera = tandaData?.frecuencia === 'cumpleaños';

  if (esCumpleañera) {
    const participantes = tandaData.participantes || [];
    if (participantes.length === 0) return 1;
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const participantesOrdenados = [...participantes].sort((a, b) => a.numeroAsignado - b.numeroAsignado);
    let numeroActual = 1;
    
    for (const p of participantesOrdenados) {
      if (p.fechaCumpleaños) {
        const fechaCumple = new Date(p.fechaCumpleaños + 'T00:00:00');
        fechaCumple.setHours(0, 0, 0, 0);
        
        const mesHoy = hoy.getMonth();
        const diaHoy = hoy.getDate();
        const mesCumple = fechaCumple.getMonth();
        const diaCumple = fechaCumple.getDate();
        
        const yaPaso = mesHoy > mesCumple || (mesHoy === mesCumple && diaHoy >= diaCumple);
        
        if (yaPaso) {
          numeroActual = p.numeroAsignado;
        } else {
          break;
        }
      }
    }
    
    return numeroActual;
  }

  // Tandas normales
  if (!tandaData.fechaInicio) return 1;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const fechaInicio = new Date(tandaData.fechaInicio + 'T00:00:00');
  fechaInicio.setHours(0, 0, 0, 0);
  
  let rondaActual = 1;

  for (let i = 1; i <= tandaData.totalRondas; i++) {
    const fechaRonda = calcularFechaRonda(fechaInicio, i, tandaData.frecuencia);
    fechaRonda.setHours(0, 0, 0, 0);

    if (hoy >= fechaRonda) {
      rondaActual = i;
    } else {
      break;
    }
  }

  return rondaActual;
};

/**
 * Obtiene la ronda actual específica para tandas de cumpleaños
 */
export const obtenerRondaActualCumpleanos = (tanda) => {
  if (tanda.frecuencia !== 'cumpleaños' || !tanda.participantes || tanda.participantes.length === 0) {
    return null;
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const participantesOrdenados = [...tanda.participantes].sort((a, b) => a.numeroAsignado - b.numeroAsignado);
  let numeroActual = null;
  
  for (const p of participantesOrdenados) {
    if (p.fechaCumpleaños) {
      const fechaCumple = new Date(p.fechaCumpleaños + 'T00:00:00');
      fechaCumple.setHours(0, 0, 0, 0);
      
      const mesHoy = hoy.getMonth();
      const diaHoy = hoy.getDate();
      const mesCumple = fechaCumple.getMonth();
      const diaCumple = fechaCumple.getDate();
      
      const yaPaso = mesHoy > mesCumple || (mesHoy === mesCumple && diaHoy >= diaCumple);
      
      if (yaPaso) {
        numeroActual = p.numeroAsignado;
      } else {
        break;
      }
    }
  }
  
  return numeroActual;
};

// ==================== CÁLCULO DE ESTADO DE PAGOS ====================

/**
 * Calcula el estado de pagos de un participante
 */
export const calcularEstadoPorParticipante = (matrizPagos, tandaData, participanteId) => {
  if (!matrizPagos || !Array.isArray(matrizPagos)) {
    return { estado: 'pendiente', pagosAdelantados: 0, pagosEsperados: 0, pagosRealizados: 0 };
  }
  
  const esCumpleañera = tandaData?.frecuencia === 'cumpleaños';
  const pagos = matrizPagos.filter(p => p.participanteId === participanteId && p.pagado);
  const pagosRealizados = pagos.length;
  const rondaActual = calcularRondaActual(tandaData);
  
  let pagosEsperados = 0;
  
  if (!esCumpleañera) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const fechaInicio = new Date(tandaData.fechaInicio + 'T00:00:00');
    fechaInicio.setHours(0, 0, 0, 0);
    
    for (let i = 1; i <= tandaData.totalRondas; i++) {
      const fechaRonda = calcularFechaRonda(fechaInicio, i, tandaData.frecuencia);
      fechaRonda.setHours(0, 0, 0, 0);
      
      const fechaLimitePago = new Date(fechaRonda);
      fechaLimitePago.setDate(fechaLimitePago.getDate() + DIAS_LIMITE_PAGO);
      
      if (hoy > fechaLimitePago) {
        pagosEsperados++;
      } else {
        break;
      }
    }
  } else {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const participantes = tandaData.participantes || [];
    const participantesOrdenados = [...participantes].sort((a, b) => a.numeroAsignado - b.numeroAsignado);
    
    for (const p of participantesOrdenados) {
      if (p.fechaCumpleaños) {
        const fechaCumple = new Date(p.fechaCumpleaños + 'T00:00:00');
        fechaCumple.setHours(0, 0, 0, 0);
        
        const fechaLimitePago = new Date(fechaCumple);
        fechaLimitePago.setDate(fechaLimitePago.getDate() + DIAS_LIMITE_PAGO);
        
        const mesHoy = hoy.getMonth();
        const diaHoy = hoy.getDate();
        const mesLimite = fechaLimitePago.getMonth();
        const diaLimite = fechaLimitePago.getDate();
        
        const yaPasoLimite = mesHoy > mesLimite || (mesHoy === mesLimite && diaHoy > diaLimite);
        
        if (yaPasoLimite) {
          pagosEsperados++;
        } else {
          break;
        }
      }
    }
  }
  
  const pagosAdelantados = pagos.filter(p => p.ronda > rondaActual).length;
  
  let estado;
  if (pagosEsperados === 0) {
    estado = 'al_corriente';
  } else if (pagosRealizados >= pagosEsperados) {
    estado = 'al_corriente';
  } else {
    estado = 'atrasado';
  }
  
  return { estado, pagosAdelantados, pagosEsperados, pagosRealizados };
};

// ==================== TANDAS DE CUMPLEAÑOS ====================

/**
 * Calcula el número automático para un nuevo participante en tanda de cumpleaños
 */
export const calcularNumeroAutomaticoCumpleanos = (tandaData, nuevaFechaCumpleaños) => {
  if (tandaData.frecuencia !== 'cumpleaños') return 1;
  
  const participantes = tandaData.participantes || [];
  
  if (participantes.length === 0) return 1;

  const todosLosParticipantes = [
    ...participantes.map(p => ({
      fechaCumpleaños: new Date(p.fechaCumpleaños),
      fechaRegistro: new Date(p.fechaRegistro || p.createdAt),
      participanteId: p.participanteId
    })),
    {
      fechaCumpleaños: new Date(nuevaFechaCumpleaños),
      fechaRegistro: new Date(),
      esNuevo: true
    }
  ];

  todosLosParticipantes.sort((a, b) => {
    const mesA = a.fechaCumpleaños.getMonth();
    const diaA = a.fechaCumpleaños.getDate();
    const mesB = b.fechaCumpleaños.getMonth();
    const diaB = b.fechaCumpleaños.getDate();

    if (mesA !== mesB) return mesA - mesB;
    if (diaA !== diaB) return diaA - diaB;
    
    return a.fechaRegistro - b.fechaRegistro;
  });

  const posicion = todosLosParticipantes.findIndex(p => p.esNuevo);
  return posicion + 1;
};
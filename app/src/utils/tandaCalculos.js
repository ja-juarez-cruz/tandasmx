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

// ==================== TANDAS DE CUMPLEAÑOS - UTILIDADES COMPARTIDAS ====================

export const DIAS_VENTANA_CUMPLE = 3;

const NUMERALES_CUMPLE = [
  'Primer', 'Segundo', 'Tercer', 'Cuarto', 'Quinto',
  'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo',
  'Décimo Primer', 'Décimo Segundo', 'Décimo Tercer', 'Décimo Cuarto', 'Décimo Quinto',
  'Décimo Sexto', 'Décimo Séptimo', 'Décimo Octavo', 'Décimo Noveno', 'Vigésimo',
  'Vigésimo Primer', 'Vigésimo Segundo', 'Vigésimo Tercer', 'Vigésimo Cuarto', 'Vigésimo Quinto',
  'Vigésimo Sexto', 'Vigésimo Séptimo', 'Vigésimo Octavo', 'Vigésimo Noveno', 'Trigésimo',
];

/**
 * Devuelve texto ordinal para el número de cumpleaños de una ronda
 * @param {number} ronda
 * @returns {string}
 */
export const getTextoCumpleanos = (ronda) => {
  const indice = ronda - 1;
  return indice >= 0 && indice < NUMERALES_CUMPLE.length
    ? `${NUMERALES_CUMPLE[indice]} Cumpleaños`
    : `Cumpleaños ${ronda}`;
};

/**
 * Fecha del cumpleaños de un participante en el año en curso (puede ser pasada)
 * @param {object} tanda
 * @param {number} numeroRonda
 * @returns {Date|null}
 */
export const obtenerFechaCumpleAnoActual = (tanda, numeroRonda) => {
  if (tanda?.frecuencia !== 'cumpleaños') return null;
  const participante = (tanda.participantes || []).find(p => p.numeroAsignado === numeroRonda);
  if (!participante?.fechaCumpleaños) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaBase = new Date(participante.fechaCumpleaños + 'T00:00:00');
  return new Date(hoy.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
};

/**
 * Próxima fecha del cumpleaños de un participante (este año o el siguiente si ya pasó)
 * @param {object} tanda
 * @param {number} numeroRonda
 * @returns {Date|null}
 */
export const calcularFechaCumpleañosRonda = (tanda, numeroRonda) => {
  if (tanda?.frecuencia !== 'cumpleaños') return null;
  const participante = (tanda.participantes || []).find(p => p.numeroAsignado === numeroRonda);
  if (!participante?.fechaCumpleaños) return null;
  const fechaCumple = new Date(participante.fechaCumpleaños + 'T00:00:00');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let proximoCumple = new Date(fechaCumple);
  proximoCumple.setFullYear(hoy.getFullYear());
  proximoCumple.setHours(0, 0, 0, 0);
  if (proximoCumple < hoy) {
    proximoCumple.setFullYear(hoy.getFullYear() + 1);
  }
  return proximoCumple;
};

/**
 * Rango de fechas (inicio/fin) de una tanda cumpleañera basado en próximos cumpleaños
 * @param {object} tanda
 * @returns {{ inicio: Date, fin: Date }|null}
 */
export const obtenerRangoCumpleanos = (tanda) => {
  if (tanda?.frecuencia !== 'cumpleaños' || !tanda.participantes || tanda.participantes.length === 0) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const proximos = [];
  tanda.participantes.forEach(p => {
    if (p.fechaCumpleaños) {
      const fc = new Date(p.fechaCumpleaños + 'T00:00:00');
      let pc = new Date(hoy.getFullYear(), fc.getMonth(), fc.getDate());
      pc.setHours(0, 0, 0, 0);
      if (pc < hoy) pc.setFullYear(hoy.getFullYear() + 1);
      proximos.push(pc);
    }
  });
  if (proximos.length === 0) return null;
  proximos.sort((a, b) => a - b);
  return { inicio: proximos[0], fin: proximos[proximos.length - 1] };
};

/**
 * Info del próximo cumpleaños pendiente (el más cercano en el futuro)
 * @param {object} tanda
 * @returns {{ dias, ronda, nombre, fecha }|null}
 */
export const calcularProximoCumpleInfo = (tanda) => {
  if (tanda?.frecuencia !== 'cumpleaños') return null;
  const participantes = tanda.participantes || [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let proximaFecha = null;
  let proximaRonda = null;
  let proximoNombre = null;
  participantes.forEach(p => {
    if (!p.fechaCumpleaños || !p.numeroAsignado) return;
    const fechaCumple = new Date(p.fechaCumpleaños + 'T00:00:00');
    let cumpleEsteAno = new Date(hoy.getFullYear(), fechaCumple.getMonth(), fechaCumple.getDate());
    cumpleEsteAno.setHours(0, 0, 0, 0);
    if (cumpleEsteAno < hoy) {
      cumpleEsteAno.setFullYear(hoy.getFullYear() + 1);
    }
    if (proximaFecha === null || cumpleEsteAno < proximaFecha) {
      proximaFecha = cumpleEsteAno;
      proximaRonda = p.numeroAsignado;
      proximoNombre = p.nombre;
    }
  });
  if (!proximaFecha) return null;
  const dias = Math.ceil((proximaFecha - hoy) / (1000 * 60 * 60 * 24));
  return { dias, ronda: proximaRonda, nombre: proximoNombre, fecha: proximaFecha };
};

/**
 * Participantes cuyo cumpleaños fue el más reciente fuera de la ventana de días
 * @param {object} tanda
 * @returns {Array}
 */
export const calcularCumpleañosRecientes = (tanda) => {
  if (tanda?.frecuencia !== 'cumpleaños') return [];
  const participantes = tanda.participantes || [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let fechaMasReciente = null;
  participantes.forEach(p => {
    if (!p.fechaCumpleaños) return;
    const fechaBase = new Date(p.fechaCumpleaños + 'T00:00:00');
    const cumpleEsteAno = new Date(hoy.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
    const diasDesde = Math.floor((hoy - cumpleEsteAno) / (1000 * 60 * 60 * 24));
    if (diasDesde > DIAS_VENTANA_CUMPLE) {
      if (!fechaMasReciente || cumpleEsteAno > fechaMasReciente) fechaMasReciente = new Date(cumpleEsteAno);
    }
  });
  if (!fechaMasReciente) return [];
  return participantes
    .filter(p => {
      if (!p.fechaCumpleaños) return false;
      const fechaBase = new Date(p.fechaCumpleaños + 'T00:00:00');
      const cumpleEsteAno = new Date(hoy.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
      return cumpleEsteAno.getTime() === fechaMasReciente.getTime();
    })
    .map(p => {
      const fechaBase = new Date(p.fechaCumpleaños + 'T00:00:00');
      const cumpleEsteAno = new Date(hoy.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
      return { ...p, diasDesde: Math.floor((hoy - cumpleEsteAno) / (1000 * 60 * 60 * 24)) };
    });
};

/**
 * Participantes que comparten la próxima fecha de cumpleaños
 * @param {object} tanda
 * @param {{ fecha: Date }|null} proximoCumpleInfo
 * @returns {Array}
 */
export const calcularCumpleañosProximos = (tanda, proximoCumpleInfo) => {
  if (tanda?.frecuencia !== 'cumpleaños') return [];
  const participantes = tanda.participantes || [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const proximaFecha = proximoCumpleInfo?.fecha;
  if (!proximaFecha) return [];
  return participantes.filter(p => {
    if (!p.fechaCumpleaños) return false;
    const fechaBase = new Date(p.fechaCumpleaños + 'T00:00:00');
    let cumple = new Date(hoy.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
    if (cumple < hoy) cumple.setFullYear(hoy.getFullYear() + 1);
    return cumple.getTime() === proximaFecha.getTime();
  });
};

/**
 * Estado del cumpleaños de la ronda actual: 'actual' (≤ ventana), 'reciente' (> ventana), 'futuro'
 * @param {object} tanda
 * @param {number} rondaActual
 * @returns {{ estado: string, diasDesdeCumple?: number, diasFaltan?: number }|null}
 */
export const calcularEstadoCumpleRondaActual = (tanda, rondaActual) => {
  if (tanda?.frecuencia !== 'cumpleaños') return null;
  const fechaCumple = obtenerFechaCumpleAnoActual(tanda, rondaActual);
  if (!fechaCumple) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diasDesdeCumple = Math.floor((hoy - fechaCumple) / (1000 * 60 * 60 * 24));
  if (diasDesdeCumple > DIAS_VENTANA_CUMPLE) return { estado: 'reciente', diasDesdeCumple };
  if (diasDesdeCumple >= 0) return { estado: 'actual', diasDesdeCumple };
  return { estado: 'futuro', diasFaltan: -diasDesdeCumple };
};

/**
 * Clasifica todos los participantes de una tanda cumpleañera en actuales / recientes / próximos
 * @param {object} tanda
 * @returns {object|null}
 */
export const calcularProximoCumpleanos = (tanda) => {
  if (tanda?.frecuencia !== 'cumpleaños' || !tanda.participantes || tanda.participantes.length === 0) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const participantes = [...tanda.participantes]
    .filter(p => p.fechaCumpleaños)
    .sort((a, b) => a.numeroAsignado - b.numeroAsignado);
  if (participantes.length === 0) return null;

  const clasificados = participantes.map(p => {
    const fechaBase = new Date(p.fechaCumpleaños + 'T00:00:00');
    const cumpleEsteAno = new Date(hoy.getFullYear(), fechaBase.getMonth(), fechaBase.getDate());
    const diasDesde = Math.floor((hoy - cumpleEsteAno) / (1000 * 60 * 60 * 24));
    return { ...p, diasDesde, cumpleEsteAno };
  });

  const cumpleañerosActuales = clasificados
    .filter(p => p.diasDesde >= -DIAS_VENTANA_CUMPLE && p.diasDesde <= DIAS_VENTANA_CUMPLE)
    .sort((a, b) => a.diasDesde - b.diasDesde);

  const pasadosExternos = clasificados.filter(p => p.diasDesde > DIAS_VENTANA_CUMPLE);
  let cumpleañerosRecientes = [];
  if (pasadosExternos.length > 0) {
    const fechaMaxReciente = pasadosExternos.reduce(
      (max, p) => p.cumpleEsteAno.getTime() > max.getTime() ? p.cumpleEsteAno : max,
      pasadosExternos[0].cumpleEsteAno
    );
    cumpleañerosRecientes = pasadosExternos.filter(
      p => p.cumpleEsteAno.getTime() === fechaMaxReciente.getTime()
    );
  }

  const conDiasHasta = clasificados
    .filter(p => p.diasDesde < -DIAS_VENTANA_CUMPLE || p.diasDesde > DIAS_VENTANA_CUMPLE)
    .map(p => {
      let diasHasta;
      if (p.diasDesde < -DIAS_VENTANA_CUMPLE) {
        diasHasta = -p.diasDesde;
      } else {
        const nextYear = new Date(p.cumpleEsteAno);
        nextYear.setFullYear(hoy.getFullYear() + 1);
        diasHasta = Math.ceil((nextYear - hoy) / (1000 * 60 * 60 * 24));
      }
      return { ...p, diasHasta };
    })
    .sort((a, b) => a.diasHasta - b.diasHasta);

  let cumpleañerosProximos = [];
  let diasHastaProximo = null;
  if (conDiasHasta.length > 0) {
    diasHastaProximo = conDiasHasta[0].diasHasta;
    cumpleañerosProximos = conDiasHasta.filter(p => p.diasHasta === diasHastaProximo);
  }

  return {
    cumpleañerosActuales,
    cumpleañerosRecientes,
    cumpleañerosProximos,
    diasHastaProximo,
    fecha: cumpleañerosProximos[0]?.cumpleEsteAno || null,
    diasFaltantesProximo: diasHastaProximo,
    participante: cumpleañerosProximos[0] || null,
    cantidadCumpleañeros: cumpleañerosActuales.length || cumpleañerosProximos.length,
    cumpleañerosHoy: clasificados.filter(p => p.diasDesde === 0),
  };
};

/**
 * Estado de una tanda: 'vigentes', 'pasadas' o 'proximas'
 * @param {object} tanda
 * @returns {string}
 */
export const calcularEstadoTanda = (tanda) => {
  if (tanda.frecuencia === 'cumpleaños') {
    const rango = obtenerRangoCumpleanos(tanda);
    if (!rango) return 'proximas';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    if (hoy < rango.inicio) return 'proximas';
    if (hoy > rango.fin) return 'pasadas';
    return 'vigentes';
  }
  if (!tanda.fechaInicio) return 'proximas';
  const fechaActual = new Date(); fechaActual.setHours(0, 0, 0, 0);
  const fechasRondas = calcularFechasRondas(tanda.fechaInicio, tanda.totalRondas, tanda.frecuencia);
  if (fechasRondas.length === 0) return 'proximas';
  const fechaInicio = fechasRondas[0].fechaInicio; fechaInicio.setHours(0, 0, 0, 0);
  const fechaFin = new Date(fechasRondas[fechasRondas.length - 1].fechaLimite); fechaFin.setHours(23, 59, 59, 999);
  if (fechaActual < fechaInicio) return 'proximas';
  if (fechaActual > fechaFin) return 'pasadas';
  return 'vigentes';
};
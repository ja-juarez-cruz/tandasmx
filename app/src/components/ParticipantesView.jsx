// ParticipantesView.jsx - REFACTORIZADO con apiFetch
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Edit, Trash2, X, Save, Phone, Mail, MessageCircle, Link as LinkIcon, Copy, Check, ArrowLeft, AlertCircle, MessageSquare, FileText, MoreVertical, Calendar, Gift } from 'lucide-react';
import { calcularFechaRonda, calcularNumeroAutomaticoCumpleanos, obtenerRondaActualCumpleanos, calcularRondaActual } from '../utils/tandaCalculos';
import { apiFetch } from '../utils/apiFetch';

const BASE_URL_ESTATIC_WEB = "https://app-tandasmx.s3.us-east-1.amazonaws.com";

export default function ParticipantesView({ tandaData, setTandaData, loadAdminData, onBack }) {
  const navigate = useNavigate();
  
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showMensajeModal, setShowMensajeModal] = useState(false);
  const [showComentarioModal, setShowComentarioModal] = useState(false);
  const [participanteAEliminar, setParticipanteAEliminar] = useState(null);
  const [editingParticipante, setEditingParticipante] = useState(null);
  const [participanteSeleccionado, setParticipanteSeleccionado] = useState(null);
  const [tipoMensaje, setTipoMensaje] = useState(null);
  const [mensajeTexto, setMensajeTexto] = useState('');
  const [comentarioTexto, setComentarioTexto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [linkRegistro, setLinkRegistro] = useState(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    telefono: '',
    email: '',
    numerosAsignados: [],
    fechaCumpleaños: ''
  });

  const esCumpleañera = tandaData?.frecuencia === 'cumpleaños';

  // ====================================
  // FUNCIONES AUXILIARES
  // ====================================
  
  const numerosDisponibles = () => {
    if (!tandaData || esCumpleañera) return [];
    const numerosOcupados = tandaData.participantes?.map(p => p.numeroAsignado) || [];
    const todos = Array.from({ length: tandaData.totalRondas }, (_, i) => i + 1);
    return todos.filter(n => !numerosOcupados.includes(n));
  };

  const ordenarParticipantes = (participantes) => {
    if (esCumpleañera) {
      return [...participantes].sort((a, b) => {
        const [fechaA, fechaB] = [new Date(a.fechaCumpleaños), new Date(b.fechaCumpleaños)];
        const diffMes = fechaA.getMonth() - fechaB.getMonth();
        if (diffMes !== 0) return diffMes;
        const diffDia = fechaA.getDate() - fechaB.getDate();
        if (diffDia !== 0) return diffDia;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
    }
    return [...participantes].sort((a, b) => a.numeroAsignado - b.numeroAsignado);
  };

  // Helper para construir la URL base de participantes
  const participantesUrl = (participanteId = '') => 
    `/tandas/${tandaData.tandaId}/participantes${participanteId ? `/${participanteId}` : ''}`;

  // ====================================
  // API CALLS (todos usan apiFetch)
  // ====================================
  
  const verificarLinkVigente = async () => {
    try {
      const data = await apiFetch(`/tandas/${tandaData.tandaId}/registro-link/activo`);
      
      if (data.success && data.data) {
        const ruta = esCumpleañera ? 'registro-cumple' : 'registro';
        setLinkRegistro({
          url: `${BASE_URL_ESTATIC_WEB}/index.html#/${ruta}/${data.data.token}`,
          token: data.data.token,
          expiracion: data.data.expiracion,
          duracionHoras: data.data.duracionHoras
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error verificando link:', error);
      return false;
    }
  };

  const generarLinkRegistro = async (duracionHoras) => {
    setLoading(true);
    setError(null);
    
    try {
      if (await verificarLinkVigente()) { setLoading(false); return; }

      const data = await apiFetch(`/tandas/${tandaData.tandaId}/registro-link`, {
        method: 'POST',
        body: JSON.stringify({ duracionHoras })
      });

      if (data.success) {
        const ruta = esCumpleañera ? 'registro-cumple' : 'registro';
        setLinkRegistro({
          url: `${BASE_URL_ESTATIC_WEB}/index.html#/${ruta}/${data.data.token}`,
          token: data.data.token,
          expiracion: data.data.expiracion,
          duracionHoras
        });
      }
    } catch (error) {
      console.error('Error generando link:', error);
      setError(error.message || 'Error al generar link de registro');
    } finally {
      setLoading(false);
    }
  };

  const guardarComentario = async () => {
    if (!participanteSeleccionado) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch(participantesUrl(participanteSeleccionado.participanteId), {
        method: 'PUT',
        body: JSON.stringify({
          nombre: participanteSeleccionado.nombre,
          telefono: participanteSeleccionado.telefono,
          email: participanteSeleccionado.email,
          numeroAsignado: participanteSeleccionado.numeroAsignado,
          fechaCumpleaños: participanteSeleccionado.fechaCumpleaños,
          comentarios: comentarioTexto || undefined
        })
      });

      if (data.success) {
        await loadAdminData();
        setShowComentarioModal(false);
        setParticipanteSeleccionado(null);
        setComentarioTexto('');
      }
    } catch (error) {
      console.error('Error guardando comentario:', error);
      setError(error.message || 'Error al guardar comentario');
    } finally {
      setLoading(false);
    }
  };

  const crearParticipante = async (body) => {
    return await apiFetch(participantesUrl(), {
      method: 'POST',
      body: JSON.stringify(body)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (esCumpleañera && !formData.fechaCumpleaños) {
        throw new Error('La fecha de cumpleaños es obligatoria para tandas cumpleañeras');
      }

      if (editingParticipante) {
        // EDITAR EXISTENTE
        const requestBody = {
          nombre: formData.nombre,
          telefono: formData.telefono,
          email: formData.email || undefined,
          numeroAsignado: formData.numerosAsignados[0],
          ...(esCumpleañera && { fechaCumpleaños: formData.fechaCumpleaños })
        };

        await apiFetch(participantesUrl(editingParticipante.participanteId), {
          method: 'PUT',
          body: JSON.stringify(requestBody)
        });

        await loadAdminData();
        closeModal();
      } else if (esCumpleañera) {
        // CREAR - Tanda cumpleañera
        await crearParticipante({
          nombre: formData.nombre,
          telefono: formData.telefono,
          email: formData.email || undefined,
          numeroAsignado: calcularNumeroAutomaticoCumpleanos(tandaData, formData.fechaCumpleaños),
          fechaCumpleaños: formData.fechaCumpleaños
        });

        await loadAdminData();
        closeModal();
      } else {
        // CREAR - Tanda normal (múltiples números)
        const maxNumeros = Math.floor(tandaData.totalRondas * 0.5);
        
        if (formData.numerosAsignados.length > maxNumeros) {
          throw new Error(`Solo puedes seleccionar hasta ${maxNumeros} números (50% del total)`);
        }
        if (formData.numerosAsignados.length === 0) {
          throw new Error('Debes seleccionar al menos un número');
        }

        const promesas = formData.numerosAsignados.map(num =>
          crearParticipante({
            nombre: formData.nombre,
            telefono: formData.telefono,
            email: formData.email || undefined,
            numeroAsignado: parseInt(num)
          })
        );

        await Promise.all(promesas);
        await loadAdminData();
        closeModal();
      }
    } catch (error) {
      console.error('Error guardando participante:', error);
      setError(error.message || 'Error al guardar participante');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!participanteAEliminar) return;
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch(participantesUrl(participanteAEliminar.participanteId), {
        method: 'DELETE'
      });

      if (data.success) {
        setShowDeleteModal(false);
        setParticipanteAEliminar(null);
        await loadAdminData();
      }
    } catch (error) {
      console.error('Error eliminando participante:', error);
      setError(error.message || 'Error al eliminar participante');
    } finally {
      setLoading(false);
    }
  };

  // ====================================
  // HANDLERS
  // ====================================
  
  const copiarLink = () => {
    if (linkRegistro?.url) {
      navigator.clipboard.writeText(linkRegistro.url);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    }
  };

  const compartirWhatsApp = () => {
    if (!linkRegistro?.url) return;
    
    const infoTanda = esCumpleañera
      ? `🎂 *¡Únete a nuestra Tanda Cumpleañera!*\n\n📋 *${tandaData.nombre}*\n\n💰 Aportación por persona: $${tandaData.montoPorRonda?.toLocaleString()}\n👥 Total de participantes: ${tandaData.totalRondas}\n🎁 Recibirás en tu cumpleaños: $${(tandaData.montoPorRonda * (tandaData.totalRondas - 1))?.toLocaleString()}`
      : `🎉 *¡Únete a nuestra Tanda!*\n\n📋 *${tandaData.nombre}*\n\n💰 Monto por ronda: $${tandaData.montoPorRonda?.toLocaleString()}\n📅 Total de rondas: ${tandaData.totalRondas}\n⏰ Frecuencia: ${tandaData.frecuencia}\n📅 Fecha Inicio: ${new Date(tandaData.fechaInicio + 'T00:00:00')?.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;

    const instrucciones = esCumpleañera
      ? `1. Haz clic en el link\n2. Ingresa tu nombre y teléfono\n3. *IMPORTANTE:* Ingresa tu fecha de cumpleaños\n4. Tu número se asignará automáticamente según tu fecha\n5. ¡Listo! Recibirás el dinero en tu cumpleaños`
      : `1. Haz clic en el link\n2. Ingresa tu nombre y teléfono\n3. Selecciona tu(s) número(s) favorito(s)\n4. ¡Listo! Serás parte de la tanda`;

    const mensaje = `${infoTanda}\n\n🔗 *Regístrate aquí:*\n${linkRegistro.url}\n\n✨ *Instrucciones:*\n${instrucciones}\n\n⏱️ *Link válido por ${linkRegistro.duracionHoras} horas*`;

    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  const generarLinkPublico = () => `${BASE_URL_ESTATIC_WEB}/index.html#/public-board/${tandaData.tandaId}`;

  const enviarMensaje = (participante, tipo) => {
    const totalRecibir = tandaData.montoPorRonda * (tandaData.totalRondas - 1);
    const rondaActual = calcularRondaActual(tandaData);
    
    const mensajes = {
      realizado: `¡Hola ${participante.nombre}! 👋\n\n✅ *Confirmación de Pago*\n\nTu pago de la tanda *${tandaData.nombre}* se ha realizado correctamente.\n\n💰 *Monto a recibir:* $${totalRecibir.toLocaleString()}\n\n¡Gracias por tu confianza! 🎉`,
      pendiente: `¡Hola ${participante.nombre}! 👋\n\n📢 *Recordatorio de Pago*\n\nTe recordamos que tienes un pago pendiente en la tanda *${tandaData.nombre}*.\n\n📋 *Detalles:*\n- Ronda actual: ${rondaActual}\n- Monto por ronda: $${tandaData.montoPorRonda.toLocaleString()}\n\nPor favor, realiza tu pago lo antes posible para mantenernos al día.\n\nPuedes ver más detalles en:\n${generarLinkPublico()}\n\n¡Gracias por tu atención! 🙏`
    };

    setParticipanteSeleccionado(participante);
    setTipoMensaje(tipo);
    setMensajeTexto(mensajes[tipo]);
    setShowMensajeModal(true);
  };

  const confirmarEnvioWhatsApp = () => {
    if (!participanteSeleccionado || !mensajeTexto) return;
    const telefono = participanteSeleccionado.telefono.replace(/\D/g, '');
    window.open(`https://wa.me/521${telefono}?text=${encodeURIComponent(mensajeTexto)}`, '_blank');
    setShowMensajeModal(false);
    setParticipanteSeleccionado(null);
    setMensajeTexto('');
    setTipoMensaje(null);
  };

  const abrirComentarioModal = (participante) => {
    setParticipanteSeleccionado(participante);
    setComentarioTexto(participante.comentarios || '');
    setShowComentarioModal(true);
  };

  const openModal = (participante = null) => {
    if (participante) {
      setEditingParticipante(participante);
      setFormData({
        nombre: participante.nombre,
        telefono: participante.telefono,
        email: participante.email || '',
        numerosAsignados: [participante.numeroAsignado],
        fechaCumpleaños: participante.fechaCumpleaños || ''
      });
    } else {
      setEditingParticipante(null);
      setFormData({ nombre: '', telefono: '', email: '', numerosAsignados: [], fechaCumpleaños: '' });
    }
    setShowModal(true);
    setError(null);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingParticipante(null);
    setFormData({ nombre: '', telefono: '', email: '', numerosAsignados: [], fechaCumpleaños: '' });
    setError(null);
  };

  const openDeleteModal = (participante) => {
    setParticipanteAEliminar(participante);
    setShowDeleteModal(true);
    setError(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleNumero = (numero) => {
    setFormData(prev => {
      const maxNumeros = Math.floor(tandaData.totalRondas * 0.5);
      if (prev.numerosAsignados.includes(numero)) {
        return { ...prev, numerosAsignados: prev.numerosAsignados.filter(n => n !== numero) };
      }
      if (prev.numerosAsignados.length >= maxNumeros) {
        setError(`Solo puedes seleccionar hasta ${maxNumeros} números (50% del total)`);
        setTimeout(() => setError(null), 3000);
        return prev;
      }
      return { ...prev, numerosAsignados: [...prev.numerosAsignados, numero].sort((a, b) => a - b) };
    });
  };

  // ====================================
  // RENDER
  // ====================================
  
  if (!tandaData) return null;

  const participantes = tandaData.participantes || [];
  const disponibles = numerosDisponibles();
  const participantesOrdenados = ordenarParticipantes(participantes);
  const numeroActualTanda = esCumpleañera 
    ? obtenerRondaActualCumpleanos(tandaData)
    : calcularRondaActual(tandaData);

  
  return (
    <div className="space-y-6">
      {/* Header con navegación */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                {esCumpleañera ? <Gift className="w-7 h-7 text-blue-600" /> : <Users className="w-7 h-7 text-blue-600" />}
                Participantes
                {esCumpleañera && <span className="text-lg">🎂</span>}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {tandaData.nombre} • {participantes.length} de {tandaData.totalRondas} registrados
                {esCumpleañera && <span className="ml-2 text-blue-600 font-semibold">• Tanda Cumpleañera</span>}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => openModal()}
            disabled={participantes.length >= tandaData.totalRondas}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
          >
            <Plus className="w-4 h-4" />
            Agregar
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-500 rounded-full"
            style={{ width: `${(participantes.length / tandaData.totalRondas) * 100}%` }}
          ></div>
        </div>
        <p className="text-xs text-gray-600 mt-2 text-right">
          {Math.round((participantes.length / tandaData.totalRondas) * 100)}% completo
        </p>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b-2 border-gray-200">
            <tr>
              <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">#</th>
              <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Participante</th>
              <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Contacto</th>
              {esCumpleañera && (
                <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Cumpleaños</th>
              )}
              <th className="hidden md:table-cell px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase">Comentarios</th>
              <th className="hidden md:table-cell px-6 py-4 text-right text-xs font-bold text-gray-600 uppercase">Acciones</th>
              <th className="md:hidden px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Participantes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {participantesOrdenados.map((participante, index) => {
              const esProximo = participante.numeroAsignado === numeroActualTanda;
              const fechaInicio = tandaData.fechaInicio ? new Date(tandaData.fechaInicio + 'T00:00:00') : null;
              const fechaPago = fechaInicio ? calcularFechaRonda(fechaInicio, participante.numeroAsignado, tandaData.frecuencia, esCumpleañera, participante.fechaCumpleaños) : null;
              const menuEstaAbierto = menuAbierto === participante.participanteId;
              const totalParticipantes = participantesOrdenados.length;
              const esDeLosFinal = totalParticipantes > 5 && index >= totalParticipantes - 3;

              return (
                <tr 
                  key={participante.participanteId}
                  className={`hover:bg-gray-50 transition-colors ${esProximo ? 'bg-green-50' : ''}`}
                >
                  {/* DESKTOP VIEW */}
                  <td className="hidden md:table-cell px-6 py-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-md ${
                      esProximo 
                        ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' 
                        : 'bg-gradient-to-br from-blue-600 to-blue-800 text-white'
                    }`}>
                      {participante.numeroAsignado}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <div className="font-semibold text-gray-800">
                      {participante.nombre}
                    </div>
                    {esProximo && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-bold mt-1">
                        ← Turno actual
                      </span>
                    )}
                    {fechaPago && (
                      <div className="text-xs text-blue-600 font-semibold mt-1">
                        {esCumpleañera ? '🎂' : '📅'} {fechaPago.toLocaleDateString('es-MX', { 
                          day: 'numeric', 
                          month: 'short',
                          year: esCumpleañera ? undefined : 'numeric'
                        })}
                      </div>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4" />
                        {participante.telefono}
                      </div>
                      {participante.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail className="w-4 h-4" />
                          {participante.email}
                        </div>
                      )}
                    </div>
                  </td>
                  {esCumpleañera && (
                    <td className="hidden md:table-cell px-6 py-4">
                      {participante.fechaCumpleaños ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-blue-600">
                            {fechaPago?.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No registrado</span>
                      )}
                    </td>
                  )}
                  <td className="hidden md:table-cell px-6 py-4">
                    {participante.comentarios ? (
                      <button
                        onClick={() => abrirComentarioModal(participante)}
                        className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors max-w-xs"
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{participante.comentarios}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => abrirComentarioModal(participante)}
                        className="text-sm text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        Agregar nota...
                      </button>
                    )}
                  </td>
                  <td className="hidden md:table-cell px-6 py-4">
                    <div className="flex items-center justify-end gap-2 flex-nowrap">
                      <button onClick={() => enviarMensaje(participante, 'realizado')} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Confirmar pago">
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <button onClick={() => enviarMensaje(participante, 'pendiente')} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Recordar pago">
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <button onClick={() => abrirComentarioModal(participante)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Comentarios">
                        <MessageSquare className="w-5 h-5" />
                      </button>
                      <div className="h-6 w-px bg-gray-300 mx-1"></div>
                      <button onClick={() => openModal(participante)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button onClick={() => openDeleteModal(participante)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>

                  {/* MOBILE VIEW */}
                  <td className="md:hidden px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0 ${
                        esProximo 
                          ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white' 
                          : 'bg-gradient-to-br from-blue-600 to-blue-800 text-white'
                      }`}>
                        {participante.numeroAsignado}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm mb-0.5">
                          {participante.nombre}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-1">
                          <Phone className="w-3 h-3" />
                          <span className="truncate">{participante.telefono}</span>
                        </div>
                        {esCumpleañera && participante.fechaCumpleaños && fechaPago && (
                          <div className="flex items-center gap-1 text-xs text-blue-600 font-semibold mb-1">
                            <Calendar className="w-3 h-3" />
                            {fechaPago.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                        {!esCumpleañera && fechaPago && (
                          <div className="text-xs text-blue-600 font-semibold">
                            📅 {fechaPago.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                        {esProximo && (
                          <span className="inline-block text-xs text-green-600 font-bold mt-1">← Turno actual</span>
                        )}
                      </div>

                      {/* Menú desplegable móvil */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setMenuAbierto(menuEstaAbierto ? null : participante.participanteId)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>

                        {menuEstaAbierto && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)}></div>
                            <div className={`absolute right-0 ${esDeLosFinal ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 bg-white rounded-xl shadow-2xl border-2 border-gray-200 py-2 z-20 animate-fadeIn`}>
                              <div className="px-3 py-2 border-b border-gray-200">
                                <p className="text-xs font-bold text-gray-500 uppercase">Acciones</p>
                              </div>
                              <div className="px-2 py-1 max-h-80 overflow-y-auto">
                                {[
                                  { action: () => enviarMensaje(participante, 'realizado'), icon: MessageCircle, color: 'green', label: 'Confirmar Pago', desc: 'Mensaje de pago realizado' },
                                  { action: () => enviarMensaje(participante, 'pendiente'), icon: MessageCircle, color: 'amber', label: 'Recordar Pago', desc: 'Enviar recordatorio' },
                                  { action: () => abrirComentarioModal(participante), icon: MessageSquare, color: 'purple', label: 'Comentarios', desc: participante.comentarios ? 'Ver/editar notas' : 'Agregar nota' }
                                ].map((item, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => { item.action(); setMenuAbierto(null); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-${item.color}-50 rounded-lg transition-colors`}
                                  >
                                    <item.icon className={`w-4 h-4 text-${item.color}-600`} />
                                    <div>
                                      <p className="font-semibold">{item.label}</p>
                                      <p className="text-xs text-gray-500">{item.desc}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                              <div className="h-px bg-gray-200 my-1"></div>
                              <div className="px-2 py-1">
                                {[
                                  { action: () => openModal(participante), icon: Edit, color: 'blue', label: 'Editar' },
                                  { action: () => openDeleteModal(participante), icon: Trash2, color: 'red', label: 'Eliminar' }
                                ].map((item, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => { item.action(); setMenuAbierto(null); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-${item.color}-50 rounded-lg transition-colors`}
                                  >
                                    <item.icon className={`w-4 h-4 text-${item.color}-600`} />
                                    <p className="font-semibold">{item.label}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Error Global */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-600 text-sm font-semibold">{error}</p>
          </div>
        </div>
      )}

      {/* Alerta para tanda cumpleañera sin participantes */}
      {esCumpleañera && participantes.length === 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Gift className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-bold mb-2">🎂 Tanda Cumpleañera - Asignación Automática:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Los números se asignan automáticamente por fecha de cumpleaños</li>
                <li>El número 1 es para quien cumple primero en el año</li>
                <li>Si dos personas cumplen el mismo día, se asigna por orden de registro</li>
                <li>El calendario se genera cuando todos estén registrados</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {participantes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="p-4 bg-blue-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              {esCumpleañera ? <Gift className="w-10 h-10 text-blue-600" /> : <Users className="w-10 h-10 text-blue-600" />}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Comienza a Agregar Participantes</h3>
            <p className="text-gray-600 mb-6">
              {esCumpleañera 
                ? 'Los números se asignan automáticamente por fecha de cumpleaños'
                : 'Puedes invitar personas de dos formas diferentes'}
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {((esCumpleañera && participantes.length < tandaData.totalRondas) || (!esCumpleañera && disponibles.length > 0)) && (
                <button
                  onClick={async () => { setShowLinkModal(true); await verificarLinkVigente(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Link de Registro</span>
                  <span className="sm:hidden">Link</span>
                  {!esCumpleañera && disponibles.length > 0 && (
                    <div className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{disponibles.length}</div>
                  )}
                </button>
              )}
              <button
                onClick={() => openModal()}
                disabled={esCumpleañera && participantes.length >= tandaData.totalRondas}
                className={`p-6 bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 transition-all group disabled:opacity-50 disabled:cursor-not-allowed ${
                  (esCumpleañera && participantes.length < tandaData.totalRondas) || !esCumpleañera ? 'sm:col-span-2' : ''
                }`}
              >
                <Plus className="w-8 h-8 text-blue-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h4 className="font-bold text-gray-800 mb-2">Agregar Manual</h4>
                <p className="text-xs text-gray-600">
                  {esCumpleañera ? 'Registra participantes con su fecha de cumpleaños' : 'Registra tú mismo a los participantes'}
                </p>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-sky-50 border-b-2 border-blue-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  {esCumpleañera ? <Gift className="w-5 h-5 text-blue-600" /> : <Users className="w-5 h-5 text-blue-600" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Lista de Participantes {esCumpleañera && '🎂'}</h3>
                  <p className="text-xs text-gray-600">
                    {esCumpleañera 
                      ? participantes.length < tandaData.totalRondas ? `${tandaData.totalRondas - participantes.length} lugares disponibles` : '¡Tanda completa!'
                      : disponibles.length > 0 ? `${disponibles.length} número${disponibles.length !== 1 ? 's' : ''} disponible${disponibles.length !== 1 ? 's' : ''}` : '¡Tanda completa!'}
                  </p>
                </div>
              </div>
              
              {((esCumpleañera && participantes.length < tandaData.totalRondas) || (!esCumpleañera && disponibles.length > 0)) && (
                <button
                  onClick={async () => { setShowLinkModal(true); await verificarLinkVigente(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Link de Registro</span>
                  <span className="sm:hidden">Link</span>
                  {!esCumpleañera && disponibles.length > 0 && (
                    <div className="px-2 py-0.5 bg-white/20 rounded-full text-xs">{disponibles.length}</div>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-6 text-white rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">
                  {editingParticipante ? 'Editar Participante' : 'Agregar Participante'}
                  {esCumpleañera && ' 🎂'}
                </h3>
                <button onClick={closeModal} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label htmlFor="modal-nombre" className="block text-sm font-semibold text-gray-700 mb-2">Nombre Completo *</label>
                  <input id="modal-nombre" name="nombre" type="text" value={formData.nombre} onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="Juan Pérez" required />
                </div>

                <div>
                  <label htmlFor="modal-telefono" className="block text-sm font-semibold text-gray-700 mb-2">Teléfono *</label>
                  <input id="modal-telefono" name="telefono" type="tel" value={formData.telefono} onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="5512345678" pattern="[0-9]{10}" required />
                  <p className="mt-1.5 text-xs text-gray-500">10 dígitos sin espacios</p>
                </div>

                <div>
                  <label htmlFor="modal-email" className="block text-sm font-semibold text-gray-700 mb-2">Email (opcional)</label>
                  <input id="modal-email" name="email" type="email" value={formData.email} onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                    placeholder="juan@email.com" />
                </div>

                {esCumpleañera && (
                  <div>
                    <label htmlFor="modal-cumpleaños" className="block text-sm font-semibold text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />Fecha de Cumpleaños *
                    </label>
                    <input id="modal-cumpleaños" name="fechaCumpleaños" type="date" value={formData.fechaCumpleaños} onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all" required />
                    <div className="mt-2 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                      <p className="text-xs text-blue-800 font-semibold flex items-start gap-2">
                        <Gift className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>
                          {formData.fechaCumpleaños 
                            ? `Tu número será: ${calcularNumeroAutomaticoCumpleanos(formData.fechaCumpleaños)} (asignado automáticamente por fecha)`
                            : 'El número se asignará automáticamente según tu fecha de cumpleaños'}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {!esCumpleañera && editingParticipante && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Número Asignado</label>
                    <div className="flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-md">
                        {formData.numerosAsignados[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">Número {formData.numerosAsignados[0]}</p>
                        <p className="text-xs text-gray-500">No se puede cambiar en edición</p>
                      </div>
                    </div>
                  </div>
                )}

                {!esCumpleañera && !editingParticipante && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Números a Asignar *</label>
                    <div className="mb-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                      <p className="text-xs text-blue-800 font-semibold mb-1">📋 Hasta {Math.floor(tandaData.totalRondas * 0.5)} números</p>
                      <p className="text-xs text-blue-700">
                        {formData.numerosAsignados.length > 0
                          ? <>✅ Seleccionados: {formData.numerosAsignados.join(', ')}</>
                          : '👆 Selecciona los números'}
                      </p>
                    </div>
                    <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto p-2 border-2 border-gray-200 rounded-xl bg-gray-50">
                      {disponibles.map(numero => (
                        <button
                          key={numero} type="button" onClick={() => toggleNumero(numero)}
                          className={`aspect-square rounded-lg font-bold text-sm transition-all ${
                            formData.numerosAsignados.includes(numero)
                              ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg scale-105 ring-2 ring-blue-300'
                              : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-blue-500 hover:shadow-md hover:scale-105'
                          }`}
                        >
                          {numero}
                        </button>
                      ))}
                    </div>
                    {formData.numerosAsignados.length > 0 && (
                      <button type="button" onClick={() => setFormData(prev => ({ ...prev, numerosAsignados: [] }))}
                        className="mt-2 text-xs text-gray-600 hover:text-red-600 underline">
                        Limpiar selección
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-gray-50 border-t-2 border-gray-200 rounded-b-2xl flex-shrink-0">
                <div className="flex gap-3">
                  <button type="button" onClick={closeModal}
                    className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading || (!esCumpleañera && !editingParticipante && formData.numerosAsignados.length === 0)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Guardando...</>
                    ) : (
                      <><Save className="w-5 h-5" />{editingParticipante ? 'Actualizar' : 'Guardar'}</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Eliminar */}
      {showDeleteModal && participanteAEliminar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/20 rounded-xl"><Trash2 className="w-8 h-8" /></div>
                <div>
                  <h3 className="text-xl font-bold">Eliminar Participante</h3>
                  <p className="text-sm opacity-90">Acción irreversible</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 border-2 border-gray-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-lg flex items-center justify-center font-bold">
                    {participanteAEliminar.numeroAsignado}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{participanteAEliminar.nombre}</p>
                    <p className="text-sm text-gray-600">{participanteAEliminar.telefono}</p>
                  </div>
                </div>
              </div>
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-semibold mb-2">Advertencia:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Se liberará el número {participanteAEliminar.numeroAsignado}</li>
                      <li>Se eliminarán registros de pagos</li>
                      <li>No recibirá más notificaciones</li>
                      {esCumpleañera && <li>Se recalcularán los números de los demás participantes</li>}
                    </ul>
                  </div>
                </div>
              </div>
              {error && (
                <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-xl">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteModal(false); setParticipanteAEliminar(null); setError(null); }} disabled={loading}
                  className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={handleDelete} disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? (
                    <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>Eliminando...</>
                  ) : (
                    <><Trash2 className="w-5 h-5" />Eliminar</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Vista Previa Mensaje WhatsApp */}
      {showMensajeModal && participanteSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] shadow-2xl flex flex-col">
            <div className={`p-6 text-white flex-shrink-0 ${tipoMensaje === 'realizado' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-amber-500 to-orange-600'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-8 h-8" />
                  <div>
                    <h3 className="text-xl font-bold">Vista Previa del Mensaje</h3>
                    <p className="text-sm opacity-90">Para: {participanteSeleccionado.nombre}</p>
                  </div>
                </div>
                <button onClick={() => { setShowMensajeModal(false); setParticipanteSeleccionado(null); setMensajeTexto(''); setTipoMensaje(null); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje:</label>
                <textarea value={mensajeTexto} onChange={(e) => setMensajeTexto(e.target.value)} rows={12}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all font-mono text-sm resize-none"
                  placeholder="Edita el mensaje aquí..." />
                <p className="text-xs text-gray-500 mt-2">{mensajeTexto.length} caracteres</p>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <Phone className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    <p className="font-semibold mb-1">Se enviará a:</p>
                    <p>{participanteSeleccionado.telefono}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t-2 border-gray-200 rounded-b-2xl flex-shrink-0">
              <div className="flex gap-3">
                <button onClick={() => { setShowMensajeModal(false); setParticipanteSeleccionado(null); setMensajeTexto(''); setTipoMensaje(null); }}
                  className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all">
                  Cancelar
                </button>
                <button onClick={confirmarEnvioWhatsApp}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-green-500/30 transition-all flex items-center justify-center gap-2">
                  <MessageCircle className="w-5 h-5" />Enviar por WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Comentarios */}
      {showComentarioModal && participanteSeleccionado && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999] animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-8 h-8" />
                  <div>
                    <h3 className="text-xl font-bold">Comentarios</h3>
                    <p className="text-sm opacity-90">{participanteSeleccionado.nombre}</p>
                  </div>
                </div>
                <button onClick={() => { setShowComentarioModal(false); setParticipanteSeleccionado(null); setComentarioTexto(''); setError(null); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Notas y Observaciones:</label>
                <textarea value={comentarioTexto} onChange={(e) => setComentarioTexto(e.target.value)} rows={6}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all resize-none"
                  placeholder="Ej: Cuenta BBVA 1234567890, Prefiere pagar los lunes, etc." maxLength={500} />
                <p className="text-xs text-gray-500 mt-2">{comentarioTexto.length}/500 caracteres</p>
              </div>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-800">
                    <p className="font-semibold mb-1">Información útil:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Número de cuenta bancaria</li>
                      <li>Preferencias de pago</li>
                      <li>Recordatorios especiales</li>
                      <li>Cualquier observación relevante</li>
                    </ul>
                  </div>
                </div>
              </div>
              {error && (
                <div className="mt-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50 border-t-2 border-gray-200 rounded-b-2xl flex-shrink-0">
              <div className="flex gap-3">
                <button onClick={() => { setShowComentarioModal(false); setParticipanteSeleccionado(null); setComentarioTexto(''); setError(null); }} disabled={loading}
                  className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={guardarComentario} disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
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

      {/* Modal Link de Registro */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LinkIcon className="w-8 h-8" />
                  <h3 className="text-xl font-bold">Link de Registro {esCumpleañera && '🎂'}</h3>
                </div>
                <button onClick={() => { setShowLinkModal(false); setLinkRegistro(null); setLinkCopiado(false); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {!linkRegistro ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    {esCumpleañera ? 'Genera un link temporal para invitar participantes (con registro de cumpleaños)' : 'Genera un link temporal para invitar participantes'}
                  </p>
                  <div className="space-y-3">
                    <button onClick={() => generarLinkRegistro(24)} disabled={loading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                      {loading ? 'Generando...' : '⏰ Válido por 24 horas'}
                    </button>
                    <button onClick={() => generarLinkRegistro(12)} disabled={loading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50">
                      {loading ? 'Generando...' : '⏰ Válido por 12 horas'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                    <p className="text-sm font-bold text-green-800">✅ Link generado exitosamente</p>
                    <p className="text-xs text-green-700 mt-1">Válido por {linkRegistro.duracionHoras} horas</p>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Link:</label>
                    <div className="flex gap-2">
                      <input type="text" value={linkRegistro.url} readOnly className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg bg-gray-50 text-sm" />
                      <button onClick={copiarLink} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors">
                        {linkCopiado ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    {linkCopiado && <p className="text-xs text-green-600 mt-2">¡Copiado al portapapeles!</p>}
                  </div>
                  <button onClick={compartirWhatsApp}
                    className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 mb-4">
                    <MessageCircle className="w-5 h-5" />Compartir por WhatsApp
                  </button>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-blue-800 mb-2">📋 Instrucciones:</p>
                    <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                      {esCumpleañera ? (
                        <>
                          <li>Participantes se auto-registran</li>
                          <li>Ingresan su fecha de cumpleaños</li>
                          <li>El número se asigna automáticamente</li>
                          <li>Expira en {linkRegistro.duracionHoras} horas</li>
                        </>
                      ) : (
                        <>
                          <li>Participantes se auto-registran</li>
                          <li>Eligen sus números favoritos</li>
                          <li>Máximo 50% de números por persona</li>
                          <li>Expira en {linkRegistro.duracionHoras} horas</li>
                        </>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
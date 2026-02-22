import React, { useState } from 'react';
import { Send, MessageCircle, Users, CheckSquare, Square, Filter, Clock } from 'lucide-react';

const API_BASE_URL = 'https://9l2vrevqm1.execute-api.us-east-1.amazonaws.com/dev';

export default function NotificacionesView({ tandaData }) {
  const [seleccionados, setSeleccionados] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  if (!tandaData) return null;

  const participantes = tandaData.participantes || [];

  // Calcular estado de cada participante
  const calcularEstado = (participante) => {
    const estadoPagos = participante.estadoPagos || { estado: 'pendiente' };
    return estadoPagos.estado;
  };

  // Filtrar participantes
  const participantesFiltrados = participantes.filter(p => {
    if (filtro === 'todos') return true;
    return calcularEstado(p) === filtro;
  });

  // Toggle selección individual
  const toggleSeleccion = (participanteId) => {
    setSeleccionados(prev => 
      prev.includes(participanteId)
        ? prev.filter(id => id !== participanteId)
        : [...prev, participanteId]
    );
  };

  // Seleccionar todos
  const seleccionarTodos = () => {
    if (seleccionados.length === participantesFiltrados.length) {
      setSeleccionados([]);
    } else {
      setSeleccionados(participantesFiltrados.map(p => p.participanteId));
    }
  };

  // Seleccionar solo atrasados
  const seleccionarAtrasados = () => {
    const atrasados = participantes
      .filter(p => calcularEstado(p) === 'atrasado')
      .map(p => p.participanteId);
    setSeleccionados(atrasados);
  };

  // Generar mensaje predeterminado
  const generarMensajePredeterminado = () => {
    const proximoNumero = participantes.find(
      p => p.numeroAsignado === tandaData.rondaActual
    );
    
    return `🔔 *Recordatorio de Tanda*

📋 Tanda: ${tandaData.nombre}
💰 Monto: $${tandaData.montoPorRonda.toLocaleString()}
📅 Ronda: ${tandaData.rondaActual} de ${tandaData.totalRondas}
${proximoNumero ? `🎯 Próximo número: ${proximoNumero.numeroAsignado} - ${proximoNumero.nombre}` : ''}

Por favor realiza tu pago lo antes posible.

¡Gracias por tu participación! 🙏`;
  };

  const handleEnviar = async () => {
    if (seleccionados.length === 0) {
      setError('Selecciona al menos un participante');
      return;
    }

    if (!mensaje.trim()) {
      setError('Escribe un mensaje');
      return;
    }

    if (!confirm(`¿Enviar recordatorio a ${seleccionados.length} participante(s)?`)) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const token = localStorage.getItem('authToken');
      
      if (seleccionados.length === 1) {
        // Envío individual
        const response = await fetch(
          `${API_BASE_URL}/tandas/${tandaData.tandaId}/notificaciones/recordatorio`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              participanteId: seleccionados[0],
              mensaje: mensaje
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Error al enviar recordatorio');
        }

        if (data.success) {
          setSuccess('✅ Recordatorio enviado exitosamente');
        }
      } else {
        // Envío masivo
        const response = await fetch(
          `${API_BASE_URL}/tandas/${tandaData.tandaId}/notificaciones/recordatorio-masivo`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              participanteIds: seleccionados,
              mensaje: mensaje
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || 'Error al enviar recordatorios');
        }

        if (data.success) {
          const enviados = data.data?.enviados || seleccionados.length;
          setSuccess(`✅ ${enviados} recordatorio(s) enviado(s) exitosamente`);
        }
      }

      // Limpiar selección
      setSeleccionados([]);
      setMensaje('');
    } catch (error) {
      console.error('Error enviando recordatorios:', error);
      setError(error.message || 'Error al enviar recordatorios');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Send className="w-7 h-7" />
          Enviar Recordatorios
        </h2>
        <p className="text-gray-600 mt-1">
          Selecciona participantes y envía recordatorios de pago por WhatsApp
        </p>
      </div>

      {/* Mensajes de éxito/error */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 font-semibold">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 font-semibold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel Izquierdo - Lista de Participantes */}
        <div className="lg:col-span-2 space-y-4">
          {/* Controles */}
          <div className="bg-white rounded-2xl shadow-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <span className="font-semibold text-gray-700">Filtrar:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFiltro('todos')}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                      filtro === 'todos'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFiltro('atrasado')}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-colors ${
                      filtro === 'atrasado'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Atrasados
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={seleccionarTodos}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  {seleccionados.length === participantesFiltrados.length ? 'Deseleccionar' : 'Seleccionar'} Todos
                </button>
                <button
                  onClick={seleccionarAtrasados}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Solo Atrasados
                </button>
              </div>
            </div>
          </div>

          {/* Lista de Participantes */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">
                  {seleccionados.length} de {participantesFiltrados.length} seleccionado(s)
                </span>
              </div>
            </div>
            <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
              {participantesFiltrados.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No hay participantes con este filtro
                </div>
              ) : (
                participantesFiltrados
                  .sort((a, b) => a.numeroAsignado - b.numeroAsignado)
                  .map((participante) => {
                    const seleccionado = seleccionados.includes(participante.participanteId);
                    const estado = calcularEstado(participante);

                    return (
                      <div
                        key={participante.participanteId}
                        onClick={() => toggleSeleccion(participante.participanteId)}
                        className={`p-4 cursor-pointer transition-colors ${
                          seleccionado ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            {seleccionado ? (
                              <CheckSquare className="w-6 h-6 text-blue-600" />
                            ) : (
                              <Square className="w-6 h-6 text-gray-400" />
                            )}
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center font-bold text-gray-700 flex-shrink-0">
                            {participante.numeroAsignado}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800">
                              {participante.nombre}
                            </div>
                            <div className="text-sm text-gray-600">
                              {participante.telefono}
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            {estado === 'al_corriente' && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                                Al día
                              </span>
                            )}
                            {estado === 'atrasado' && (
                              <span className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold">
                                Atrasado
                              </span>
                            )}
                            {estado === 'pendiente' && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-semibold">
                                Pendiente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        {/* Panel Derecho - Mensaje */}
        <div className="space-y-4">
          {/* Editor de Mensaje */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-6 h-6 text-gray-700" />
              <h3 className="text-lg font-bold text-gray-800">Mensaje</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Contenido del mensaje
                </label>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={12}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors resize-none font-mono text-sm"
                />
                <p className="mt-2 text-xs text-gray-500">
                  {mensaje.length} caracteres
                </p>
              </div>

              <button
                onClick={() => setMensaje(generarMensajePredeterminado())}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
              >
                Usar mensaje predeterminado
              </button>

              <button
                onClick={handleEnviar}
                disabled={loading || seleccionados.length === 0 || !mensaje.trim()}
                className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Send className="w-5 h-5" />
                {loading ? 'Enviando...' : `Enviar a ${seleccionados.length} participante(s)`}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Información</p>
                <ul className="space-y-1 text-xs">
                  <li>• Los mensajes se envían vía SMS</li>
                  <li>• El envío puede tardar unos segundos</li>
                  <li>• Revisa el mensaje antes de enviar</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

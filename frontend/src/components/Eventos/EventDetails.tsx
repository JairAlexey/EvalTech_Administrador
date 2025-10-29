import { useState, useEffect } from 'react';
import { ArrowLeft, Loader, Calendar, Clock, User, Globe, Users, CheckCircle, XCircle, AlertCircle, Play } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import eventService, { type EventDetail } from '../../services/eventService';

interface EventDetailsProps {
  onBack?: () => void;
  onEdit?: (eventId: string) => void;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
  eventId?: string;
}

export default function EventDetails({ onBack, onNavigate, onLogout, eventId }: EventDetailsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [sendingEmails, setSendingEmails] = useState(false);

  // Estados para el modal
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) {
        setLoading(false);
        setError("No event ID provided");
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const response = await eventService.getEventDetails(eventId);
        let eventData: EventDetail | null = null;
        if (response && typeof response === 'object') {
          if ('event' in response && response.event) {
            eventData = response.event as EventDetail;
          } else {
            eventData = response as EventDetail;
          }
        }
        setEvent(eventData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar los datos del evento');
      } finally {
        setLoading(false);
      }
    };
    fetchEventDetails();
  }, [eventId]);

  // Enhanced status badge with icons
  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    let bgColor = 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
    let icon = <Play className="w-4 h-4" />;

    switch (status.toLowerCase()) {
      case 'programado':
        bgColor = 'bg-gradient-to-r from-blue-500 to-blue-600 text-white';
        icon = <Calendar className="w-4 h-4" />;
        break;
      case 'en progreso':
        bgColor = 'bg-gradient-to-r from-amber-500 to-orange-500 text-white';
        icon = <Play className="w-4 h-4" />;
        break;
      case 'completado':
        bgColor = 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
        icon = <CheckCircle className="w-4 h-4" />;
        break;
      case 'cancelado':
        bgColor = 'bg-gradient-to-r from-red-500 to-red-600 text-white';
        icon = <XCircle className="w-4 h-4" />;
        break;
    }
    return (
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${bgColor} shadow-lg`}>
        {icon}
        {status}
      </div>
    );
  };

  // Utilidad para mostrar fecha/hora en formato local
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };
  const formatTime = (timeStr?: string) => timeStr || '';

  const InfoCard = ({ title, value, icon: Icon, className = "" }: { title: string; value: string; icon: any; className?: string }) => (
    <div className={`bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">{title}</p>
          <p className="text-lg font-semibold text-gray-900 break-words">{value}</p>
        </div>
      </div>
    </div>
  );

  // Selección de participantes
  const handleSelectAll = (checked: boolean) => {
    if (checked && event?.participants) {
      setSelectedParticipants(event.participants.map(p => p.id));
    } else {
      setSelectedParticipants([]);
    }
  };

  const handleSelectParticipant = (id: string, checked: boolean) => {
    setSelectedParticipants(prev =>
      checked ? [...prev, id] : prev.filter(pid => pid !== id)
    );
  };

  const allSelected = event?.participants?.length === selectedParticipants.length && selectedParticipants.length > 0;

  // Enviar correos
  const handleSendEmails = async () => {
    if (!eventId || selectedParticipants.length === 0) return;
    setSendingEmails(true);
    try {
      // llamada a servicio (ya no enviamos user.id)
      await eventService.sendEventEmails(eventId, selectedParticipants);
      // Si la función no lanza error, mostrar modal de éxito
      setModalType('success');
      setModalMessage('Correos enviados correctamente');
      setModalVisible(true);
    } catch (err: any) {
      // Mostrar mensaje personalizado del backend si existe
      let msg = 'Error al enviar correos';
      if (err && err.message) msg = err.message;
      setModalType('error');
      setModalMessage(msg);
      setModalVisible(true);
    } finally {
      setSendingEmails(false);
    }
  };

  // Modal JSX
  const Modal = () => (
    modalVisible ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center relative">
          {/* Icono de cerrar en la esquina superior derecha */}
          <button
            onClick={() => setModalVisible(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <XCircle className="w-6 h-6" />
          </button>
          {modalType === 'success' ? (
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          ) : (
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          )}
          <h3 className={`text-xl font-semibold mb-2 ${modalType === 'success' ? 'text-green-700' : 'text-red-700'}`}>
            {modalType === 'success' ? 'Éxito' : 'Error'}
          </h3>
          <p className={`mb-6 ${modalType === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {modalMessage}
          </p>
        </div>
      </div>
    ) : null
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar currentPage="eventos" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-8 shadow-sm">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Volver a eventos</span>
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Detalles del Evento</h1>
                <p className="text-gray-600">Información completa del evento de evaluación</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Cargando evento</h3>
                <p className="text-gray-600">Obteniendo información del evento...</p>
              </div>
            ) : error ? (
              <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-2xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-red-700 mb-2">Error al cargar datos</h3>
                <p className="text-red-600 mb-6">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
                >
                  Reintentar
                </button>
              </div>
            ) : event ? (
              <>
                {/* Event Header Card */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-8 text-white">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold mb-2">{event.name}</h2>
                        <p className="text-blue-50 leading-relaxed max-w-3xl">
                          {event.description || 'Sin descripción disponible'}
                        </p>
                      </div>
                      <div className="ml-6">
                        {renderStatusBadge(event.status)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <InfoCard
                    title="Fecha de inicio"
                    value={formatDate(event.startDate) || 'No definida'}
                    icon={Calendar}
                  />
                  <InfoCard
                    title="Hora de inicio"
                    value={formatTime(event.startTime) || 'No definida'}
                    icon={Clock}
                  />
                  <InfoCard
                    title="Hora de cierre"
                    value={formatTime(event.closeTime) || 'No definida'}
                    icon={Clock}
                  />
                  <InfoCard
                    title="Duración"
                    value={event.duration ? `${event.duration} minutos` : 'No definida'}
                    icon={Clock}
                  />
                  <InfoCard
                    title="Fecha de fin"
                    value={formatDate(event.endDate) || 'No definida'}
                    icon={Calendar}
                  />
                  <InfoCard
                    title="Hora de fin"
                    value={formatTime(event.endTime) || 'No definida'}
                    icon={Clock}
                  />
                </div>

                {/* Evaluator and Blocked Sites */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Evaluator Card */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl">
                        <User className="w-6 h-6 text-green-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900">Evaluador asignado</h3>
                    </div>
                    {event.evaluator ? (
                      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {event.evaluator.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{event.evaluator}</p>
                          <p className="text-sm text-gray-500">Evaluador principal</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No hay evaluador asignado</p>
                      </div>
                    )}
                  </div>

                  {/* Blocked Websites Card */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                        <Globe className="w-6 h-6 text-red-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900">Páginas bloqueadas</h3>
                    </div>
                    {event.blockedWebsites && event.blockedWebsites.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {event.blockedWebsites.map((site: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <span className="text-sm text-gray-700 break-all">{site}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Globe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Sin restricciones configuradas</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Participants Table */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl">
                        <Users className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">Participantes</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {event.participants?.length || 0} participante(s) asignado(s)
                        </p>
                      </div>
                    </div>
                    <div>
                      <button
                        className={`px-5 py-2 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50`}
                        disabled={selectedParticipants.length === 0 || sendingEmails}
                        onClick={handleSendEmails}
                      >
                        {sendingEmails ? 'Enviando...' : 'Enviar correo'}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={e => handleSelectAll(e.target.checked)}
                              aria-label="Seleccionar todos"
                            />
                          </th>
                          <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Participante</th>
                          <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-8 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {event.participants && event.participants.length > 0 ? (
                          event.participants.map((participant, index) => (
                            <tr key={participant.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-6 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedParticipants.includes(participant.id)}
                                  onChange={e => handleSelectParticipant(participant.id, e.target.checked)}
                                  aria-label={`Seleccionar ${participant.name}`}
                                />
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap">
                                <div className="flex items-center gap-4">
                                  <div className={`w-10 h-10 rounded-full ${participant.color || 'bg-gradient-to-r from-blue-500 to-indigo-500'} flex items-center justify-center text-white font-semibold shadow-lg`}>
                                    {participant.initials || participant.name?.substring(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{participant.name}</p>
                                    <p className="text-xs text-gray-500">Participante #{index + 1}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap">
                                <p className="text-sm text-gray-600">{participant.email}</p>
                              </td>
                              <td className="px-8 py-6 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                  <CheckCircle className="w-3 h-3" />
                                  {participant.status || 'Activo'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-8 py-12 text-center">
                              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                              <p className="text-gray-500 text-lg font-medium mb-2">Sin participantes</p>
                              <p className="text-gray-400 text-sm">No hay participantes asignados a este evento</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-8 text-center">
                <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-yellow-700 mb-2">Evento no encontrado</h3>
                <p className="text-yellow-600 mb-6">El evento solicitado no existe o ha sido eliminado.</p>
                <button
                  onClick={onBack}
                  className="px-6 py-3 bg-yellow-500 text-white rounded-xl hover:bg-yellow-600 transition-colors font-medium"
                >
                  Volver a eventos
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Modal para mensajes personalizados */}
        <Modal />
      </div>
    </div>
  );
}
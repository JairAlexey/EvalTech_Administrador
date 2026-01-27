import { useState, useEffect } from 'react';
import { ArrowLeft, Loader, Calendar, Clock, User, Globe, Users, CheckCircle, XCircle, AlertCircle, Play, Info } from 'lucide-react';
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
        status = 'Programado';
        break;
      case 'en_progreso':
        bgColor = 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
        icon = <Play className="w-4 h-4" />;
        status = 'En progreso';
        break;
      case 'completado':
        bgColor = 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
        icon = <CheckCircle className="w-4 h-4" />;
        status = 'Completado';
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

  // =========================================
  // Conversión a hora local
  // Acepta fechas en formatos: YYYY-MM-DD o DD/MM/YYYY
  // timeStr puede ser "HH:MM" o "HH:MM AM/PM"
  // =========================================
  const parseEventDateTime = (
    dateStr?: string,
    timeStr?: string,
    targetTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ) => {
    if (!dateStr || !timeStr) return { localDate: '', localTime: '' };

    let year: number, month: number, day: number;

    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // YYYY-MM-DD
      const [y, m, d] = dateStr.split('-');
      year = parseInt(y, 10);
      month = parseInt(m, 10);
      day = parseInt(d, 10);
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      // DD/MM/YYYY
      const [d, m, y] = dateStr.split('/');
      year = parseInt(y, 10);
      month = parseInt(m, 10);
      day = parseInt(d, 10);
    } else {
      return { localDate: '', localTime: '' };
    }

    // timeStr "HH:MM" o "HH:MM AM/PM"
    let [timePart, period] = timeStr.split(' ');
    if (!timePart) return { localDate: '', localTime: '' };
    let [hStr, mStr] = timePart.split(':');
    if (!hStr || !mStr) return { localDate: '', localTime: '' };

    let hour = parseInt(hStr, 10);
    const minute = parseInt(mStr, 10);

    if (period) {
      const p = period.trim().toUpperCase();
      if (p === 'PM' && hour < 12) hour += 12;
      if (p === 'AM' && hour === 12) hour = 0;
    }

    const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const utcDate = new Date(utcMs);
    if (isNaN(utcDate.getTime())) return { localDate: '', localTime: '' };

    const fmt = new Intl.DateTimeFormat('es-EC', {
      timeZone: targetTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const parts = fmt.formatToParts(utcDate);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(p => p.type === type)?.value ?? '';

    const localDate = `${get('day')}/${get('month')}/${get('year')}`;
    const localTime = `${get('hour')}:${get('minute')}`;

    return { localDate, localTime };
  };

  // Precalcular valores locales (solo cuando hay evento)
  const localDateTimes = event
    ? {
        start: parseEventDateTime(event.startDate, event.startTime),
        close: parseEventDateTime(event.startDate, event.closeTime), // misma fecha que inicio
        end: parseEventDateTime(event.endDate, event.endTime)
      }
    : null;

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
                {/* ============ SECCIÓN: INFORMACIÓN GENERAL ============ */}
                <div className="space-y-6">
                  {/* Section Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl">
                      <Info className="w-6 h-6 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Información General</h2>
                  </div>

                  {/* Event Header Card */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-8 text-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold mb-2">{event.name}</h3>
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

                  {/* Fecha y Hora del Evento */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      Programación del Evento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Inicio del Evento */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Inicio del Evento</h4>
                        </div>
                        <div className="space-y-3 pl-4 border-l-2 border-green-200">
                          <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Fecha</p>
                              <p className="text-base font-semibold text-gray-900">
                                {localDateTimes?.start.localDate || formatDate(event.startDate) || 'No definida'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Hora de inicio</p>
                              <p className="text-base font-semibold text-gray-900">
                                {localDateTimes?.start.localTime || formatTime(event.startTime) || 'No definida'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Hora de cierre</p>
                              <p className="text-base font-semibold text-gray-900">
                                {localDateTimes?.close.localTime || formatTime(event.closeTime) || 'No definida'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Fin del Evento */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Fin del Evento</h4>
                        </div>
                        <div className="space-y-3 pl-4 border-l-2 border-red-200">
                          <div className="flex items-start gap-3">
                            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Fecha</p>
                              <p className="text-base font-semibold text-gray-900">
                                {localDateTimes?.end.localDate || formatDate(event.endDate) || 'No definida'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Hora de fin</p>
                              <p className="text-base font-semibold text-gray-900">
                                {localDateTimes?.end.localTime || formatTime(event.endTime) || 'No definida'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div>
                              <p className="text-xs text-gray-500 uppercase tracking-wide">Duración</p>
                              <p className="text-base font-semibold text-gray-900">{event.duration ? `${event.duration} minutos` : 'No definida'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Evaluator and Blocked Sites */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                </div>

                {/* ============ SECCIÓN: PARTICIPANTES ============ */}
                <div className="space-y-6 pt-8 border-t-2 border-gray-200">
                  {/* Section Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl">
                        <Users className="w-6 h-6 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Participantes</h2>
                        <p className="text-sm text-gray-500 mt-1">
                          {event.participants?.length || 0} participante(s) asignado(s) al evento
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        className={`px-6 py-3 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl`}
                        disabled={selectedParticipants.length === 0 || sendingEmails}
                        onClick={handleSendEmails}
                      >
                        {sendingEmails ? (
                          <span className="flex items-center gap-2">
                            <Loader className="w-4 h-4 animate-spin" />
                            Enviando...
                          </span>
                        ) : (
                          `Enviar correo (${selectedParticipants.length})`
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Participants Table */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-center w-16">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={e => handleSelectAll(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                aria-label="Seleccionar todos"
                              />
                            </th>
                            <th className="px-8 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Participante</th>
                            <th className="px-8 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Email</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {event.participants && event.participants.length > 0 ? (
                            event.participants.map((participant, index) => (
                              <tr key={participant.id} className="hover:bg-blue-50 transition-colors group">
                                <td className="px-6 py-6 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedParticipants.includes(participant.id)}
                                    onChange={e => handleSelectParticipant(participant.id, e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    aria-label={`Seleccionar ${participant.name}`}
                                  />
                                </td>
                                <td className="px-8 py-6 whitespace-nowrap">
                                  <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full ${participant.color || 'bg-gradient-to-r from-blue-500 to-indigo-500'} flex items-center justify-center text-black font-bold shadow-lg group-hover:scale-110 transition-transform`}>
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
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="px-8 py-16 text-center">
                                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 text-lg font-medium mb-2">Sin participantes</p>
                                <p className="text-gray-400 text-sm">No hay participantes asignados a este evento</p>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
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
import { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Trash2, UserPlus, Loader } from 'lucide-react';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';
import eventService, { type EventDetail } from '../services/eventService';

interface EventDetailsProps {
  onBack?: () => void;
  onEdit?: (eventId: string) => void;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
  eventId?: string;
}

export default function EventDetails({ onBack, onEdit, onNavigate, onLogout, eventId }: EventDetailsProps) {
  // Estado para el modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Estados para manejar la carga de datos
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [deleting, setDeleting] = useState(false);

  function parseEventDateTime(
    dateStr?: string,
    timeStr?: string,
    targetTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ) {
    if (
      !dateStr ||
      !timeStr ||
      dateStr === 'Fecha no disponible' ||
      timeStr === '--:--'
    ) {
      return { localDate: '', localTime: '' };
    }

    let year, month, day;
    // Detecta formato YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      [year, month, day] = dateStr.split('-');
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      // Formato DD/MM/YYYY
      [day, month, year] = dateStr.split('/');
    } else {
      return { localDate: '', localTime: '' };
    }

    let [time, period] = timeStr.split(' ');
    if (!time) return { localDate: '', localTime: '' };
    let [hStr, mStr] = time.split(':');
    if (!hStr || !mStr) return { localDate: '', localTime: '' };

    let h = parseInt(hStr, 10);
    const min = parseInt(mStr, 10);

    if (period) {
      const p = period.trim().toUpperCase();
      if (p === 'PM' && h < 12) h += 12;
      if (p === 'AM' && h === 12) h = 0;
    }

    const utcMs = Date.UTC(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      h,
      min,
      0,
      0
    );
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

    const localDay = get('day');
    const localMonth = get('month');
    const localYear = get('year');
    const localHour = get('hour');
    const localMinute = get('minute');

    const localDate = `${localDay}/${localMonth}/${localYear}`;
    const localTime = `${localHour}:${localMinute}`;

    return { localDate, localTime };
  }

  // Cargar los datos del evento cuando el componente se monta
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (!eventId) {
        setLoading(false);
        setError("No event ID provided");
        console.error("EventDetails component rendered without eventId prop");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Convert the event ID to the proper format if needed
        // Some APIs expect numeric IDs without any prefix
        const formattedEventId = String(eventId).replace(/\D/g, '');

        console.log("EventDetails - Original eventId:", eventId);
        console.log("EventDetails - Formatted eventId for API call:", formattedEventId);

        // Añadimos un timeout para evitar bloqueos
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000)
        );

        const eventPromise = eventService.getEventDetails(formattedEventId);
        const response = await Promise.race([eventPromise, timeoutPromise]);

        console.log("EventDetails - Data received:", response);

        if (!response) {
          setError('No se pudieron obtener los datos del evento');
          setLoading(false);
          return;
        }

        // Verificamos si la respuesta tiene la estructura anidada {event: {...}}
        let eventData: EventDetail | null = null;
        if (response && typeof response === 'object') {
          if ('event' in response && response.event) {
            // La respuesta tiene la estructura {event: {...}}
            eventData = response.event as EventDetail;
            console.log("EventDetails - Extracted event data:", eventData);
          } else {
            // La respuesta ya es el objeto de evento directamente
            eventData = response as EventDetail;
            console.log("EventDetails - Using direct event data");
          }
        } else {
          throw new Error('Formato de respuesta inesperado');
        }

        // Ahora actualizar el estado con los datos del evento
        setEvent(eventData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar los datos del evento';
        console.error('EventDetails - Error al cargar datos del evento:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [eventId]);

  // Función para generar colores consistentes para las iniciales basados en el nombre
  const getInitialsColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-teal-500'
    ];

    // Genera un índice basado en el nombre
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
  };

  // Funciones para manejar la eliminación
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!eventId) return;

    try {
      setDeleting(true);
      await eventService.deleteEvent(eventId);
      setShowDeleteModal(false);
      onBack && onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el evento');
      console.error('Error al eliminar evento:', err);
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  // Renderizar estado con el color adecuado
  const renderStatusBadge = (status?: string) => {
    if (!status) return null;

    let bgColor = 'bg-blue-100 text-blue-700';
    switch (status.toLowerCase()) {
      case 'programado':
        bgColor = 'bg-blue-100 text-blue-700';
        break;
      case 'en progreso':
        bgColor = 'bg-yellow-100 text-yellow-700';
        break;
      case 'completado':
        bgColor = 'bg-green-100 text-green-700';
        break;
      case 'cancelado':
        bgColor = 'bg-red-100 text-red-700';
        break;
    }

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${bgColor}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="eventos" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Volver</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Detalles del Evento</h1>
              <p className="text-gray-600 mt-1">Información completa del evento de evaluación</p>
            </div>
            {!loading && !error && event && (
              <div className="flex gap-4">
                <button
                  onClick={() => onEdit && onEdit(eventId || '')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
                >
                  <Edit size={20} />
                  Editar evento
                </button>
                <button
                  onClick={handleDeleteClick}
                  disabled={loading || deleting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm disabled:opacity-50"
                >
                  <Trash2 size={20} />
                  Eliminar evento
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-8 h-8 text-blue-600 animate-spin mr-3" />
              <span className="text-gray-600 text-lg">Cargando información del evento...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
              <h3 className="text-lg font-medium mb-2">Error al cargar datos</h3>
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
              >
                Reintentar
              </button>
            </div>
          ) : event ? (
            <>
              <div className="bg-white rounded-lg border border-gray-200 mb-6">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{event.name}</h2>
                      <p className="text-sm text-gray-500 mt-1">ID: {event.code}</p>
                    </div>
                    {renderStatusBadge(event.status)}
                  </div>

                  <div className="grid grid-cols-4 gap-6 mb-6">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Fecha</p>
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <p className="text-sm font-medium">
                          {parseEventDateTime(event.startDate, event.startTime).localDate || 'No disponible'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 mb-1">Hora</p>
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <p className="text-sm font-medium">
                          {parseEventDateTime(event.startDate, event.startTime).localTime || 'No disponible'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 mb-1">Duración</p>
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        <p className="text-sm font-medium">{event.duration || '60 minutos'}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 mb-1">Tipo</p>
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <line x1="10" y1="9" x2="8" y2="9" />
                        </svg>
                        <p className="text-sm font-medium">{event.evaluationType || 'Evaluación Técnica'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm text-gray-700 font-medium">Evaluador asignado</p>
                    </div>
                    {event.evaluator ? (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-sm">
                          {event.evaluator.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <p className="text-sm font-medium">{event.evaluator}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No hay evaluador asignado</p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-gray-700 font-medium mb-2">Descripción</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {event.description || 'No hay descripción disponible'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Participantes del Evento</h3>
                    <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                      <UserPlus className="w-4 h-4" />
                      Añadir participante
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 text-left">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {event.participants && event.participants.length > 0 ? (
                        event.participants.map((participant) => (
                          <tr key={participant.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{participant.id}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full ${getInitialsColor(participant.name || '')} flex items-center justify-center text-white font-medium text-sm`}>
                                  {participant.name ?
                                    participant.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                                    : '??'}
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900">{participant.name || 'Sin nombre'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <p className="text-sm text-gray-500">{participant.email || 'Sin email'}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {participant.is_active !== undefined ? (participant.is_active ? 'Activo' : 'Inactivo') : 'Desconocido'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <button className="text-blue-600 hover:text-blue-800 mr-3">
                                Ver
                              </button>
                              <button className="text-red-600 hover:text-red-800">
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                            No hay participantes asignados a este evento
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-yellow-700">
              <h3 className="text-lg font-medium mb-2">Evento no encontrado</h3>
              <p>El evento solicitado no existe o ha sido eliminado.</p>
              <button
                onClick={onBack}
                className="mt-4 px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition"
              >
                Volver a la lista de eventos
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmación para eliminar evento */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Confirmar eliminación"
        message="¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer y cancelará la evaluación para todos los participantes."
        confirmButtonText="Eliminar"
        cancelButtonText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDestructive={true}
      />
    </div>
  );
}
import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Loader, Eye, Edit, Trash2, X } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import ConfirmationModal from '../utils/ConfirmationModal';
import eventService, { type Event } from '../../services/eventService';
import { useAuth } from '../../contexts/AuthContext';

interface EventsListProps {
  onCreateEvent?: () => void;
  onViewEventDetails?: (eventId: string) => void;
  onEditEvent?: (eventId: string) => void;
  onNavigate?: (page: string, eventId?: string) => void;
  onLogout?: () => void;
}

export default function EventsList({ onCreateEvent, onViewEventDetails, onEditEvent, onNavigate, onLogout }: EventsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [evaluatorFilter, setEvaluatorFilter] = useState<string>('');
  const [durationOperator, setDurationOperator] = useState<string>('');
  const [durationValue, setDurationValue] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  function parseEventDateTime(
    dateStr?: string,
    timeStr?: string,
    targetTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone // usa la zona del navegador por defecto
  ) {
    if (
      !dateStr ||
      !timeStr ||
      dateStr === 'Fecha no disponible' ||
      timeStr === '--:--'
    ) {
      return { localDate: '', localTime: '' };
    }

    // dateStr esperado: "DD/MM/YYYY"
    const [day, month, year] = dateStr.split('/');
    if (!day || !month || !year) return { localDate: '', localTime: '' };

    // timeStr puede ser "HH:MM" o "HH:MM AM/PM"
    let [time, period] = timeStr.split(' ');
    if (!time) return { localDate: '', localTime: '' };
    let [hStr, mStr] = time.split(':');
    if (!hStr || !mStr) return { localDate: '', localTime: '' };

    let h = parseInt(hStr, 10);
    const min = parseInt(mStr, 10);

    // Normalizar 12h → 24h si trae AM/PM
    if (period) {
      const p = period.trim().toUpperCase();
      if (p === 'PM' && h < 12) h += 12;
      if (p === 'AM' && h === 12) h = 0;
    }

    // Construir un instante en UTC de forma segura (sin parseo de string ambiguo)
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

    // Formatear en la zona objetivo *sin depender* de la zona del sistema
    const fmt = new Intl.DateTimeFormat('es-EC', {
      timeZone: targetTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Extraer partes para armar "DD/MM/YYYY" y "HH:MM"
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


  // Cargar eventos desde el backend
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("Fetching events from API...");

        // Añadimos timeout para evitar bloqueos
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000)
        );

        const eventsPromise = eventService.getEvents();
        const response = await Promise.race([eventsPromise, timeoutPromise]);

        console.log("Events response:", response);

        if (!response) {
          throw new Error('No se recibieron datos de eventos');
        }

        // Verificamos explícitamente que response sea un array
        if (!Array.isArray(response)) {
          console.error("La respuesta no es un array:", response);
          throw new Error('Formato de respuesta incorrecto: se esperaba un array de eventos');
        }

        const processedEvents = response as Event[];

        setEvents(processedEvents);
        console.log("Processed events:", processedEvents);
      } catch (err) {
        console.error('Error al cargar los eventos:', err);
        setError(err instanceof Error ?
          `Error al cargar eventos: ${err.message}` :
          'No se pudieron cargar los eventos. Por favor, inténtelo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [retryCount]); // Añadimos retryCount para facilitar reintentos

  const handleDeleteClick = (eventId: string) => {
    setEventToDelete(eventId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (eventToDelete) {
      try {
        setLoading(true);
        // Eliminar el evento en el backend
        await eventService.deleteEvent(eventToDelete);

        // Actualizar la lista local
        setEvents(events.filter(event => event.id !== eventToDelete));
        setShowDeleteModal(false);
        setEventToDelete(null);
      } catch (err: any) {
        console.error('Error al eliminar el evento:', err);
        // Si el backend envía un mensaje, úsalo
        let backendMsg = 'No se pudo eliminar el evento. Por favor, inténtelo de nuevo más tarde.';
        if (err?.response?.data?.error) {
          backendMsg = err.response.data.error;
        } else if (err?.message) {
          backendMsg = err.message;
        }
        setError(backendMsg);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setEventToDelete(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Programado':
        return 'bg-blue-100 text-blue-700';
      case 'En progreso':
        return 'bg-yellow-100 text-yellow-700';
      case 'Completado':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Filter events based on search term and filters
  const filteredEvents = events.filter(event => {
    // Filtro por término de búsqueda
    if (searchTerm) {
      const eventName = (event.name || '').toLowerCase();
      const searchTermLower = searchTerm.toLowerCase();
      if (!eventName.includes(searchTermLower)) {
        return false;
      }
    }

    // Filtro por estado
    if (statusFilter && event.status !== statusFilter) {
      return false;
    }

    // Filtro por evaluador
    if (evaluatorFilter && event.evaluator !== evaluatorFilter) {
      return false;
    }

    // Filtro por duración
    if (durationOperator && durationValue) {
      const eventDuration = parseInt(String(event.duration), 10);
      const filterDuration = parseInt(durationValue, 10);
      
      if (durationOperator === 'igual' && eventDuration !== filterDuration) {
        return false;
      }
      if (durationOperator === 'mayor' && eventDuration <= filterDuration) {
        return false;
      }
      if (durationOperator === 'menor' && eventDuration >= filterDuration) {
        return false;
      }
    }

    // Filtro por fecha de inicio
    if (startDateFilter && event.startDate) {
      const eventDate = new Date(event.startDate.split('/').reverse().join('-'));
      const filterDate = new Date(startDateFilter);
      if (eventDate < filterDate) {
        return false;
      }
    }

    // Filtro por fecha de fin
    if (endDateFilter && event.endDate) {
      const eventDate = new Date(event.endDate.split('/').reverse().join('-'));
      const filterDate = new Date(endDateFilter);
      if (eventDate > filterDate) {
        return false;
      }
    }

    return true;
  });

  // Paginación de eventos
  const itemsPerPage = 10;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);

  // Asegurar que la función handleViewEvent previene navegación predeterminada correctamente
  const handleViewEvent = (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("View event clicked for ID:", eventId);
    if (onViewEventDetails) {
      onViewEventDetails(String(eventId)); // Ensure ID is a string
    }
  };

  // Función para navegar a participantes con el filtro del evento
  const handleViewParticipants = (e: React.MouseEvent, eventId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("View participants for event ID:", eventId);
    if (onNavigate) {
      onNavigate('participants', eventId);
    }
  };

  // Obtener evaluadores únicos para el filtro
  const uniqueEvaluators = Array.from(new Set(events.map(e => e.evaluator).filter(Boolean)));

  // Obtener estados únicos para el filtro
  const uniqueStatus = Array.from(new Set(events.map(e => e.status).filter(Boolean)));

  // Resetear filtros
  const handleResetFilters = () => {
    setStatusFilter('');
    setEvaluatorFilter('');
    setDurationOperator('');
    setDurationValue('');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  const hasActiveFilters = statusFilter || evaluatorFilter || durationOperator || durationValue || startDateFilter || endDateFilter;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="eventos" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Eventos</h1>
              <p className="text-gray-600 mt-1">Administre los eventos de evaluación técnica</p>
            </div>
            {isAdmin && (
              <button
                onClick={onCreateEvent}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Nuevo evento
              </button>
            )}
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar eventos..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    disabled={loading}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFiltersModal(true)}
                    className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition ${hasActiveFilters
                        ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    disabled={loading || events.length === 0}
                  >
                    <Filter className="w-4 h-4" />
                    Filtros
                    {hasActiveFilters && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">✓</span>}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-6 bg-red-50 border-b border-red-200 text-red-700">
                <p className="mb-2">{error}</p>
                <button
                  onClick={() => setRetryCount(prev => prev + 1)}
                  className="mt-2 text-sm font-medium text-red-700 hover:text-red-800 underline"
                >
                  Reintentar cargar eventos
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center p-12">
                <Loader className="animate-spin h-12 w-12 text-blue-600 mr-3" />
                <span className="text-lg text-gray-600">Cargando eventos...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Evento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Evaluador
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Fecha de Inicio
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Fecha de Cierre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Duración (min)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Fecha de Fin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Participantes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedEvents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          {events.length === 0 ?
                            'No hay eventos disponibles. Crea un nuevo evento para comenzar.' :
                            'No se encontraron eventos que coincidan con la búsqueda.'
                          }
                        </td>
                      </tr>
                    ) : (

                      paginatedEvents.map((event) => {
                        const { localDate: startLocalDate, localTime: startLocalTime } = parseEventDateTime(event.startDate, event.startTime);
                        const { localDate: closeLocalDate, localTime: closeLocalTime } = parseEventDateTime(event.closeDate, event.closeTime);
                        const { localDate: endLocalDate, localTime: endLocalTime } = parseEventDateTime(event.endDate, event.endTime);
                        return (
                          <tr key={event.id} className="hover:bg-gray-50 transition"
                          >
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{event.name}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm text-gray-900">{event.evaluator}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm text-gray-900">{startLocalDate || event.startDate}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{startLocalTime || event.startTime}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm text-gray-900">{closeLocalDate || event.closeDate}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{closeLocalTime || event.closeTime}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-900">{event.duration}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm text-gray-900">{endLocalDate || event.endDate}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{endLocalTime || event.endTime}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={(e) => handleViewParticipants(e, event.id)}
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition font-medium whitespace-nowrap"
                                title={`Ver ${event.participants} participantes de este evento`}
                              >
                                {event.participants} participantes
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                                {event.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleViewEvent(e, event.id);
                                  }}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEditEvent && onEditEvent(event.id);
                                  }}
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteClick(event.id);
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación mejorada */}
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {filteredEvents.length > 0
                    ? `Mostrando ${startIndex + 1} a ${Math.min(startIndex + paginatedEvents.length, filteredEvents.length)} de ${filteredEvents.length} eventos`
                    : 'No hay eventos disponibles'
                  }
                </p>
                {totalPages > 1 && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>

                    {/* Mostrar número de página actual */}
                    <span className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-blue-50 text-blue-700">
                      {currentPage}
                    </span>

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para eliminar evento */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Confirmar eliminación"
        message="¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer."
        confirmButtonText="Eliminar"
        cancelButtonText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDestructive={true}
      />

      {/* Modal de filtros */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Filtros de eventos</h2>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="text-gray-500 hover:text-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Filtro por estado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Todos los estados</option>
                  {uniqueStatus.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por evaluador */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evaluador
                </label>
                <select
                  value={evaluatorFilter}
                  onChange={(e) => setEvaluatorFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Todos los evaluadores</option>
                  {uniqueEvaluators.map(evaluator => (
                    <option key={evaluator} value={evaluator}>
                      {evaluator}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por duración */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Duración (minutos)
                </label>
                <div className="flex gap-2">
                  <select
                    value={durationOperator}
                    onChange={(e) => setDurationOperator(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Seleccionar</option>
                    <option value="igual">Igual a</option>
                    <option value="mayor">Mayor que</option>
                    <option value="menor">Menor que</option>
                  </select>
                  <input
                    type="number"
                    value={durationValue}
                    onChange={(e) => setDurationValue(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Filtro por fecha de inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de inicio (desde)
                </label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Filtro por fecha de fin */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de fin (hasta)
                </label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Botones de acción */}
            <div className="px-6 py-4 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Limpiar filtros
              </button>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
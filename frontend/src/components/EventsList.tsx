import { useState, useEffect } from 'react';
import { Search, Filter, Plus, Loader, Eye, Edit, Trash2 } from 'lucide-react';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';
import eventService, { Event as BaseEvent } from '../services/eventService';

// Ampliamos el tipo para incluir campos que podrían estar ausentes en la API
type Event = BaseEvent & {
  selected: boolean;
  time?: string;
  duration?: string;
  participants?: number;
};

interface EventsListProps {
  onCreateEvent?: () => void;
  onViewEventDetails?: (eventId: string) => void;
  onEditEvent?: (eventId: string) => void;
  onNavigate?: (page: string) => void;
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

        // Ahora es seguro llamar a map() ya que hemos verificado que es un array
        const processedEvents = response.map((event: BaseEvent) => ({
          ...event,
          selected: false,
          // Asegurar que todos los campos necesarios estén presentes
          id: event.id || `event-${Math.random().toString(36).substr(2, 9)}`,
          name: event.name || 'Evento sin nombre',
          code: event.code || 'SIN-CÓDIGO',
          date: event.date || 'Fecha no disponible',
          status: event.status || 'No definido',
          time: event.time || '--:--',
          duration: event.duration || 'N/A',
          participants: typeof event.participants === 'number' ? event.participants : 0
        }));

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
      } catch (err) {
        console.error('Error al eliminar el evento:', err);
        setError('No se pudo eliminar el evento. Por favor, inténtelo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setEventToDelete(null);
  };

  const toggleEvent = (id: string) => {
    setEvents(events.map(e =>
      e.id === id ? { ...e, selected: !e.selected } : e
    ));
  };

  const toggleAllEvents = () => {
    const allSelected = events.length > 0 && events.every(e => e.selected);
    setEvents(events.map(e => ({ ...e, selected: !allSelected })));
  };

  const selectedCount = events.filter(e => e.selected).length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Programado':
        return 'bg-blue-100 text-blue-700';
      case 'En progreso':
        return 'bg-yellow-100 text-yellow-700';
      case 'Completado':
        return 'bg-green-100 text-green-700';
      case 'Cancelado':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Filter events based on search term
  const filteredEvents = events.filter(event => {
    if (!searchTerm) return true;
    // Agregamos verificación para evitar errores con valores nulos o undefined
    const eventName = (event.name || '').toLowerCase();
    const eventCode = (event.code || '').toLowerCase();
    const searchTermLower = searchTerm.toLowerCase();

    return eventName.includes(searchTermLower) || eventCode.includes(searchTermLower);
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
            <button
              onClick={onCreateEvent}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo evento
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={events.length > 0 && events.every(e => e.selected)}
                      onChange={toggleAllEvents}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      disabled={loading || events.length === 0}
                    />
                    <span className="ml-2 text-sm text-gray-600">{selectedCount} seleccionados</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar eventos..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-64"
                      disabled={loading}
                    />
                  </div>
                  <button
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
                    disabled={loading || events.length === 0}
                  >
                    <Filter className="w-4 h-4" />
                    Filtros
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
                      <th className="w-12 px-6 py-3"></th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Evento
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Fecha y Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Duración
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
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          {events.length === 0 ?
                            'No hay eventos disponibles. Crea un nuevo evento para comenzar.' :
                            'No se encontraron eventos que coincidan con la búsqueda.'
                          }
                        </td>
                      </tr>
                    ) : (
                      paginatedEvents.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50 transition cursor-pointer"
                          onClick={(e) => handleViewEvent(e, event.id)}>
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={event.selected}
                              onChange={(e) => {
                                e.stopPropagation(); // Prevenir la navegación al hacer clic en el checkbox
                                toggleEvent(event.id);
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{event.name || 'Sin nombre'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{event.code || 'Sin código'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm text-gray-900">{event.date || 'Fecha no disponible'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{event.time || '--:--'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{event.duration || 'N/A'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{event.participants || 0} candidatos</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status || '')}`}>
                              {event.status || 'No definido'}
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
                            </div>
                          </td>
                        </tr>
                      ))
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
    </div>
  );
}

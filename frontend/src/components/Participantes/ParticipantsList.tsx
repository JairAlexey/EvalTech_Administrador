import { useState, useEffect } from 'react';
import { Search, Plus, Filter, Edit, Trash2, ChevronLeft, ChevronRight, Upload, X } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import ConfirmationModal from '../utils/ConfirmationModal';
import CreateParticipant from './CreateParticipant';
import EditParticipant from './EditParticipant';
import ImportParticipantsModal from './ImportParticipantsModal';
import participantService, { type Participant as ParticipantType } from '../../services/participantService';

interface Participant extends ParticipantType { }

interface ParticipantListProps {
  onNavigate?: (page: string) => void;
  canAccess?: (page: string) => boolean; // <-- new optional prop
  onLogout?: () => void;
  filterEventId?: string | null;
}

function getColorClass(color: string) {
  const allowed = [
    "bg-blue-200",
    "bg-green-200",
    "bg-purple-200",
    "bg-red-200",
    "bg-yellow-200",
    "bg-indigo-200",
    "bg-pink-200"
  ];
  return allowed.includes(color) ? color : "bg-gray-200";
}

export default function ParticipantsList({ onNavigate, canAccess, onLogout, filterEventId }: ParticipantListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<string | null>(null);
  const [participantToEdit, setParticipantToEdit] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailFilter, setEmailFilter] = useState<string>('');
  const [eventCountFilter, setEventCountFilter] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [eventSearchInput, setEventSearchInput] = useState<string>('');
  const [showEventDropdown, setShowEventDropdown] = useState<boolean>(false);

  // Aplicar filtro de evento cuando se recibe filterEventId
  useEffect(() => {
    if (filterEventId) {
      setEventFilter(filterEventId);
      // Buscar el evento para establecer el texto de búsqueda
      const event = participants
        .flatMap(p => p.events || [])
        .find(e => e.id === filterEventId);
      if (event) {
        setEventSearchInput(event.name);
      } else {
        // Si no se encuentra el evento en los participantes actuales,
        // usar un placeholder genérico con el ID
        setEventSearchInput(`Evento (ID: ${filterEventId})`);
      }
    }
  }, [filterEventId, participants]);

  // Cargar participantes desde el backend
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const participantsData = await participantService.getParticipants(searchTerm);
        setParticipants(participantsData);
        setError(null);
      } catch (err) {
        setError('No se pudieron cargar los participantes. Por favor, inténtelo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    // Usar un debounce para la búsqueda
    const timeoutId = setTimeout(() => {
      fetchParticipants();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const refreshParticipants = async () => {
    setLoading(true);
    try {
      const participantsData = await participantService.getParticipants(searchTerm);
      setParticipants(participantsData);
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los participantes. Por favor, inténtelo de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  // Función para manejar el clic en el botón de eliminar
  const handleDeleteClick = (id: string) => {
    setParticipantToDelete(id);
    setShowDeleteModal(true);
  };

  // Función para confirmar la eliminación
  const handleConfirmDelete = async () => {
    if (!participantToDelete) return;

    // Guardar id localmente y cerrar modal inmediatamente
    const idToDelete = participantToDelete;
    setShowDeleteModal(false);
    setParticipantToDelete(null);

    setLoading(true);
    try {
      // Ejecutar eliminación en background
      await participantService.deleteParticipant(idToDelete);
      // Usar forma funcional para evitar problemas con closures
      setParticipants(prev => prev.filter(c => c.id !== idToDelete));
      setError(null);
    } catch (err) {
      const errorObj = err as any;
      const backendMsg =
        errorObj?.response?.data?.error ||
        errorObj?.message ||
        'No se pudo eliminar el participante. Por favor, inténtelo de nuevo más tarde.';
      setError(backendMsg);
    } finally {
      setLoading(false);
    }
  };

  // Función para cancelar la eliminación
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setParticipantToDelete(null);
  };

  // Función para manejar el clic en el botón de editar
  const handleEditClick = (id: string) => {
    // Ejecutar guard antes de abrir modal localmente
    if (canAccess && !canAccess('edit-participant')) {
      // Delegar a App para que muestre AccessDenied u otra navegación
      onNavigate && onNavigate('edit-participant');
      return;
    }
    setParticipantToEdit(id);
    setShowEditModal(true);
  };

  const handleCreateClick = () => {
    // Ejecutar guard antes de abrir modal localmente
    if (canAccess && !canAccess('create-participant')) {
      onNavigate && onNavigate('create-participant');
      return;
    }
    setShowCreateModal(true);
  };

  // Filtrar participantes basado en búsqueda y filtros
  const filteredParticipants = participants.filter(participant => {
    // Filtro por término de búsqueda
    if (searchTerm) {
      const participantName = (participant.name || '').toLowerCase();
      const searchTermLower = searchTerm.toLowerCase();
      if (!participantName.includes(searchTermLower)) {
        return false;
      }
    }

    // Filtro por correo
    if (emailFilter) {
      const participantEmail = (participant.email || '').toLowerCase();
      const filterEmailLower = emailFilter.toLowerCase();
      if (!participantEmail.includes(filterEmailLower)) {
        return false;
      }
    }

    // Filtro por cantidad de eventos
    if (eventCountFilter) {
      const eventCount = participant.events?.length || 0;
      if (eventCountFilter === 'sin-eventos' && eventCount !== 0) {
        return false;
      }
      if (eventCountFilter === 'con-eventos' && eventCount === 0) {
        return false;
      }
    }

    // Filtro por evento específico
    if (eventFilter) {
      const hasEvent = participant.events?.some(event => event.id === eventFilter);
      if (!hasEvent) {
        return false;
      }
    }

    return true;
  });

  // Obtener dominios de correo únicos para el filtro
  const uniqueEmailDomains = Array.from(
    new Set(
      participants
        .map(p => p.email?.split('@')[1])
        .filter(Boolean)
    )
  );

  // Obtener eventos únicos de todos los participantes para el filtro
  const uniqueEvents = Array.from(
    new Map(
      participants
        .flatMap(p => p.events || [])
        .map(event => [event.id, event])
    ).values()
  );

  // Filtrar eventos basado en el texto de búsqueda
  const filteredEvents = uniqueEvents.filter(event =>
    event.name.toLowerCase().includes(eventSearchInput.toLowerCase())
  );

  // Obtener el evento seleccionado
  const selectedEvent = uniqueEvents.find(e => e.id === eventFilter);

  // Si hay un eventFilter activo pero no está en uniqueEvents (evento sin participantes),
  // crear un objeto temporal para mostrarlo
  const displaySelectedEvent = selectedEvent || (eventFilter ? {
    id: eventFilter,
    name: eventSearchInput || `Evento (ID: ${eventFilter})`,
    date: '',
    status: ''
  } : null);

  // Resetear filtros
  const handleResetFilters = () => {
    setEmailFilter('');
    setEventCountFilter('');
    setEventFilter('');
    setEventSearchInput('');
    setShowEventDropdown(false);
  };

  const hasActiveFilters = emailFilter || eventCountFilter || eventFilter;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="participants" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Participantes</h1>
              <p className="text-gray-600 mt-1">Gestión de participantes registrados en el sistema</p>
            </div>
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo participante
            </button>
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
                    placeholder="Buscar participantes..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFiltersModal(true)}
                    className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition ${hasActiveFilters
                      ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    disabled={loading || participants.length === 0}
                  >
                    <Filter className="w-4 h-4" />
                    Filtros
                    {hasActiveFilters && <span className="ml-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">✓</span>}
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium shadow-sm"
                    title="Cargar participantes desde Excel"
                  >
                    <Upload className="w-4 h-4" />
                    Cargar participantes
                  </button>
                </div>
              </div>
            </div>            {error && (
              <div className="p-6 bg-red-50 border-b border-red-200 text-red-700">
                <p>{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-sm font-medium text-red-700 hover:text-red-800"
                >
                  Reintentar
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Correo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Eventos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          {participants.length === 0
                            ? 'No hay participantes disponibles. Crea un nuevo participante para comenzar.'
                            : searchTerm || hasActiveFilters
                              ? 'No se encontraron participantes que coincidan con la búsqueda o filtros.'
                              : 'No hay participantes disponibles.'}
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants
                        .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                        .map((participant) => (
                          <tr key={participant.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className={`w-8 h-8 rounded-full ${getColorClass(participant.color)} flex items-center justify-center text-gray-700 font-medium`}>
                                  {participant.initials}
                                </div>
                                <span className="ml-3 font-medium">{participant.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {participant.email}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {participant.events && participant.events.length > 0 ? (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {participant.events.map(event => {
                                    const eventInitials = event.name
                                      .split(' ')
                                      .map(word => word[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2);

                                    return (
                                      <div
                                        key={event.id}
                                        className="relative group"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium text-xs cursor-default">
                                          {eventInitials}
                                        </div>
                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                          {event.name}
                                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs">Sin eventos</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEditClick(participant.id);
                                  }}
                                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                                  title="Editar participante"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteClick(participant.id);
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                  title="Eliminar participante"
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

            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {filteredParticipants.length > 0
                    ? `Mostrando 1 a ${Math.min(filteredParticipants.length, ITEMS_PER_PAGE)} de ${filteredParticipants.length} participantes`
                    : 'No hay participantes disponibles'
                  }
                </p>
                {filteredParticipants.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1 || loading}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>

                    {/* Generar botones de página de forma responsive */}
                    {(() => {
                      const totalPages = Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE);
                      const maxVisibleButtons = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

                      if (endPage - startPage + 1 < maxVisibleButtons) {
                        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
                      }

                      return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(page => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition ${currentPage === page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                          {page}
                        </button>
                      ));
                    })()}

                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={loading || currentPage * ITEMS_PER_PAGE >= filteredParticipants.length}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de creación de participante */}
      <CreateParticipant
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          refreshParticipants()
        }}
      />

      {/* Modal de edición de participante */}
      <EditParticipant
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setParticipantToEdit(null);
        }}
        onSuccess={() => {
          setShowEditModal(false);
          setParticipantToEdit(null);
          refreshParticipants();
        }}
        participantId={participantToEdit}
      />

      {/* Modal de confirmación de eliminación */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Eliminar participante"
        message="¿Estás seguro de que deseas eliminar este participante? Esta acción no se puede deshacer."
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
              <h2 className="text-lg font-bold text-gray-900">Filtros de participantes</h2>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="text-gray-500 hover:text-gray-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Filtro por dominio de correo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dominio de correo
                </label>
                <select
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Todos los dominios</option>
                  {uniqueEmailDomains.map(domain => (
                    <option key={domain} value={domain}>
                      {domain}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por cantidad de eventos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Participación en eventos
                </label>
                <select
                  value={eventCountFilter}
                  onChange={(e) => setEventCountFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Todos</option>
                  <option value="con-eventos">Con eventos</option>
                  <option value="sin-eventos">Sin eventos</option>
                </select>
              </div>

              {/* Filtro por evento específico */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evento específico
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={eventSearchInput}
                    onChange={(e) => {
                      setEventSearchInput(e.target.value);
                      setShowEventDropdown(true);
                    }}
                    onFocus={() => setShowEventDropdown(true)}
                    placeholder="Buscar evento..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  {eventSearchInput && (
                    <button
                      onClick={() => {
                        setEventSearchInput('');
                        setEventFilter('');
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Dropdown de eventos */}
                  {showEventDropdown && filteredEvents.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredEvents.map(event => (
                        <button
                          key={event.id}
                          onClick={() => {
                            setEventFilter(event.id);
                            setEventSearchInput(event.name);
                            setShowEventDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 transition border-b border-gray-100 last:border-b-0"
                        >
                          <p className="text-sm font-medium text-gray-900">{event.name}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Evento seleccionado */}
                  {displaySelectedEvent && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Evento seleccionado:</span> {displaySelectedEvent.name}
                      </p>
                      <button
                        onClick={() => {
                          setEventFilter('');
                          setEventSearchInput('');
                        }}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Limpiar selección
                      </button>
                    </div>
                  )}
                </div>
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

      {/* Modal de importación de participantes */}
      <ImportParticipantsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          refreshParticipants();
        }}
      />
    </div>
  );
}
import { useState, useEffect } from 'react';
import { Search, Plus, Filter, Edit, Trash2, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import ConfirmationModal from '../utils/ConfirmationModal';
import CreateParticipant from './CreateParticipant';
import EditParticipant from './EditParticipant';
import ImportParticipantsModal from './ImportParticipantsModal';
import participantService, { type Participant as ParticipantType } from '../../services/participantService';

interface Participant extends ParticipantType {
  selected: boolean;
}

interface ParticipantListProps {
  onNavigate?: (page: string) => void;
  canAccess?: (page: string) => boolean; // <-- new optional prop
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

export default function ParticipantsList({ onNavigate, canAccess }: ParticipantListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<string | null>(null);
  const [participantToEdit, setParticipantToEdit] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar participantes desde el backend
  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const participantsData = await participantService.getParticipants(searchTerm);
        setParticipants(participantsData.map(participant => ({ ...participant, selected: false })));
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
      setParticipants(participantsData.map(participant => ({ ...participant, selected: false })));
      setError(null);
    } catch (err) {
      setError('No se pudieron cargar los participantes. Por favor, inténtelo de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  // Calcular cuántos participantes están seleccionados
  const selectedCount = participants.filter(c => c.selected).length;

  // Función para manejar la selección de un participante
  const toggleParticipant = (id: string) => {
    setParticipants(participants.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ));
  };

  // Función para seleccionar o deseleccionar todos los participantes
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setParticipants(participants.map(c => ({ ...c, selected: newSelectAll })));
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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="participants" onNavigate={onNavigate} />

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
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-600">Seleccionar todo</span>
                  <span className="ml-4 text-sm text-gray-500">{selectedCount} seleccionados</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar participantes..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-64"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                    <Filter className="w-4 h-4" />
                    Filtros
                  </button>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 transition text-sm"
                    title="Cargar participantes desde Excel"
                  >
                    <Upload className="w-4 h-4" />
                    Cargar participantes
                  </button>
                </div>
              </div>
            </div>

            {error && (
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
                      <th className="w-12 px-6 py-3"></th>
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
                    {participants.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                          {searchTerm ? 'No se encontraron participantes que coincidan con la búsqueda.' : 'No hay participantes disponibles. Crea un nuevo participante para comenzar.'}
                        </td>
                      </tr>
                    ) : (
                      participants.map((participant) => (
                        <tr key={participant.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={participant.selected}
                              onChange={() => toggleParticipant(participant.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
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
                              <ul>
                                {participant.events.map(event => (
                                  <li key={event.id}>{event.name}</li>
                                ))}
                              </ul>
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
                  {participants.length > 0
                    ? `Mostrando 1 a ${Math.min(participants.length, 10)} de ${participants.length} participantes`
                    : 'No hay participantes disponibles'
                  }
                </p>
                {participants.length > 10 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1 || loading}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>

                    {/* Generar botones de página dinámicamente */}
                    {Array.from({ length: Math.ceil(participants.length / 10) }).map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentPage(index + 1)}
                        className={`px-3 py-2 ${currentPage === index + 1
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          } rounded-lg text-sm font-medium transition`}
                      >
                        {index + 1}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={loading || currentPage * 10 >= participants.length}
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

      {/* Modal de importación de participantes */}
      <ImportParticipantsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false);
          refreshParticipants();
        }}
      />
    </div>
  );
}
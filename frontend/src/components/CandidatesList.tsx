import { useState, useEffect } from 'react';
import { Search, Plus, Filter, Edit, Trash2, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';
import candidateService, { type Candidate as CandidateType } from '../services/candidateService';

interface Candidate extends CandidateType {
  selected: boolean;
}

interface CandidateListProps {
  onCreateCandidate?: () => void;
  onEditCandidate?: (candidateId: string) => void;
  onViewCandidateDetails?: (candidateId: string) => void;
  onNavigate?: (page: string) => void;
}

export default function CandidatesList({ onCreateCandidate, onEditCandidate, onViewCandidateDetails, onNavigate }: CandidateListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar candidatos desde el backend
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true);
        const candidatesData = await candidateService.getCandidates(searchTerm);
        setCandidates(candidatesData.map(candidate => ({ ...candidate, selected: false })));
        setError(null);
      } catch (err) {
        console.error('Error al cargar los candidatos:', err);
        setError('No se pudieron cargar los candidatos. Por favor, inténtelo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    // Usar un debounce para la búsqueda
    const timeoutId = setTimeout(() => {
      fetchCandidates();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Calcular cuántos candidatos están seleccionados
  const selectedCount = candidates.filter(c => c.selected).length;

  // Función para manejar la selección de un candidato
  const toggleCandidate = (id: string) => {
    setCandidates(candidates.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ));
  };

  // Función para seleccionar o deseleccionar todos los candidatos
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setCandidates(candidates.map(c => ({ ...c, selected: newSelectAll })));
  };

  // Función para manejar el clic en el botón de eliminar
  const handleDeleteClick = (id: string) => {
    setCandidateToDelete(id);
    setShowDeleteModal(true);
  };

  // Función para confirmar la eliminación
  const handleConfirmDelete = async () => {
    if (candidateToDelete) {
      try {
        setLoading(true);
        await candidateService.deleteCandidate(candidateToDelete);
        setCandidates(candidates.filter(c => c.id !== candidateToDelete));
        setShowDeleteModal(false);
        setCandidateToDelete(null);
      } catch (err) {
        console.error('Error al eliminar el candidato:', err);
        setError('No se pudo eliminar el candidato. Por favor, inténtelo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Función para cancelar la eliminación
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setCandidateToDelete(null);
  };

  // Función para obtener la clase CSS del estado
  const getStatusClass = (status: Candidate['status']) => {
    switch (status) {
      case 'Activo':
        return 'bg-green-100 text-green-800';
      case 'Inactivo':
        return 'bg-red-100 text-red-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Modify the candidate click handler to prevent default behavior
  const handleViewCandidate = (e: React.MouseEvent, candidateId: string) => {
    e.preventDefault(); // Prevent any default behavior
    e.stopPropagation(); // Stop event propagation
    console.log("View candidate clicked for ID:", candidateId);
    if (onViewCandidateDetails) {
      onViewCandidateDetails(String(candidateId)); // Ensure ID is a string
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="candidatos" onNavigate={onNavigate} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Candidatos</h1>
              <p className="text-gray-600 mt-1">Gestión de candidatos registrados en el sistema</p>
            </div>
            <button
              onClick={() => onCreateCandidate && onCreateCandidate()}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo candidato
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
                      placeholder="Buscar candidatos..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-64"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                    <Filter className="w-4 h-4" />
                    Filtros
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
                        Puesto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Evento
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
                    {candidates.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          {searchTerm ? 'No se encontraron candidatos que coincidan con la búsqueda.' : 'No hay candidatos disponibles. Crea un nuevo candidato para comenzar.'}
                        </td>
                      </tr>
                    ) : (
                      candidates.map((candidate) => (
                        <tr key={candidate.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={candidate.selected}
                              onChange={() => toggleCandidate(candidate.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full ${candidate.color} flex items-center justify-center text-gray-700 font-medium`}>
                                {candidate.initials}
                              </div>
                              <span className="ml-3 font-medium">{candidate.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {candidate.email}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {candidate.position}
                          </td>
                          <td className="px-6 py-4">
                            {candidate.event ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                {candidate.event}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(candidate.status)}`}>
                              {candidate.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => handleViewCandidate(e, candidate.id)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onEditCandidate && onEditCandidate(candidate.id);
                                }}
                                className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteClick(candidate.id);
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

            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {candidates.length > 0
                    ? `Mostrando 1 a ${Math.min(candidates.length, 10)} de ${candidates.length} candidatos`
                    : 'No hay candidatos disponibles'
                  }
                </p>
                {candidates.length > 10 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1 || loading}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>

                    {/* Generar botones de página dinámicamente */}
                    {Array.from({ length: Math.ceil(candidates.length / 10) }).map((_, index) => (
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
                      disabled={loading || currentPage * 10 >= candidates.length}
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

      {/* Modal de confirmación de eliminación */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Eliminar candidato"
        message="¿Estás seguro de que deseas eliminar este candidato? Esta acción no se puede deshacer."
        confirmButtonText="Eliminar"
        cancelButtonText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDestructive={true}
      />
    </div>
  );
}
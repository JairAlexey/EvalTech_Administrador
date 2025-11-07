import { useState, useEffect } from 'react';
import { Search, Filter, Eye, Loader } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import evaluationService, { type Evaluation } from '../../services/evaluationService';

interface EvaluationsListProps {
  onNavigate?: (page: string) => void;
  onViewEvaluation?: (evaluationId: string) => void;
}

export default function EvaluationsList({ onNavigate, onViewEvaluation }: EvaluationsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Cargar evaluaciones desde el backend
  useEffect(() => {
    const fetchEvaluations = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log("Fetching evaluations from API...");

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000)
        );

        const evaluationsPromise = evaluationService.getEvaluations();
        const response = await Promise.race([evaluationsPromise, timeoutPromise]);

        console.log("Evaluations response:", response);

        if (!response) {
          throw new Error('No se recibieron datos de evaluaciones');
        }

        if (!Array.isArray(response)) {
          console.error("La respuesta no es un array:", response);
          throw new Error('Formato de respuesta incorrecto');
        }

        setEvaluations(response as Evaluation[]);
      } catch (err) {
        console.error('Error al cargar las evaluaciones:', err);
        setError(err instanceof Error ?
          `Error al cargar evaluaciones: ${err.message}` :
          'No se pudieron cargar las evaluaciones. Por favor, inténtelo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvaluations();
  }, [retryCount]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completado':
        return 'bg-green-100 text-green-700';
      case 'en_progreso':
      case 'en progreso':
        return 'bg-yellow-100 text-yellow-700';
      case 'programado':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'en_progreso':
        return 'En progreso';
      case 'completado':
        return 'Completado';
      case 'programado':
        return 'Programado';
      default:
        return status;
    }
  };

  // Filtrar evaluaciones basado en búsqueda
  const filteredEvaluations = evaluations.filter(evaluation => {
    if (!searchTerm) return true;
    const evaluationName = (evaluation.name || '').toLowerCase();
    const searchTermLower = searchTerm.toLowerCase();
    return evaluationName.includes(searchTermLower);
  });

  // Paginación
  const itemsPerPage = 10;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEvaluations = filteredEvaluations.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredEvaluations.length / itemsPerPage);

  const handleViewEvaluation = (e: React.MouseEvent, evaluationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("View evaluation clicked for ID:", evaluationId);
    if (onViewEvaluation) {
      onViewEvaluation(String(evaluationId));
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Evaluaciones</h1>
              <p className="text-gray-600 mt-1">Visualiza las evaluaciones en progreso y completadas</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar evaluaciones..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-64"
                      disabled={loading}
                    />
                  </div>
                  <button
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm"
                    disabled={loading || evaluations.length === 0}
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
                  Reintentar cargar evaluaciones
                </button>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center items-center p-12">
                <Loader className="animate-spin h-12 w-12 text-blue-600 mr-3" />
                <span className="text-lg text-gray-600">Cargando evaluaciones...</span>
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
                        Fecha de inicio
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Duración
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Fecha fin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Estado
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Participantes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedEvaluations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          {evaluations.length === 0 ?
                            'No hay evaluaciones disponibles.' :
                            'No se encontraron evaluaciones que coincidan con la búsqueda.'
                          }
                        </td>
                      </tr>
                    ) : (
                      paginatedEvaluations.map((evaluation) => (
                        <tr key={evaluation.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <p className="text-sm font-medium text-gray-900">{evaluation.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm text-gray-900">{evaluation.startDate || '--'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{evaluation.startTime || '--:--'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{evaluation.duration ? `${evaluation.duration} min` : '--'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm text-gray-900">{evaluation.endDate || '--'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{evaluation.endTime || '--:--'}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(evaluation.status)}`}>
                              {getStatusLabel(evaluation.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{evaluation.participants} participantes</p>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={(e) => handleViewEvaluation(e, evaluation.id)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación */}
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {filteredEvaluations.length > 0
                    ? `Mostrando ${startIndex + 1} a ${Math.min(startIndex + paginatedEvaluations.length, filteredEvaluations.length)} de ${filteredEvaluations.length} evaluaciones`
                    : 'No hay evaluaciones disponibles'
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
    </div>
  );
}
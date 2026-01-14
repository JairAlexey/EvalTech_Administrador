import { useState, useEffect } from 'react';
import { Search, Filter, Eye, Loader, X, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import evaluationService, { type Evaluation } from '../../services/evaluationService';

interface EvaluationsListProps {
  onNavigate?: (page: string) => void;
  onViewEvaluation?: (evaluationId: string) => void;
  onLogout?: () => void;
}

export default function EvaluationsList({ onNavigate, onViewEvaluation, onLogout }: EvaluationsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [durationOperator, setDurationOperator] = useState<string>('');
  const [durationValue, setDurationValue] = useState<string>('');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

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

  // Filtrar evaluaciones basado en búsqueda y filtros
  const filteredEvaluations = evaluations.filter(evaluation => {
    // Filtro por término de búsqueda
    if (searchTerm) {
      const evaluationName = (evaluation.name || '').toLowerCase();
      const searchTermLower = searchTerm.toLowerCase();
      if (!evaluationName.includes(searchTermLower)) {
        return false;
      }
    }

    // Filtro por estado
    if (statusFilter && evaluation.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }

    // Filtro por duración
    if (durationOperator && durationValue) {
      const evaluationDuration = parseInt(String(evaluation.duration), 10);
      const filterDuration = parseInt(durationValue, 10);

      if (durationOperator === 'igual' && evaluationDuration !== filterDuration) {
        return false;
      }
      if (durationOperator === 'mayor' && evaluationDuration <= filterDuration) {
        return false;
      }
      if (durationOperator === 'menor' && evaluationDuration >= filterDuration) {
        return false;
      }
    }

    // Filtro por fecha de inicio
    if (startDateFilter && evaluation.startDate) {
      const eventDate = new Date(evaluation.startDate.split('/').reverse().join('-'));
      const filterDate = new Date(startDateFilter);
      if (eventDate < filterDate) {
        return false;
      }
    }

    // Filtro por fecha de fin
    if (endDateFilter && evaluation.endDate) {
      const eventDate = new Date(evaluation.endDate.split('/').reverse().join('-'));
      const filterDate = new Date(endDateFilter);
      if (eventDate > filterDate) {
        return false;
      }
    }

    return true;
  });

  // Paginación
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedEvaluations = filteredEvaluations.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredEvaluations.length / ITEMS_PER_PAGE);

  const handleViewEvaluation = (e: React.MouseEvent, evaluationId: string) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("View evaluation clicked for ID:", evaluationId);
    if (onViewEvaluation) {
      onViewEvaluation(String(evaluationId));
    }
  };

  // Obtener estados únicos para el filtro
  const uniqueStatus = Array.from(new Set(evaluations.map(e => e.status).filter(Boolean)));

  // Resetear filtros
  const handleResetFilters = () => {
    setStatusFilter('');
    setDurationOperator('');
    setDurationValue('');
    setStartDateFilter('');
    setEndDateFilter('');
  };

  const hasActiveFilters = statusFilter || durationOperator || durationValue || startDateFilter || endDateFilter;

  // Conversión a hora local (acepta YYYY-MM-DD o DD/MM/YYYY y HH:MM o HH:MM AM/PM)
  function parseEventDateTime(
    dateStr?: string,
    timeStr?: string,
    targetTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ) {
    if (!dateStr || !timeStr) return { localDate: '', localTime: '' };

    let year: number, month: number, day: number;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-'); year = +y; month = +m; day = +d;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [d, m, y] = dateStr.split('/'); year = +y; month = +m; day = +d;
    } else return { localDate: '', localTime: '' };

    let [timePart, period] = timeStr.split(' ');
    if (!timePart) return { localDate: '', localTime: '' };
    const [hStr, mStr] = timePart.split(':');
    if (!hStr || !mStr) return { localDate: '', localTime: '' };
    let hour = parseInt(hStr, 10);
    const minute = parseInt(mStr, 10);
    if (period) {
      const p = period.trim().toUpperCase();
      if (p === 'PM' && hour < 12) hour += 12;
      if (p === 'AM' && hour === 12) hour = 0;
    }

    const utcMs = Date.UTC(year, month - 1, day, hour, minute);
    const utcDate = new Date(utcMs);
    if (isNaN(utcDate.getTime())) return { localDate: '', localTime: '' };

    const fmt = new Intl.DateTimeFormat('es-EC', {
      timeZone: targetTimeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = fmt.formatToParts(utcDate);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(p => p.type === type)?.value || '';
    return {
      localDate: `${get('day')}/${get('month')}/${get('year')}`,
      localTime: `${get('hour')}:${get('minute')}`
    };
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Evaluaciones</h1>
              <p className="text-gray-600 mt-1">Visualiza las evaluaciones por evento</p>
            </div>
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
                    placeholder="Buscar evaluaciones..."
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
                    disabled={loading || evaluations.length === 0}
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
                        Fecha de cierre
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
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          {evaluations.length === 0
                            ? 'No hay evaluaciones disponibles.'
                            : searchTerm || hasActiveFilters
                              ? 'No se encontraron evaluaciones que coincidan con la búsqueda o filtros.'
                              : 'No hay evaluaciones disponibles.'}
                        </td>
                      </tr>
                    ) : (
                      paginatedEvaluations.map((evaluation) => {
                        const { localDate: startLocalDate, localTime: startLocalTime } =
                          parseEventDateTime(evaluation.startDate, evaluation.startTime);
                        const { localDate: closeLocalDate, localTime: closeLocalTime } =
                          parseEventDateTime(evaluation.closeDate, evaluation.closeTime);
                        const { localDate: endLocalDate, localTime: endLocalTime } =
                          parseEventDateTime(evaluation.endDate, evaluation.endTime);
                        return (
                          <tr key={evaluation.id} className="hover:bg-gray-50 transition">
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium text-gray-900">{evaluation.name}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm text-gray-900">{startLocalDate || evaluation.startDate || '--'}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{startLocalTime || evaluation.startTime || '--:--'}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm text-gray-900">{closeLocalDate || evaluation.closeDate || '--'}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{closeLocalTime || evaluation.closeTime || '--:--'}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm text-gray-900">{evaluation.duration ? `${evaluation.duration} min` : '--'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm text-gray-900">{endLocalDate || evaluation.endDate || '--'}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{endLocalTime || evaluation.endTime || '--:--'}</p>
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
                        );
                      })
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
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600" />
                    </button>

                    {/* Generar botones de página de forma responsive */}
                    {(() => {
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
                      disabled={currentPage >= totalPages}
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

      {/* Modal de filtros */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-bold text-gray-900">Filtros de evaluaciones</h2>
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
                      {getStatusLabel(status)}
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
import { useState, useEffect } from 'react';
import { ArrowLeft, Users, Calendar, Clock, User, Monitor, FileText, Loader, AlertCircle } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import evaluationService, { type EvaluationDetail } from '../../services/evaluationService';

interface EvaluationDetailsProps {
  evaluationId: string;
  onNavigate?: (page: string) => void;
  onViewMonitoring?: (participantId: string) => void;
  onViewReport?: (participantId: string) => void;
  onBack?: () => void;
  onLogout?: () => void;
}

export default function EvaluationDetails({ evaluationId, onNavigate, onViewMonitoring, onViewReport, onBack, onLogout }: EvaluationDetailsProps) {
  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvaluationDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await evaluationService.getEvaluationDetails(evaluationId);

        if (!data) {
          throw new Error('No se pudieron obtener los detalles de la evaluación');
        }

        setEvaluation(data);
      } catch (err) {
        console.error('Error al cargar detalles de evaluación:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar los detalles');
      } finally {
        setLoading(false);
      }
    };

    if (evaluationId) {
      fetchEvaluationDetails();
    }
  }, [evaluationId]);

  const handleMonitoring = (participantId: string) => {
    if (onViewMonitoring) {
      onViewMonitoring(participantId);
    }
  };

  const handleReport = (participantId: string, participantName: string) => {
    console.log('Generar informe para participante:', participantId, participantName);
    if (onViewReport) {
      onViewReport(participantId);
    }
  };

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

  // Conversión local
  const parseEventDateTime = (
    dateStr?: string,
    timeStr?: string,
    targetTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ) => {
    if (!dateStr || !timeStr) return { localDate: '', localTime: '' };
    let y: number, m: number, d: number;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [Y, M, D] = dateStr.split('-'); y = +Y; m = +M; d = +D;
    } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [D, M, Y] = dateStr.split('/'); y = +Y; m = +M; d = +D;
    } else return { localDate: '', localTime: '' };
    let [tPart, period] = timeStr.split(' ');
    if (!tPart) return { localDate: '', localTime: '' };
    const [hStr, minStr] = tPart.split(':'); if (!hStr || !minStr) return { localDate: '', localTime: '' };
    let h = parseInt(hStr, 10); const mi = parseInt(minStr, 10);
    if (period) {
      const p = period.trim().toUpperCase();
      if (p === 'PM' && h < 12) h += 12;
      if (p === 'AM' && h === 12) h = 0;
    }
    const utcMs = Date.UTC(y, m - 1, d, h, mi);
    const dt = new Date(utcMs);
    if (isNaN(dt.getTime())) return { localDate: '', localTime: '' };
    const fmt = new Intl.DateTimeFormat('es-EC', {
      timeZone: targetTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = fmt.formatToParts(dt);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';
    return { localDate: `${get('day')}/${get('month')}/${get('year')}`, localTime: `${get('hour')}:${get('minute')}` };
  };

  const localDateTimes = evaluation ? {
    start: parseEventDateTime(evaluation.startDate, evaluation.startTime),
    close: parseEventDateTime(evaluation.closeDate, evaluation.closeTime),
    end: parseEventDateTime(evaluation.endDate, evaluation.endTime)
  } : null;

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Cargando detalles de la evaluación...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error al cargar</h2>
            <p className="text-gray-600 mb-4">{error || 'No se encontró la evaluación'}</p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Volver a evaluaciones
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isCompleted = evaluation?.status?.toLowerCase() === 'completado';

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{evaluation.name}</h1>
              <p className="text-gray-600 mt-1">{evaluation.description}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(evaluation.status)}`}>
              {getStatusLabel(evaluation.status)}
            </span>
          </div>
        </div>

        {/* Información General */}
        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información General</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Fecha de inicio</p>
                  <p className="text-sm font-medium text-gray-900">{localDateTimes?.start.localDate || evaluation.startDate}</p>
                  <p className="text-xs text-gray-500">{localDateTimes?.start.localTime || evaluation.startTime}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Fecha de cierre</p>
                  <p className="text-sm font-medium text-gray-900">{localDateTimes?.close.localDate || evaluation.closeDate}</p>
                  <p className="text-xs text-gray-500">{localDateTimes?.close.localTime || evaluation.closeTime}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Duración</p>
                  <p className="text-sm font-medium text-gray-900">{evaluation.duration} minutos</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Fecha de fin</p>
                  <p className="text-sm font-medium text-gray-900">{localDateTimes?.end.localDate || evaluation.endDate}</p>
                  <p className="text-xs text-gray-500">{localDateTimes?.end.localTime || evaluation.endTime}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Evaluador</p>
                  <p className="text-sm font-medium text-gray-900">{evaluation.evaluator || 'No asignado'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Participantes */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Participantes ({evaluation.participants.length})
                  </h2>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Participante
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Monitoreo
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {evaluation.participants.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                        No hay participantes asignados a esta evaluación
                      </td>
                    </tr>
                  ) : (
                    evaluation.participants.map((participant) => (
                      <tr key={participant.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${participant.color} flex items-center justify-center`}>
                              <span className="text-sm font-semibold text-gray-700">
                                {participant.initials}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{participant.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            participant.monitoring_is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {participant.monitoring_is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleMonitoring(participant.id)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Monitorización"
                            >
                              <Monitor className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReport(participant.id, participant.name)}
                              className={`p-2 rounded-lg transition ${isCompleted ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 cursor-not-allowed'} `}
                              disabled={!isCompleted}
                              title="Ver informe"
                            >
                              <FileText className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

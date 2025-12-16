import { useEffect, useState, useRef } from 'react';
import Sidebar from '../utils/Sidebar';
import behaviorAnalysisService, { type AnalysisStatus, type AnalysisReport } from '../../services/behaviorAnalysisService';
import { User, Clock, AlertTriangle, Eye, Volume2, Lightbulb, MessageSquare, UserX, Activity } from 'lucide-react';

interface ReportPageProps {
    eventId: string;
    participantId: string;
    onBack: () => void;
    onNavigate: (page: string) => void;
    onLogout?: () => void;
}

export default function ReportPage({ eventId, participantId, onBack, onNavigate, onLogout }: ReportPageProps) {
    const [statusData, setStatusData] = useState<AnalysisStatus | null>(null);
    const [reportData, setReportData] = useState<AnalysisReport | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);

                // Cargar estado
                const status = await behaviorAnalysisService.getAnalysisStatus(eventId, participantId);
                setStatusData(status);

                // Solo cargar reporte si está completado
                const normalizedStatus = normalizeStatus(status.analysis?.status);
                console.log('Status normalizado:', normalizedStatus);

                if (normalizedStatus === 'completado') {
                    console.log('Cargando reporte...');
                    try {
                        const report = await behaviorAnalysisService.getAnalysisReport(eventId, participantId);
                        console.log('Reporte cargado:', report);
                        setReportData(report);
                    } catch (reportError) {
                        console.error('Error al cargar reporte:', reportError);
                        setError(reportError instanceof Error ? reportError.message : 'Error al cargar el reporte');
                    }
                }
            } catch (err) {
                console.error('Error al cargar datos:', err);
                setError(err instanceof Error ? err.message : 'No se pudo obtener el análisis');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [eventId, participantId]);

    const getStatusBadge = (status?: string) => {
        if (!status) return { text: 'Sin estado', color: 'bg-gray-100 text-gray-700' };
        const normalized = status.toLowerCase();
        switch (normalized) {
            case 'no_solicitado':
                return { text: 'No solicitado', color: 'bg-gray-100 text-gray-700' };
            case 'pendiente':
                return { text: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' };
            case 'procesando':
                return { text: 'Procesando', color: 'bg-blue-100 text-blue-700' };
            case 'completado':
                return { text: 'Completado', color: 'bg-green-100 text-green-700' };
            case 'error':
                return { text: 'Fallido', color: 'bg-red-100 text-red-700' };
            default:
                return { text: status, color: 'bg-gray-100 text-gray-700' };
        }
    };

    const normalizeStatus = (status?: string): string => {
        if (!status) return 'no_solicitado';
        const normalized = status.toLowerCase();
        const statusMap: Record<string, string> = {
            'no_solicitado': 'no_solicitado',
            'pendiente': 'pendiente',
            'procesando': 'procesando',
            'completado': 'completado',
            'error': 'error'
        };
        return statusMap[normalized] || normalized;
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const seekToTime = (seconds: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = seconds;
            videoRef.current.play();
        }
    };

    const badge = getStatusBadge(statusData?.analysis?.status);

    if (loading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} onLogout={onLogout} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Cargando reporte...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} onLogout={onLogout} />

            <div className="flex-1 overflow-y-auto">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-8 py-6">
                    <button
                        onClick={onBack}
                        className="mb-4 text-blue-600 hover:text-blue-800 flex items-center text-sm"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Volver al Detalle de la Evaluación
                    </button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Informe de Análisis de Comportamiento</h1>
                            <p className="text-gray-600 mt-1">
                                {reportData?.participant.name || `Participante ${participantId}`} - {reportData?.event.name || `Evento ${eventId}`}
                            </p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${badge.color}`}>
                            {badge.text}
                        </span>
                    </div>
                </div>

                <div className="p-8">
                    {/* Error State */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <p className="text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Estado no solicitado */}
                    {normalizeStatus(statusData?.analysis?.status) === 'no_solicitado' && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                            <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Análisis no solicitado</h3>
                            <p className="text-gray-600">
                                El análisis de comportamiento no ha sido solicitado para este participante.
                            </p>
                        </div>
                    )}

                    {/* Estado en proceso (pendiente o procesando) */}
                    {(normalizeStatus(statusData?.analysis?.status) === 'pendiente' || normalizeStatus(statusData?.analysis?.status) === 'procesando') && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                            <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Análisis en proceso</h3>
                            <p className="text-gray-600">
                                El análisis de comportamiento está {normalizeStatus(statusData?.analysis?.status) === 'pendiente' ? 'pendiente' : 'en procesamiento'}. Por favor, vuelve más tarde.
                            </p>
                        </div>
                    )}

                    {/* Estado de error */}
                    {normalizeStatus(statusData?.analysis?.status) === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                            <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error en el análisis</h3>
                            <p className="text-gray-600">
                                Ocurrió un error durante el procesamiento del análisis. Por favor, contacta al administrador.
                            </p>
                        </div>
                    )}

                    {/* Reporte completo */}
                    {reportData && normalizeStatus(statusData?.analysis?.status) === 'completado' && (
                        <div className="space-y-6">
                            {/* Video Player */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-blue-600" />
                                    Video de la Evaluación
                                </h2>
                                <div className="relative bg-black rounded-lg overflow-hidden" style={{ maxHeight: '500px' }}>
                                    <video
                                        ref={videoRef}
                                        src={reportData.analysis.video_link}
                                        controls
                                        className="w-full h-full"
                                        style={{ maxHeight: '500px' }}
                                    >
                                        Tu navegador no soporta la reproducción de video.
                                    </video>
                                </div>
                            </div>

                            {/* Estadísticas Generales */}
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumen de Estadísticas</h2>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-4 h-4 text-blue-600" />
                                            <p className="text-xs text-gray-600">Rostros</p>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-700">{reportData.statistics.total_rostros_detectados}</p>
                                    </div>

                                    <div className="bg-purple-50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Eye className="w-4 h-4 text-purple-600" />
                                            <p className="text-xs text-gray-600">Gestos</p>
                                        </div>
                                        <p className="text-2xl font-bold text-purple-700">{reportData.statistics.total_gestos}</p>
                                    </div>

                                    <div className="bg-yellow-50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Lightbulb className="w-4 h-4 text-yellow-600" />
                                            <p className="text-xs text-gray-600">Iluminación</p>
                                        </div>
                                        <p className="text-2xl font-bold text-yellow-700">{reportData.statistics.total_anomalias_iluminacion}</p>
                                    </div>

                                    <div className="bg-red-50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <UserX className="w-4 h-4 text-red-600" />
                                            <p className="text-xs text-gray-600">Ausencias</p>
                                        </div>
                                        <p className="text-2xl font-bold text-red-700">{reportData.statistics.total_ausencias}</p>
                                    </div>

                                    <div className="bg-green-50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Volume2 className="w-4 h-4 text-green-600" />
                                            <p className="text-xs text-gray-600">Hablantes</p>
                                        </div>
                                        <p className="text-2xl font-bold text-green-700">{reportData.statistics.total_hablantes}</p>
                                    </div>

                                    <div className="bg-orange-50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <MessageSquare className="w-4 h-4 text-orange-600" />
                                            <p className="text-xs text-gray-600">Susurros</p>
                                        </div>
                                        <p className="text-2xl font-bold text-orange-700">{reportData.statistics.total_anomalias_voz}</p>
                                    </div>

                                    <div className="bg-pink-50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-4 h-4 text-pink-600" />
                                            <p className="text-xs text-gray-600">Lipsync</p>
                                        </div>
                                        <p className="text-2xl font-bold text-pink-700">{reportData.statistics.total_anomalias_lipsync}</p>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-4 h-4 text-gray-600" />
                                            <p className="text-xs text-gray-600">Tiempo Ausente</p>
                                        </div>
                                        <p className="text-xl font-bold text-gray-700">
                                            {formatTime(reportData.statistics.tiempo_total_ausencia_segundos)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Detalle de Registros */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Ausencias */}
                                {reportData.registros.ausencias.length > 0 && (
                                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                                        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <UserX className="w-5 h-5 text-red-600" />
                                            Ausencias Detectadas ({reportData.registros.ausencias.length})
                                        </h3>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {reportData.registros.ausencias.map((ausencia) => (
                                                <div
                                                    key={ausencia.id}
                                                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg hover:bg-red-100 transition cursor-pointer"
                                                    onClick={() => seekToTime(ausencia.tiempo_inicio)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            Duración: {formatTime(ausencia.duracion)}
                                                        </p>
                                                        <p className="text-xs text-gray-600">
                                                            {formatTime(ausencia.tiempo_inicio)} - {formatTime(ausencia.tiempo_fin)}
                                                        </p>
                                                    </div>
                                                    <button className="text-blue-600 hover:text-blue-800 text-xs">
                                                        Ver
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Gestos */}
                                {reportData.registros.gestos.length > 0 && (
                                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                                        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Eye className="w-5 h-5 text-purple-600" />
                                            Gestos Detectados ({reportData.registros.gestos.length})
                                        </h3>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {reportData.registros.gestos.map((gesto) => (
                                                <div
                                                    key={gesto.id}
                                                    className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition cursor-pointer"
                                                    onClick={() => seekToTime(gesto.tiempo_inicio)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{gesto.tipo_gesto}</p>
                                                        <p className="text-xs text-gray-600">
                                                            {formatTime(gesto.tiempo_inicio)} - Duración: {formatTime(gesto.duracion)}
                                                        </p>
                                                    </div>
                                                    <button className="text-blue-600 hover:text-blue-800 text-xs">
                                                        Ver
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Iluminación */}
                                {reportData.registros.iluminacion.length > 0 && (
                                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                                        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Lightbulb className="w-5 h-5 text-yellow-600" />
                                            Anomalías de Iluminación ({reportData.registros.iluminacion.length})
                                        </h3>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {reportData.registros.iluminacion.map((ilum) => (
                                                <div
                                                    key={ilum.id}
                                                    className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition cursor-pointer"
                                                    onClick={() => seekToTime(ilum.tiempo_inicio)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">Problema de iluminación</p>
                                                        <p className="text-xs text-gray-600">
                                                            {formatTime(ilum.tiempo_inicio)} - {formatTime(ilum.tiempo_fin)}
                                                        </p>
                                                    </div>
                                                    <button className="text-blue-600 hover:text-blue-800 text-xs">
                                                        Ver
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Voz */}
                                {reportData.registros.voz.length > 0 && (
                                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                                        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Volume2 className="w-5 h-5 text-green-600" />
                                            Análisis de Voz ({reportData.registros.voz.length})
                                        </h3>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {reportData.registros.voz.map((voz) => (
                                                <div
                                                    key={voz.id}
                                                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition cursor-pointer"
                                                    onClick={() => seekToTime(voz.tiempo_inicio)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {voz.tipo_log === 'susurro' ? '🤫 Susurro' : `🗣️ ${voz.etiqueta_hablante || 'Hablante'}`}
                                                        </p>
                                                        <p className="text-xs text-gray-600">
                                                            {formatTime(voz.tiempo_inicio)} - {formatTime(voz.tiempo_fin)}
                                                        </p>
                                                    </div>
                                                    <button className="text-blue-600 hover:text-blue-800 text-xs">
                                                        Ver
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Lipsync */}
                                {reportData.registros.lipsync.length > 0 && (
                                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                                        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <MessageSquare className="w-5 h-5 text-pink-600" />
                                            Anomalías Lipsync ({reportData.registros.lipsync.length})
                                        </h3>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {reportData.registros.lipsync.map((lipsync) => (
                                                <div
                                                    key={lipsync.id}
                                                    className="flex items-center justify-between p-3 bg-pink-50 rounded-lg hover:bg-pink-100 transition cursor-pointer"
                                                    onClick={() => seekToTime(lipsync.tiempo_inicio)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{lipsync.tipo_anomalia}</p>
                                                        <p className="text-xs text-gray-600">
                                                            {formatTime(lipsync.tiempo_inicio)} - {formatTime(lipsync.tiempo_fin)}
                                                        </p>
                                                    </div>
                                                    <button className="text-blue-600 hover:text-blue-800 text-xs">
                                                        Ver
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Rostros */}
                                {reportData.registros.rostros.length > 0 && (
                                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                                        <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <User className="w-5 h-5 text-blue-600" />
                                            Detección de Rostros ({reportData.registros.rostros.length} registros)
                                        </h3>
                                        <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {reportData.registros.rostros.slice(0, 10).map((rostro) => (
                                                <div
                                                    key={rostro.id}
                                                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition cursor-pointer"
                                                    onClick={() => seekToTime(rostro.tiempo_inicio)}
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">Persona #{rostro.persona_id}</p>
                                                        <p className="text-xs text-gray-600">
                                                            {formatTime(rostro.tiempo_inicio)} - {formatTime(rostro.tiempo_fin)}
                                                        </p>
                                                    </div>
                                                    <button className="text-blue-600 hover:text-blue-800 text-xs">
                                                        Ver
                                                    </button>
                                                </div>
                                            ))}
                                            {reportData.registros.rostros.length > 10 && (
                                                <p className="text-xs text-gray-500 text-center pt-2">
                                                    ... y {reportData.registros.rostros.length - 10} registros más
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Información adicional */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-800">
                                    <strong>Nota:</strong> Haz clic en cualquier registro para ver ese momento en el video.
                                    Los tiempos mostrados corresponden a las marcas temporales detectadas durante el análisis.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

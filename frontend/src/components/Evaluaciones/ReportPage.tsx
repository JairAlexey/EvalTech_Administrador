import { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronRight, Info, X } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import behaviorAnalysisService, { type AnalysisStatus, type AnalysisReport } from '../../services/behaviorAnalysisService';
import { User, Clock, AlertTriangle, Eye, Volume2, Lightbulb, MessageSquare, UserX, Activity, Camera, Shield, Timer, Film } from 'lucide-react';

interface ReportPageProps {
    eventId: string;
    participantId: string;
    onBack: () => void;
    onNavigate: (page: string) => void;
    onLogout?: () => void;
}

// Información de penalización para cada dimensión
const penalizacionInfo: Record<string, { titulo: string; descripcion: string; penalizaciones: string[] }> = {
    'Presencia Continua': {
        titulo: 'Presencia Continua',
        descripcion: 'Evalúa el tiempo que el participante estuvo presente frente a la cámara durante la evaluación.',
        penalizaciones: [
            '• Penalización base: -2 puntos por cada segundo de ausencia',
            '• Penalización adicional: Si las ausencias superan el 10% de la duración del evento, se reduce la puntuación a la mitad',
        ]
    },
    'Comportamiento Visual': {
        titulo: 'Comportamiento Visual',
        descripcion: 'Analiza los gestos y movimientos del participante que pueden indicar distracciones o comportamiento sospechoso.',
        penalizaciones: [
            '• Penalización: -3 puntos por cada gesto detectado',
            '• Incluye: miradas hacia otro lado, hacia abajo, cabeza inclinada, ojos cerrados, etc.',
        ]
    },
    'Calidad de Audio': {
        titulo: 'Calidad de Audio',
        descripcion: 'Evalúa la calidad y características del audio capturado durante la evaluación.',
        penalizaciones: [
            '• Susurros detectados: -5 puntos por cada ocurrencia',
            '• Múltiples hablantes detectados: -20 puntos (se aplica una sola vez si hay más de un hablante)',
        ]
    },
    'Sincronización Labial': {
        titulo: 'Sincronización Labial',
        descripcion: 'Verifica la coherencia entre el movimiento de los labios y el audio capturado.',
        penalizaciones: [
            '• Cada anomalía de sincronización: -6 puntos',
            '• Indica posible uso de audio pregrabado o suplantación',
        ]
    },
    'Condiciones de Iluminación': {
        titulo: 'Condiciones de Iluminación',
        descripcion: 'Evalúa si las condiciones de iluminación son adecuadas para la identificación del participante.',
        penalizaciones: [
            '• Cada anomalía de iluminación: -3 puntos',
            '• Incluye iluminación muy baja, muy alta, o contraluz',
        ]
    },
    'Consistencia de Identidad': {
        titulo: 'Consistencia de Identidad',
        descripcion: 'Verifica que solo el participante registrado esté presente durante la evaluación.',
        penalizaciones: [
            '• Ninguna persona detectada: 0 puntos (automáticamente)',
            '• Cada persona adicional detectada: -20 puntos',
            '• Garantiza que solo el participante autorizado realice la evaluación'
        ]
    },
    'Navegación y Seguridad': {
        titulo: 'Navegación y Seguridad',
        descripcion: 'Monitorea intentos de acceso a sitios no permitidos y desconexiones del sistema de seguridad.',
        penalizaciones: [
            '• Cada petición bloqueada: -5 puntos',
            '• Cada desconexión del proxy: -15 puntos',
            '• Las desconexiones del proxy indican intentos de evadir el monitoreo',
        ]
    },
    'Continuidad de la Sesión': {
        titulo: 'Continuidad de la Sesión',
        descripcion: 'Evalúa las interrupciones en el monitoreo durante la evaluación.',
        penalizaciones: [
            '• Cada sesión adicional de monitoreo: -10 puntos',
            '• Primera sesión no penaliza',
            '• Múltiples sesiones pueden indicar intentos de manipulación',
        ]
    }
};

export default function ReportPage({ eventId, participantId, onBack, onNavigate, onLogout }: ReportPageProps) {
    const [statusData, setStatusData] = useState<AnalysisStatus | null>(null);
    const [reportData, setReportData] = useState<AnalysisReport | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'resumen' | 'comportamiento' | 'actividad' | 'puntuaciones'>('resumen');
    const videoRef = useRef<HTMLVideoElement>(null);
    const videoRefreshAttempts = useRef<number>(0);
    const screenshotRefreshAttempts = useRef<number>(0);
    const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
    const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
    const [selectedScreenGroup, setSelectedScreenGroup] = useState<string | null>(null);
    const [activeDetectionTab, setActiveDetectionTab] = useState<'ausencias' | 'gestos' | 'iluminacion' | 'voz' | 'lipsync' | 'rostros'>('ausencias');

    // Estado para colapsar/expandir subcategorías agrupadas
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    // Estado para modal de información de penalizaciones
    const [infoModalOpen, setInfoModalOpen] = useState<string | null>(null);

    // Keyboard navigation for gallery
    useEffect(() => {
        if (!isGalleryOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                goToPrevious();
            } else if (e.key === 'ArrowRight') {
                goToNext();
            } else if (e.key === 'Escape') {
                setIsGalleryOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isGalleryOpen, reportData, selectedScreenGroup, currentImageIndex]);

    const toggleGroup = (groupKey: string) => {
        setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

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

    // Seleccionar automáticamente la primera pestaña de detección disponible
    useEffect(() => {
        if (!reportData) return;

        const detectionOrder: Array<'ausencias' | 'gestos' | 'iluminacion' | 'voz' | 'lipsync' | 'rostros'> = [
            'ausencias', 'gestos', 'iluminacion', 'voz', 'lipsync', 'rostros'
        ];

        for (const detection of detectionOrder) {
            const hasData = reportData.registros[detection]?.length > 0;
            if (hasData) {
                setActiveDetectionTab(detection);
                break;
            }
        }
    }, [reportData]);

    const refreshReportData = async () => {
        try {
            const freshReport = await behaviorAnalysisService.getAnalysisReport(eventId, participantId);
            setReportData(freshReport);
            return freshReport;
        } catch (reportError) {
            console.error('Error al refrescar reporte:', reportError);
            setError(reportError instanceof Error ? reportError.message : 'No se pudo refrescar el reporte');
            return null;
        }
    };

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

    const openGallery = (index: number, screenType: string) => {
        setSelectedScreenGroup(screenType);
        setCurrentImageIndex(index);
        setIsGalleryOpen(true);
    };

    const closeGallery = () => {
        setIsGalleryOpen(false);
    };

    const goToPrevious = () => {
        if (currentImageIndex > 0) {
            setCurrentImageIndex(currentImageIndex - 1);
        }
    };

    const goToNext = () => {
        if (reportData && selectedScreenGroup) {
            const filtered = reportData.activity_logs.screenshots.filter(s => s.message === selectedScreenGroup);
            if (currentImageIndex < filtered.length - 1) {
                setCurrentImageIndex(currentImageIndex + 1);
            }
        }
    };

    const handleVideoError = async () => {
        if (videoRefreshAttempts.current >= 2) return; // evita bucles si sigue fallando
        videoRefreshAttempts.current += 1;
        const freshReport = await refreshReportData();
        if (freshReport?.analysis?.video_link && videoRef.current) {
            videoRef.current.src = freshReport.analysis.video_link;
            videoRef.current.load();
            videoRef.current.play().catch(() => null);
        }
    };

    const handleScreenshotError = async () => {
        if (screenshotRefreshAttempts.current >= 2) return;
        screenshotRefreshAttempts.current += 1;
        await refreshReportData();
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
                            {/* Tabs de Navegación */}
                            <div className="bg-white rounded-lg border border-gray-200">
                                <div className="flex border-b border-gray-200">
                                    <button
                                        onClick={() => setActiveTab('resumen')}
                                        className={`px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'resumen'
                                            ? 'border-b-2 border-blue-600 text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        📊 Resumen General
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('comportamiento')}
                                        className={`px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'comportamiento'
                                            ? 'border-b-2 border-blue-600 text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        🎥 Análisis de Comportamiento
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('actividad')}
                                        className={`px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'actividad'
                                            ? 'border-b-2 border-blue-600 text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        📝 Logs de Actividad
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('puntuaciones')}
                                        className={`px-6 py-4 text-sm font-medium transition-colors ${activeTab === 'puntuaciones'
                                            ? 'border-b-2 border-blue-600 text-blue-600'
                                            : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                    >
                                        📊 Puntuaciones
                                    </button>
                                </div>

                                {/* Contenido de las pestañas */}
                                <div className="p-6">
                                    {/* Tab: Resumen General */}
                                    {activeTab === 'resumen' && (
                                        <div className="space-y-6">
                                            {/* Información de Monitoreo */}
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                    <Timer className="w-6 h-6 text-indigo-600" />
                                                    Información de Monitoreo
                                                </h2>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div className="bg-indigo-50 p-6 rounded-lg text-center">
                                                        <p className="text-sm text-gray-600 mb-2">Tiempo Total de Monitoreo</p>
                                                        <p className="text-3xl font-bold text-indigo-700">
                                                            {formatTime(reportData.monitoring.total_duration_seconds)}
                                                        </p>
                                                    </div>
                                                    <div className="bg-indigo-50 p-6 rounded-lg text-center">
                                                        <p className="text-sm text-gray-600 mb-2">Sesiones de Monitoreo</p>
                                                        <p className="text-3xl font-bold text-indigo-700">{reportData.monitoring.sessions_count}</p>
                                                    </div>
                                                    <div className="bg-indigo-50 p-6 rounded-lg text-center">
                                                        <p className="text-sm text-gray-600 mb-2">Último Registro de Monitoreo</p>
                                                        <p className="text-lg font-medium text-indigo-700">
                                                            {reportData.monitoring.last_change
                                                                ? new Date(reportData.monitoring.last_change).toLocaleString('es-ES')
                                                                : 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Actividad Registrada */}
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900 mb-4">Actividad Registrada</h2>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                    <div className="bg-cyan-50 p-6 rounded-lg text-center">
                                                        <Camera className="w-10 h-10 text-cyan-600 mx-auto mb-3" />
                                                        <p className="text-4xl font-bold text-cyan-700 mb-2">{reportData.statistics.total_screenshots}</p>
                                                        <p className="text-sm text-gray-600">Capturas de Pantalla</p>
                                                    </div>
                                                    <div className="bg-purple-50 p-6 rounded-lg text-center">
                                                        <Film className="w-10 h-10 text-purple-600 mx-auto mb-3" />
                                                        <p className="text-4xl font-bold text-purple-700 mb-2">{reportData.statistics.total_videos}</p>
                                                        <p className="text-sm text-gray-600">Videos</p>
                                                    </div>
                                                    <div className="bg-red-50 p-6 rounded-lg text-center">
                                                        <Shield className="w-10 h-10 text-red-600 mx-auto mb-3" />
                                                        <p className="text-4xl font-bold text-red-700 mb-2">{reportData.statistics.total_blocked_requests}</p>
                                                        <p className="text-sm text-gray-600">Peticiones Bloqueadas</p>
                                                    </div>
                                                    <div className="bg-orange-50 p-6 rounded-lg text-center">
                                                        <AlertTriangle className="w-10 h-10 text-orange-600 mx-auto mb-3" />
                                                        <p className="text-4xl font-bold text-orange-700 mb-2">{reportData.statistics.total_proxy_disconnections}</p>
                                                        <p className="text-sm text-gray-600">Desconexiones del Proxy</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Estadísticas Principales */}
                                            <div>
                                                <h2 className="text-xl font-bold text-gray-900 mb-4">Estadísticas Generales</h2>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                                                        <User className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                                                        <p className="text-3xl font-bold text-blue-700">{reportData.statistics.total_rostros_detectados}</p>
                                                        <p className="text-sm text-gray-600 mt-1">Rostros Detectados</p>
                                                    </div>
                                                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                                                        <Eye className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                                                        <p className="text-3xl font-bold text-purple-700">{reportData.statistics.total_gestos}</p>
                                                        <p className="text-sm text-gray-600 mt-1">Gestos Detectados</p>
                                                    </div>
                                                    <div className="bg-red-50 p-4 rounded-lg text-center">
                                                        <UserX className="w-8 h-8 text-red-600 mx-auto mb-2" />
                                                        <p className="text-3xl font-bold text-red-700">{reportData.statistics.total_ausencias}</p>
                                                        <p className="text-sm text-gray-600 mt-1">Ausencias</p>
                                                    </div>
                                                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                                                        <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                                        <p className="text-3xl font-bold text-gray-700">
                                                            {formatTime(reportData.statistics.tiempo_total_ausencia_segundos)}
                                                        </p>
                                                        <p className="text-sm text-gray-600 mt-1">Tiempo Ausente</p>
                                                    </div>
                                                    <div className="bg-green-50 p-4 rounded-lg text-center">
                                                        <Volume2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                                                        <p className="text-3xl font-bold text-green-700">{reportData.statistics.total_hablantes}</p>
                                                        <p className="text-sm text-gray-600 mt-1">Voces Detectadas</p>
                                                    </div>
                                                    <div className="bg-yellow-50 p-4 rounded-lg text-center">
                                                        <Lightbulb className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                                                        <p className="text-3xl font-bold text-yellow-700">{reportData.statistics.total_anomalias_iluminacion}</p>
                                                        <p className="text-sm text-gray-600 mt-1">Anomalías Iluminación</p>
                                                    </div>
                                                    <div className="bg-pink-50 p-4 rounded-lg text-center">
                                                        <MessageSquare className="w-8 h-8 text-pink-600 mx-auto mb-2" />
                                                        <p className="text-3xl font-bold text-pink-700">{reportData.statistics.total_anomalias_lipsync}</p>
                                                        <p className="text-sm text-gray-600 mt-1">Anomalías Lipsync</p>
                                                    </div>
                                                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                                                        <AlertTriangle className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                                                        <p className="text-3xl font-bold text-orange-700">{reportData.statistics.total_anomalias_voz}</p>
                                                        <p className="text-sm text-gray-600 mt-1">Susurros</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab: Análisis de Comportamiento */}
                                    {activeTab === 'comportamiento' && (
                                        <div className="flex flex-col lg:flex-row gap-6">
                                            {/* Video Player - Lado Izquierdo */}
                                            <div className="lg:w-[55%]">
                                                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                                                    <Activity className="w-6 h-6 text-blue-600" />
                                                    Video de la Evaluación
                                                </h2>
                                                <div className="relative bg-black rounded-lg overflow-hidden sticky top-4">
                                                    <video
                                                        ref={videoRef}
                                                        src={reportData.analysis.video_link}
                                                        controls
                                                        onError={handleVideoError}
                                                        className="w-full"
                                                        style={{ maxHeight: '70vh' }}
                                                    >
                                                        Tu navegador no soporta la reproducción de video.
                                                    </video>
                                                </div>
                                                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                    <p className="text-sm text-blue-800">
                                                        <strong>💡 Tip:</strong> Haz clic en cualquier detección para ir a ese momento en el video.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Detecciones - Lado Derecho */}
                                            <div className="lg:w-[45%] flex flex-col">
                                                <h2 className="text-xl font-bold text-gray-900 mb-4">Detecciones</h2>

                                                {/* Tabs de Detecciones */}
                                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col h-[600px]">
                                                    {/* Botones de detección distribuidos en varias filas si hay espacio */}
                                                    <div className="flex flex-wrap gap-2 border-b border-gray-200 px-2 py-2">
                                                        {reportData.registros.ausencias.length > 0 && (
                                                            <button
                                                                onClick={() => setActiveDetectionTab('ausencias')}
                                                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeDetectionTab === 'ausencias'
                                                                    ? 'border-b-2 border-red-600 text-red-600 bg-red-50'
                                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <UserX className="w-4 h-4 inline-block mr-1" />
                                                                Ausencias ({reportData.registros.ausencias.length})
                                                            </button>
                                                        )}
                                                        {reportData.registros.gestos.length > 0 && (
                                                            <button
                                                                onClick={() => setActiveDetectionTab('gestos')}
                                                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeDetectionTab === 'gestos'
                                                                    ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50'
                                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <Eye className="w-4 h-4 inline-block mr-1" />
                                                                Gestos ({reportData.registros.gestos.length})
                                                            </button>
                                                        )}
                                                        {reportData.registros.iluminacion.length > 0 && (
                                                            <button
                                                                onClick={() => setActiveDetectionTab('iluminacion')}
                                                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeDetectionTab === 'iluminacion'
                                                                    ? 'border-b-2 border-yellow-600 text-yellow-600 bg-yellow-50'
                                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <Lightbulb className="w-4 h-4 inline-block mr-1" />
                                                                Iluminación ({reportData.registros.iluminacion.length})
                                                            </button>
                                                        )}
                                                        {reportData.registros.voz.length > 0 && (
                                                            <button
                                                                onClick={() => setActiveDetectionTab('voz')}
                                                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeDetectionTab === 'voz'
                                                                    ? 'border-b-2 border-green-600 text-green-600 bg-green-50'
                                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <Volume2 className="w-4 h-4 inline-block mr-1" />
                                                                Voz ({reportData.registros.voz.length})
                                                            </button>
                                                        )}
                                                        {reportData.registros.lipsync.length > 0 && (
                                                            <button
                                                                onClick={() => setActiveDetectionTab('lipsync')}
                                                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeDetectionTab === 'lipsync'
                                                                    ? 'border-b-2 border-pink-600 text-pink-600 bg-pink-50'
                                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <MessageSquare className="w-4 h-4 inline-block mr-1" />
                                                                Lipsync ({reportData.registros.lipsync.length})
                                                            </button>
                                                        )}
                                                        {reportData.registros.rostros.length > 0 && (
                                                            <button
                                                                onClick={() => setActiveDetectionTab('rostros')}
                                                                className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeDetectionTab === 'rostros'
                                                                    ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                                                    }`}
                                                            >
                                                                <User className="w-4 h-4 inline-block mr-1" />
                                                                Rostros ({reportData.registros.rostros.length})
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Contenido de Detecciones */}
                                                    <div className="flex-1 p-6 overflow-y-auto">
                                                        {/* Ausencias */}
                                                        {activeDetectionTab === 'ausencias' && reportData.registros.ausencias.length > 0 && (
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                                    <UserX className="w-5 h-5 text-red-600" />
                                                                    Ausencias Detectadas
                                                                </h3>
                                                                <div className="flex flex-wrap gap-2 overflow-y-auto">
                                                                    {reportData.registros.ausencias.map((ausencia) => (
                                                                        <div
                                                                            key={ausencia.id}
                                                                            className="p-3 bg-red-50 rounded-lg hover:bg-red-100 transition cursor-pointer min-w-[180px] max-w-xs flex-1"
                                                                            onClick={() => seekToTime(ausencia.tiempo_inicio)}
                                                                        >
                                                                            <p className="text-sm font-medium text-gray-900">
                                                                                Duración: {formatTime(ausencia.duracion)}
                                                                            </p>
                                                                            <p className="text-xs text-gray-600">
                                                                                {formatTime(ausencia.tiempo_inicio)} - {formatTime(ausencia.tiempo_fin)}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Gestos */}
                                                        {activeDetectionTab === 'gestos' && reportData.registros.gestos.length > 0 && (
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                                    <Eye className="w-5 h-5 text-purple-600" />
                                                                    Gestos Detectados
                                                                </h3>
                                                                {/* Agrupar por tipo_gesto */}
                                                                {Object.entries(
                                                                    reportData.registros.gestos.reduce<Record<string, typeof reportData.registros.gestos>>((acc, gesto) => {
                                                                        const key = gesto.tipo_gesto || 'Sin tipo';
                                                                        if (!acc[key]) acc[key] = [];
                                                                        acc[key].push(gesto);
                                                                        return acc;
                                                                    }, {})
                                                                ).map(([tipoGesto, gestos]) => {
                                                                    const groupKey = `gestos-${tipoGesto}`;
                                                                    const isCollapsed = collapsedGroups[groupKey];
                                                                    return (
                                                                        <div key={tipoGesto} className="mb-6 w-full">
                                                                            <button
                                                                                className="flex items-center gap-1 text-md font-semibold text-purple-700 mb-2 focus:outline-none"
                                                                                onClick={() => toggleGroup(groupKey)}
                                                                            >
                                                                                {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                                                <span className="text-lg">👁️</span> {tipoGesto}
                                                                            </button>
                                                                            {!isCollapsed && (
                                                                                <div className="flex flex-wrap gap-2 overflow-y-auto">
                                                                                    {gestos.map((gesto) => (
                                                                                        <div
                                                                                            key={gesto.id}
                                                                                            className="p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition cursor-pointer min-w-[180px] max-w-xs flex-1"
                                                                                            onClick={() => seekToTime(gesto.tiempo_inicio)}
                                                                                        >
                                                                                            <p className="text-sm font-medium text-gray-900">
                                                                                                {formatTime(gesto.tiempo_inicio)} - {formatTime(gesto.tiempo_fin)}
                                                                                            </p>
                                                                                            <p className="text-xs text-gray-600">
                                                                                                Duración: {formatTime(gesto.duracion)}
                                                                                            </p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Iluminación */}
                                                        {activeDetectionTab === 'iluminacion' && reportData.registros.iluminacion.length > 0 && (
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                                    <Lightbulb className="w-5 h-5 text-yellow-600" />
                                                                    Anomalías de Iluminación
                                                                </h3>
                                                                <div className="flex flex-wrap gap-2 overflow-y-auto">
                                                                    {reportData.registros.iluminacion.map((ilum) => (
                                                                        <div
                                                                            key={ilum.id}
                                                                            className="p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition cursor-pointer min-w-[180px] max-w-xs flex-1"
                                                                            onClick={() => seekToTime(ilum.tiempo_inicio)}
                                                                        >
                                                                            <p className="text-sm font-medium text-gray-900">Anomalía</p>
                                                                            <p className="text-xs text-gray-600">
                                                                                {formatTime(ilum.tiempo_inicio)} - {formatTime(ilum.tiempo_fin)}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Voz */}
                                                        {activeDetectionTab === 'voz' && reportData.registros.voz.length > 0 && (
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                                    <Volume2 className="w-5 h-5 text-green-600" />
                                                                    Análisis de Voz
                                                                </h3>
                                                                {/* Susurros */}
                                                                {reportData.registros.voz.some(v => v.tipo_log === 'susurro') && (
                                                                    <div className="mb-6 w-full">
                                                                        <button
                                                                            className="flex items-center gap-1 text-md font-semibold text-green-700 mb-2 focus:outline-none"
                                                                            onClick={() => toggleGroup('voz-susurros')}
                                                                        >
                                                                            {collapsedGroups['voz-susurros'] ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                                            <span className="text-lg">🤫</span> Susurros
                                                                        </button>
                                                                        {!collapsedGroups['voz-susurros'] && (
                                                                            <div className="flex flex-wrap gap-2 overflow-y-auto">
                                                                                {reportData.registros.voz.filter(v => v.tipo_log === 'susurro').map((voz) => (
                                                                                    <div
                                                                                        key={voz.id}
                                                                                        className="p-3 bg-green-50 rounded-lg hover:bg-green-100 transition cursor-pointer min-w-[180px] max-w-xs flex-1"
                                                                                        onClick={() => seekToTime(voz.tiempo_inicio)}
                                                                                    >
                                                                                        <p className="text-sm font-medium text-gray-900">
                                                                                            {formatTime(voz.tiempo_inicio)} - {formatTime(voz.tiempo_fin)}
                                                                                        </p>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {/* Hablantes agrupados por etiqueta_hablante */}
                                                                {reportData.registros.voz.some(v => v.tipo_log !== 'susurro') && (
                                                                    <div className="w-full">
                                                                        <button
                                                                            className="flex items-center gap-1 text-md font-semibold text-green-700 mb-2 focus:outline-none"
                                                                            onClick={() => toggleGroup('voz-hablantes')}
                                                                        >
                                                                            {collapsedGroups['voz-hablantes'] ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                                            <span className="text-lg">🗣️</span> Hablantes
                                                                        </button>
                                                                        {!collapsedGroups['voz-hablantes'] && (
                                                                            <div>
                                                                                {Object.entries(
                                                                                    reportData.registros.voz.filter(v => v.tipo_log !== 'susurro').reduce<Record<string, typeof reportData.registros.voz>>((acc, voz) => {
                                                                                        const key = voz.etiqueta_hablante || 'Hablante';
                                                                                        if (!acc[key]) acc[key] = [];
                                                                                        acc[key].push(voz);
                                                                                        return acc;
                                                                                    }, {})
                                                                                ).map(([etiqueta, voces]) => {
                                                                                    const groupKey = `voz-hablante-${etiqueta}`;
                                                                                    const isCollapsed = collapsedGroups[groupKey];
                                                                                    return (
                                                                                        <div key={etiqueta} className="mb-4 w-full">
                                                                                            <button
                                                                                                className="flex items-center gap-1 text-sm font-semibold text-green-600 mb-2 focus:outline-none"
                                                                                                onClick={() => toggleGroup(groupKey)}
                                                                                            >
                                                                                                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                                                {etiqueta}
                                                                                            </button>
                                                                                            {!isCollapsed && (
                                                                                                <div className="flex flex-wrap gap-2 overflow-y-auto">
                                                                                                    {voces.map((voz) => (
                                                                                                        <div
                                                                                                            key={voz.id}
                                                                                                            className="p-3 bg-green-50 rounded-lg hover:bg-green-100 transition cursor-pointer min-w-[180px] max-w-xs flex-1"
                                                                                                            onClick={() => seekToTime(voz.tiempo_inicio)}
                                                                                                        >
                                                                                                            <p className="text-sm font-medium text-gray-900">
                                                                                                                {formatTime(voz.tiempo_inicio)} - {formatTime(voz.tiempo_fin)}
                                                                                                            </p>
                                                                                                        </div>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Lipsync */}
                                                        {activeDetectionTab === 'lipsync' && reportData.registros.lipsync.length > 0 && (
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                                    <MessageSquare className="w-5 h-5 text-pink-600" />
                                                                    Anomalías Lipsync
                                                                </h3>
                                                                {/* Agrupar por tipo_anomalia */}
                                                                {Object.entries(
                                                                    reportData.registros.lipsync.reduce<Record<string, typeof reportData.registros.lipsync>>((acc, lipsync) => {
                                                                        const key = lipsync.tipo_anomalia || 'Sin tipo';
                                                                        if (!acc[key]) acc[key] = [];
                                                                        acc[key].push(lipsync);
                                                                        return acc;
                                                                    }, {})
                                                                ).map(([tipoAnomalia, lipsyncs]) => {
                                                                    const groupKey = `lipsync-${tipoAnomalia}`;
                                                                    const isCollapsed = collapsedGroups[groupKey];
                                                                    return (
                                                                        <div key={tipoAnomalia} className="mb-6 w-full">
                                                                            <button
                                                                                className="flex items-center gap-1 text-md font-semibold text-pink-700 mb-2 focus:outline-none"
                                                                                onClick={() => toggleGroup(groupKey)}
                                                                            >
                                                                                {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                                                <span className="text-lg">👄</span> {tipoAnomalia}
                                                                            </button>
                                                                            {!isCollapsed && (
                                                                                <div className="flex flex-wrap gap-2 overflow-y-auto">
                                                                                    {lipsyncs.map((lipsync) => (
                                                                                        <div
                                                                                            key={lipsync.id}
                                                                                            className="p-3 bg-pink-50 rounded-lg hover:bg-pink-100 transition cursor-pointer min-w-[180px] max-w-xs flex-1"
                                                                                            onClick={() => seekToTime(lipsync.tiempo_inicio)}
                                                                                        >
                                                                                            <p className="text-sm font-medium text-gray-900">
                                                                                                {formatTime(lipsync.tiempo_inicio)} - {formatTime(lipsync.tiempo_fin)}
                                                                                            </p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {/* Rostros */}
                                                        {activeDetectionTab === 'rostros' && reportData.registros.rostros.length > 0 && (
                                                            <div>
                                                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                                    <User className="w-5 h-5 text-blue-600" />
                                                                    Detección de Rostros
                                                                </h3>
                                                                {/* Agrupar por persona_id */}
                                                                {Object.entries(
                                                                    reportData.registros.rostros.reduce<Record<string, typeof reportData.registros.rostros>>((acc, rostro) => {
                                                                        const key = rostro.persona_id?.toString() ?? 'Sin ID';
                                                                        if (!acc[key]) acc[key] = [];
                                                                        acc[key].push(rostro);
                                                                        return acc;
                                                                    }, {})
                                                                ).map(([personaId, rostros]) => {
                                                                    const groupKey = `rostros-${personaId}`;
                                                                    const isCollapsed = collapsedGroups[groupKey];
                                                                    return (
                                                                        <div key={personaId} className="mb-6 w-full">
                                                                            <button
                                                                                className="flex items-center gap-1 text-md font-semibold text-blue-700 mb-2 focus:outline-none"
                                                                                onClick={() => toggleGroup(groupKey)}
                                                                            >
                                                                                {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                                                <span className="text-lg">🧑</span> Persona #{personaId}
                                                                            </button>
                                                                            {!isCollapsed && (
                                                                                <div className="flex flex-wrap gap-2 overflow-y-auto">
                                                                                    {rostros.map((rostro) => (
                                                                                        <div
                                                                                            key={rostro.id}
                                                                                            className="p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition cursor-pointer min-w-[180px] max-w-xs flex-1"
                                                                                            onClick={() => seekToTime(rostro.tiempo_inicio)}
                                                                                        >
                                                                                            <p className="text-sm font-medium text-gray-900">
                                                                                                {formatTime(rostro.tiempo_inicio)} - {formatTime(rostro.tiempo_fin)}
                                                                                            </p>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab: Puntuaciones */}
                                    {activeTab === 'puntuaciones' && (
                                        <div className="space-y-6">
                                            {/* Función auxiliar para calcular puntuaciones */}
                                            {(() => {
                                                const duracionTotal = reportData.monitoring.total_duration_seconds || 1;

                                                // 1. Presencia Continua (100 - penalización por ausencias)
                                                const tiempoAusencia = reportData.statistics.tiempo_total_ausencia_segundos;
                                                const porcentajeAusencia = (tiempoAusencia / duracionTotal) * 100;
                                                let puntuacionPresencia = 100 - Math.round(tiempoAusencia * 2); // -2 puntos por cada segundo de ausencia
                                                // Penalización adicional si supera el 10% de ausencia
                                                if (porcentajeAusencia > 10) {
                                                    puntuacionPresencia = Math.round(puntuacionPresencia / 2);
                                                }
                                                puntuacionPresencia = Math.min(100, Math.max(0, puntuacionPresencia));

                                                // 2. Comportamiento Visual (penalización por gestos sospechosos)
                                                const gestosTotal = reportData.statistics.total_gestos;
                                                const penalizacionGestos = gestosTotal * 3; // -3 puntos por cada gesto
                                                const puntuacionComportamiento = Math.min(100, Math.max(0, 100 - penalizacionGestos));

                                                // 3. Calidad de Audio (penalización por susurros y múltiples hablantes)
                                                const susurros = reportData.statistics.total_anomalias_voz;
                                                const hablantes = reportData.statistics.total_hablantes;
                                                const penalizacionAudio = (susurros * 5) + (hablantes > 1 ? 20 : 0); // -5 por susurro, -20 si hay múltiples hablantes
                                                const puntuacionAudio = Math.min(100, Math.max(0, 100 - penalizacionAudio));

                                                // 4. Sincronización Labial
                                                const anomaliasLipsync = reportData.statistics.total_anomalias_lipsync;
                                                const penalizacionLipsync = anomaliasLipsync * 6; // -6 puntos por cada anomalía
                                                const puntuacionLipsync = Math.min(100, Math.max(0, 100 - penalizacionLipsync));

                                                // 5. Condiciones de Iluminación
                                                const anomaliasIlum = reportData.statistics.total_anomalias_iluminacion;
                                                const penalizacionIlum = anomaliasIlum * 3; // -3 puntos por cada anomalía
                                                const puntuacionIluminacion = Math.min(100, Math.max(0, 100 - penalizacionIlum));

                                                // 6. Consistencia de Identidad (basado en personas únicas detectadas)
                                                const personasUnicas = new Set(
                                                    reportData.registros.rostros
                                                        .map(r => r.persona_id)
                                                        .filter(id => id !== null && id !== undefined)
                                                ).size;
                                                const totalRegistrosRostro = reportData.registros.rostros.length;

                                                // Base: 100 puntos si solo hay 1 persona
                                                let puntuacionIdentidad = 100;

                                                // Penalización si no hay personas detectadas (muy grave)
                                                if (personasUnicas === 0 || totalRegistrosRostro === 0) {
                                                    puntuacionIdentidad = 0; // Sin detección = 0 puntos
                                                }
                                                // Penalización por personas adicionales (muy grave)
                                                else if (personasUnicas > 1) {
                                                    puntuacionIdentidad -= (personasUnicas - 1) * 20; // -20 puntos por cada persona extra
                                                }

                                                puntuacionIdentidad = Math.min(100, Math.max(0, puntuacionIdentidad));

                                                // 7. Navegación y Actividad (penalización por peticiones bloqueadas y desconexiones del proxy)
                                                const peticionesBloqueadas = reportData.statistics.total_blocked_requests;
                                                const desconexionesProxy = reportData.statistics.total_proxy_disconnections;
                                                const penalizacionNavegacion = peticionesBloqueadas * 5 + desconexionesProxy * 15; // -5 por petición, -15 por desconexión
                                                const puntuacionNavegacion = Math.min(100, Math.max(0, 100 - penalizacionNavegacion));

                                                // 8. Continuidad de la Sesión (basado en interrupciones)
                                                const sesiones = reportData.monitoring.sessions_count;
                                                const penalizacionContinuidad = (sesiones - 1) * 10; // -10 puntos por cada sesión adicional
                                                const puntuacionContinuidad = Math.min(100, Math.max(0, 100 - penalizacionContinuidad));

                                                // Puntuación General (promedio ponderado)
                                                const puntuacionGeneral = (
                                                    puntuacionPresencia * 0.30 +
                                                    puntuacionComportamiento * 0.15 +
                                                    puntuacionAudio * 0.15 +
                                                    puntuacionLipsync * 0.05 +
                                                    puntuacionIluminacion * 0.05 +
                                                    puntuacionIdentidad * 0.10 +
                                                    puntuacionNavegacion * 0.10 +
                                                    puntuacionContinuidad * 0.10
                                                );

                                                const getColorClass = (score: number) => {
                                                    if (score >= 85) return 'text-green-600 bg-green-50 border-green-200';
                                                    if (score >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
                                                    if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
                                                    return 'text-red-600 bg-red-50 border-red-200';
                                                };

                                                const getColorBar = (score: number) => {
                                                    if (score >= 85) return 'bg-green-500';
                                                    if (score >= 70) return 'bg-yellow-500';
                                                    if (score >= 50) return 'bg-orange-500';
                                                    return 'bg-red-500';
                                                };

                                                const dimensiones = [
                                                    {
                                                        nombre: 'Presencia Continua',
                                                        puntuacion: puntuacionPresencia,
                                                        peso: 30,
                                                        descripcion: 'Evaluación de la presencia del participante durante la evaluación',
                                                        icono: '👤',
                                                        metricas: [
                                                            { label: 'Tiempo total de ausencia', valor: formatTime(tiempoAusencia) },
                                                            { label: 'Porcentaje de ausencia', valor: `${porcentajeAusencia.toFixed(1)}%` },
                                                            { label: 'Ausencias detectadas', valor: reportData.statistics.total_ausencias }
                                                        ]
                                                    },
                                                    {
                                                        nombre: 'Comportamiento Visual',
                                                        puntuacion: puntuacionComportamiento,
                                                        peso: 15,
                                                        descripcion: 'Análisis de gestos y comportamientos visuales durante la evaluación',
                                                        icono: '👁️',
                                                        metricas: [
                                                            { label: 'Gestos detectados', valor: gestosTotal },
                                                            { label: 'Frecuencia promedio', valor: `${(gestosTotal / (duracionTotal / 60)).toFixed(1)}/min` }
                                                        ]
                                                    },
                                                    {
                                                        nombre: 'Calidad de Audio',
                                                        puntuacion: puntuacionAudio,
                                                        peso: 15,
                                                        descripcion: 'Evaluación de la calidad del audio y detección de múltiples voces',
                                                        icono: '🎤',
                                                        metricas: [
                                                            { label: 'Susurros detectados', valor: susurros },
                                                            { label: 'Hablantes identificados', valor: hablantes }
                                                        ]
                                                    },
                                                    {
                                                        nombre: 'Consistencia de Identidad',
                                                        puntuacion: puntuacionIdentidad,
                                                        peso: 10,
                                                        descripcion: 'Verificación de personas únicas detectadas durante la evaluación',
                                                        icono: '🎭',
                                                        metricas: [
                                                            { label: 'Personas únicas detectadas', valor: personasUnicas },
                                                            { label: 'Intervalos de detección', valor: totalRegistrosRostro },
                                                            { label: 'Estado', valor: personasUnicas === 1 ? '✅ Solo el participante' : `⚠️ ${personasUnicas} personas diferentes` }
                                                        ]
                                                    },
                                                    {
                                                        nombre: 'Navegación y Seguridad',
                                                        puntuacion: puntuacionNavegacion,
                                                        peso: 10,
                                                        descripcion: 'Evaluación de intentos de navegación no permitida',
                                                        icono: '🌐',
                                                        metricas: [
                                                            { label: 'Peticiones bloqueadas', valor: peticionesBloqueadas },
                                                            { label: 'Intentos por minuto', valor: `${((peticionesBloqueadas / (duracionTotal / 60)) || 0).toFixed(1)}/min` },
                                                            { label: 'Desconexiones del proxy', valor: reportData.statistics.total_proxy_disconnections, destacado: reportData.statistics.total_proxy_disconnections > 0 }
                                                        ]
                                                    },
                                                    {
                                                        nombre: 'Continuidad de la Sesión',
                                                        puntuacion: puntuacionContinuidad,
                                                        peso: 10,
                                                        descripcion: 'Evaluación de interrupciones y pausas durante la evaluación',
                                                        icono: '🔄',
                                                        metricas: [
                                                            { label: 'Sesiones de monitoreo', valor: sesiones },
                                                            { label: 'Interrupciones', valor: sesiones > 1 ? sesiones - 1 : 0 },
                                                            { label: 'Duración', valor: formatTime(duracionTotal / sesiones) }
                                                        ]
                                                    },
                                                    {
                                                        nombre: 'Sincronización Labial',
                                                        puntuacion: puntuacionLipsync,
                                                        peso: 5,
                                                        descripcion: 'Análisis de sincronización entre labios y audio',
                                                        icono: '💬',
                                                        metricas: [
                                                            { label: 'Anomalías detectadas', valor: anomaliasLipsync },
                                                            { label: 'Tasa de anomalías', valor: `${((anomaliasLipsync / (duracionTotal / 60)) || 0).toFixed(1)}/min` }
                                                        ]
                                                    },
                                                    {
                                                        nombre: 'Condiciones de Iluminación',
                                                        puntuacion: puntuacionIluminacion,
                                                        peso: 5,
                                                        descripcion: 'Evaluación de las condiciones de iluminación durante la evaluación',
                                                        icono: '💡',
                                                        metricas: [
                                                            { label: 'Anomalías detectadas', valor: anomaliasIlum },
                                                            { label: 'Frecuencia', valor: `${((anomaliasIlum / (duracionTotal / 60)) || 0).toFixed(1)}/min` }
                                                        ]
                                                    }
                                                ];

                                                return (
                                                    <>
                                                        {/* Puntuación General */}
                                                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-8 shadow-lg">
                                                            <div className="text-center">
                                                                <h2 className="text-3xl font-bold text-gray-900 mb-2">Puntuación General</h2>
                                                                <div className={`inline-block px-8 py-6 rounded-2xl border-2 ${getColorClass(puntuacionGeneral)} mb-4`}>
                                                                    <p className="text-7xl font-bold">{puntuacionGeneral.toFixed(1)}</p>
                                                                    <p className="text-xl font-semibold mt-2">de 100</p>
                                                                </div>
                                                                <p className="text-gray-600 mt-4 text-lg">
                                                                    {puntuacionGeneral >= 85 && '🎉 Excelente desempeño. No se detectaron anomalías significativas.'}
                                                                    {puntuacionGeneral >= 70 && puntuacionGeneral < 85 && '✅ Buen desempeño. Se detectaron algunas anomalías menores.'}
                                                                    {puntuacionGeneral >= 50 && puntuacionGeneral < 70 && '⚠️ Desempeño regular. Se detectaron varias anomalías que requieren atención.'}
                                                                    {puntuacionGeneral < 50 && '🚨 Desempeño deficiente. Se detectaron múltiples anomalías significativas.'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Dimensiones Evaluadas */}
                                                        <div>
                                                            <h2 className="text-2xl font-bold text-gray-900 mb-6">Evaluación por Dimensiones</h2>
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                {dimensiones.map((dim, index) => (
                                                                    <div key={index} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition">
                                                                        <div className="flex items-start gap-4">
                                                                            <div className="text-5xl">{dim.icono}</div>
                                                                            <div className="flex-1">
                                                                                <div className="flex items-start justify-between mb-2">
                                                                                    <div className="flex-1">
                                                                                        <h3 className="text-xl font-bold text-gray-900">{dim.nombre}</h3>
                                                                                        <p className="text-sm text-blue-600 font-medium mt-1">Pesa {dim.peso}% en la nota final</p>
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            setInfoModalOpen(dim.nombre);
                                                                                        }}
                                                                                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded-full transition"
                                                                                        title="Ver información de penalización"
                                                                                    >
                                                                                        <Info className="w-5 h-5" />
                                                                                    </button>
                                                                                </div>
                                                                                <p className="text-sm text-gray-600 mb-4">{dim.descripcion}</p>

                                                                                {/* Barra de Progreso */}
                                                                                <div className="mb-4">
                                                                                    <div className="flex justify-between items-center mb-2">
                                                                                        <span className="text-sm font-semibold text-gray-700">Puntuación</span>
                                                                                        <span className={`text-lg font-bold ${getColorClass(dim.puntuacion).split(' ')[0]}`}>
                                                                                            {Math.round(dim.puntuacion)}/100
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                                                                        <div
                                                                                            className={`h-full rounded-full transition-all duration-500 ${getColorBar(dim.puntuacion)}`}
                                                                                            style={{ width: `${dim.puntuacion}%` }}
                                                                                        />
                                                                                    </div>
                                                                                </div>

                                                                                {/* Métricas */}
                                                                                <div className="space-y-2">
                                                                                    {dim.metricas.map((metrica, idx) => (
                                                                                        <div key={idx} className={`flex justify-between items-center text-sm ${metrica.destacado ? 'bg-red-50 -mx-2 px-2 py-1 rounded' : ''}`}>
                                                                                            <span className={metrica.destacado ? 'text-red-700 font-medium' : 'text-gray-600'}>{metrica.label}:</span>
                                                                                            <span className={`font-semibold ${metrica.destacado ? 'text-red-700' : 'text-gray-900'}`}>{metrica.valor}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Tab: Logs de Actividad */}
                                    {activeTab === 'actividad' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 gap-6">
                                                {/* Capturas de Pantalla */}
                                                <div className="bg-white border border-gray-200 rounded-lg p-6 lg:col-span-2">
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                        <Camera className="w-6 h-6 text-cyan-600" />
                                                        Capturas de Pantalla ({reportData.statistics.total_screenshots})
                                                    </h3>
                                                    {reportData.activity_logs.screenshots.length > 0 ? (
                                                        <>
                                                            {(() => {
                                                                // Agrupar por mensaje
                                                                const grouped = reportData.activity_logs.screenshots.reduce((acc, screenshot) => {
                                                                    const key = screenshot.message || 'Sin clasificar';
                                                                    if (!acc[key]) acc[key] = [];
                                                                    acc[key].push(screenshot);
                                                                    return acc;
                                                                }, {} as Record<string, typeof reportData.activity_logs.screenshots>);

                                                                const screenTypes = Object.keys(grouped).sort();
                                                                const hasMultipleScreens = screenTypes.length > 1;

                                                                return screenTypes.map((screenType) => (
                                                                    <div key={screenType} className="mb-6 last:mb-0">
                                                                        {hasMultipleScreens && (
                                                                            <div
                                                                                className="flex items-center justify-between cursor-pointer mb-4 pb-2 border-b border-gray-200 hover:bg-gray-50 p-2 rounded"
                                                                                onClick={() => toggleGroup(screenType)}
                                                                            >
                                                                                <h4 className="font-medium text-gray-800 flex items-center gap-2">
                                                                                    {collapsedGroups[screenType] ? (
                                                                                        <ChevronRight className="w-5 h-5" />
                                                                                    ) : (
                                                                                        <ChevronDown className="w-5 h-5" />
                                                                                    )}
                                                                                    {screenType} ({grouped[screenType].length})
                                                                                </h4>
                                                                            </div>
                                                                        )}
                                                                        {!collapsedGroups[screenType] && (
                                                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                                                                                {grouped[screenType].map((screenshot, index) => (
                                                                                    <div
                                                                                        key={screenshot.id}
                                                                                        className="group relative bg-gray-100 rounded-lg overflow-hidden aspect-video hover:ring-2 hover:ring-blue-500 transition cursor-pointer"
                                                                                        onClick={() => screenshot.url && openGallery(index, screenType)}
                                                                                    >
                                                                                        {screenshot.url ? (
                                                                                            <>
                                                                                                <img
                                                                                                    src={screenshot.url}
                                                                                                    alt={`Captura ${screenshot.id}`}
                                                                                                    onError={handleScreenshotError}
                                                                                                    className="w-full h-full object-cover"
                                                                                                />
                                                                                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                                                                                    <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium">
                                                                                                        Ver completa
                                                                                                    </span>
                                                                                                </div>
                                                                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                                                                                                    <p className="text-white text-xs">
                                                                                                        {new Date(screenshot.timestamp).toLocaleString('es-ES', {
                                                                                                            hour: '2-digit',
                                                                                                            minute: '2-digit',
                                                                                                            day: '2-digit',
                                                                                                            month: '2-digit'
                                                                                                        })}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </>
                                                                                        ) : (
                                                                                            <div className="w-full h-full flex items-center justify-center">
                                                                                                <Camera className="w-8 h-8 text-gray-400" />
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </>
                                                    ) : (
                                                        <p className="text-gray-500 text-center py-8">No hay capturas registradas</p>
                                                    )}
                                                </div>

                                                {/* Peticiones Bloqueadas */}
                                                <div className="bg-white border border-gray-200 rounded-lg p-6">
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                        <Shield className="w-6 h-6 text-red-600" />
                                                        Peticiones Bloqueadas ({reportData.statistics.total_blocked_requests})
                                                    </h3>
                                                    {reportData.activity_logs.blocked_requests.length > 0 ? (
                                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                                            {reportData.activity_logs.blocked_requests.map((request) => (
                                                                <div
                                                                    key={request.id}
                                                                    className="p-3 bg-red-50 rounded-lg hover:bg-red-100 transition"
                                                                >
                                                                    <div className="flex items-start gap-2">
                                                                        <Shield className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium text-gray-900 break-words">
                                                                                {request.message.replace(/⛔/g, '').replace(/Blocked URL:/g, '').trim()}
                                                                            </p>
                                                                            <p className="text-xs text-gray-600 mt-1">
                                                                                {new Date(request.timestamp).toLocaleString('es-ES')}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-gray-500 text-center py-8">No hay peticiones bloqueadas</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Información de Penalización */}
            {infoModalOpen && penalizacionInfo[infoModalOpen] && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                    onClick={() => setInfoModalOpen(null)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-gray-600 to-gray-700 text-white p-6 rounded-t-xl">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <Info className="w-8 h-8" />
                                    <div>
                                        <h3 className="text-2xl font-bold">{penalizacionInfo[infoModalOpen].titulo}</h3>
                                        <p className="text-gray-100 mt-1 text-sm">Sistema de Penalización</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setInfoModalOpen(null)}
                                    className="text-white hover:bg-white/20 p-2 rounded-full transition"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="mb-6">
                                <h4 className="text-lg font-semibold text-gray-900 mb-2">Descripción</h4>
                                <p className="text-gray-700 leading-relaxed">
                                    {penalizacionInfo[infoModalOpen].descripcion}
                                </p>
                            </div>

                            <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-lg p-5 border border-blue-100">
                                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                                    Sistema de Penalización
                                </h4>
                                <ul className="space-y-3">
                                    {penalizacionInfo[infoModalOpen].penalizaciones.map((pen, idx) => (
                                        <li key={idx} className="text-gray-700 leading-relaxed flex items-start gap-2">
                                            {pen.startsWith('•') ? (
                                                <span className="text-blue-600 font-bold mt-1">•</span>
                                            ) : null}
                                            <span className={pen.startsWith('•') ? '' : 'font-medium text-gray-900'}>
                                                {pen.replace('• ', '')}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-sm text-blue-900">
                                    <strong>Nota:</strong> Las penalizaciones se aplican automáticamente según los eventos detectados durante el análisis.
                                    La puntuación final refleja la calidad y cumplimiento de los estándares de evaluación.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Galería de Capturas */}
            {isGalleryOpen && reportData && selectedScreenGroup && (() => {
                const filteredScreenshots = reportData.activity_logs.screenshots.filter(s => s.message === selectedScreenGroup);
                return filteredScreenshots[currentImageIndex] ? (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50"
                        onClick={closeGallery}
                    >
                        {/* Botón Cerrar */}
                        <button
                            onClick={closeGallery}
                            className="absolute top-6 right-6 z-20 p-3 bg-white rounded-full hover:bg-gray-200 transition shadow-lg"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Botón Anterior (fuera de la imagen) */}
                        {currentImageIndex > 0 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goToPrevious();
                                }}
                                className="absolute left-8 z-20 p-4 bg-white rounded-full hover:bg-gray-200 transition shadow-lg"
                            >
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}

                        {/* Contenedor de Imagen */}
                        <div
                            className="flex flex-col items-center justify-center max-w-[85vw] max-h-screen px-24"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={filteredScreenshots[currentImageIndex].url || ''}
                                alt={`Captura ${currentImageIndex + 1}`}
                                onError={handleScreenshotError}
                                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            />
                            <div className="mt-4 text-white text-center">
                                <p className="text-lg font-semibold">
                                    {selectedScreenGroup} - Captura {currentImageIndex + 1} de {filteredScreenshots.length}
                                </p>
                                <p className="text-sm text-gray-300 mt-1">
                                    {new Date(filteredScreenshots[currentImageIndex].timestamp).toLocaleString('es-ES', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit'
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Botón Siguiente (fuera de la imagen) */}
                        {currentImageIndex < filteredScreenshots.length - 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    goToNext();
                                }}
                                className="absolute right-8 z-20 p-4 bg-white rounded-full hover:bg-gray-200 transition shadow-lg"
                            >
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                ) : null;
            })()}
        </div>
    );
}

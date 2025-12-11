import { useState, useEffect } from 'react';
import monitoringService from '../../services/monitoringService';
import { API_URL } from '../../services/authService';
import type { ParticipantLog, ConnectionStats } from '../../services/monitoringService';
import Sidebar from '../utils/Sidebar';

interface MonitoringPageProps {
    eventId: string;
    participantId: string;
    onBack: () => void;
    onNavigate: (page: string) => void;
    onLogout?: () => void;
}

const MonitoringPage = ({ eventId, participantId, onBack, onNavigate, onLogout }: MonitoringPageProps) => {
    const [logs, setLogs] = useState<ParticipantLog[]>([]);
    const [eventName, setEventName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);
    const [filterType, setFilterType] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const LOGS_PER_PAGE = 4;

    // Función para convertir timestamp UTC a zona horaria local
    function parseUTCTimestamp(
        timestamp?: string | number,
        targetTimeZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
    ) {
        if (!timestamp) {
            return '';
        }

        let utcDate: Date;

        if (typeof timestamp === 'number') {
            // Si es un número, asumimos que es un timestamp Unix (segundos desde epoch)
            utcDate = new Date(timestamp * 1000);
        } else {
            // Verificar si es formato ISO (contiene 'T' y posiblemente 'Z')
            if (timestamp.includes('T')) {
                // Formato ISO: "2025-12-11T22:55:02.684Z" o similar
                utcDate = new Date(timestamp);
            } else {
                // Formato personalizado: "DD/MM/YYYY HH:MM:SS" (en UTC desde el backend)
                const [dateStr, timeStr] = timestamp.split(' ');
                if (!dateStr || !timeStr) return timestamp;

                const [day, month, year] = dateStr.split('/');
                const [hStr, mStr, sStr] = timeStr.split(':');

                if (!day || !month || !year || !hStr || !mStr || !sStr) return timestamp;

                // Construir fecha UTC
                const utcMs = Date.UTC(
                    parseInt(year, 10),
                    parseInt(month, 10) - 1,
                    parseInt(day, 10),
                    parseInt(hStr, 10),
                    parseInt(mStr, 10),
                    parseInt(sStr, 10),
                    0
                );

                utcDate = new Date(utcMs);
            }
        }

        if (isNaN(utcDate.getTime())) {
            return typeof timestamp === 'string' ? timestamp : '';
        }

        // Formatear en la zona horaria local
        const fmt = new Intl.DateTimeFormat('es-EC', {
            timeZone: targetTimeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        // Extraer partes
        const parts = fmt.formatToParts(utcDate);
        const get = (type: Intl.DateTimeFormatPartTypes) =>
            parts.find(p => p.type === type)?.value ?? '';

        const localDay = get('day');
        const localMonth = get('month');
        const localYear = get('year');
        const localHour = get('hour');
        const localMinute = get('minute');
        const localSecond = get('second');

        return `${localDay}/${localMonth}/${localYear} ${localHour}:${localMinute}:${localSecond}`;
    }

    // Cargar logs y estadísticas al montar o cambiar eventId/participantId
    useEffect(() => {
        handleRefresh();
    }, [eventId, participantId]);

    const loadEventLogs = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await monitoringService.getEventLogs(eventId, participantId);

            setLogs(data.logs);
            setEventName(data.event.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar los logs');
            console.error('Error loading logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadConnectionStats = async (participantId: string) => {
        try {
            const stats = await monitoringService.getParticipantConnectionStats(eventId, participantId);
            setConnectionStats(stats);
        } catch (err) {
            console.error('Error loading connection stats:', err);
        }
    };

    // Nueva función para actualizar ambos
    const handleRefresh = async () => {
        setLoading(true);
        await Promise.all([
            loadEventLogs(),
            loadConnectionStats(participantId)
        ]);
        setLoading(false);
    };

    // Filtrar logs solo por tipo (el participante ya está filtrado)
    const filteredLogs = logs.filter(log => {
        const matchesType = filterType === 'all' || log.name === filterType;
        return matchesType;
    });

    // Calcular paginación
    const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE);
    const startIndex = (currentPage - 1) * LOGS_PER_PAGE;
    const endIndex = startIndex + LOGS_PER_PAGE;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    // Resetear a página 1 cuando cambian los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [filterType]);

    // Tipos de logs únicos
    const logTypes = Array.from(new Set(logs.map(log => log.name)));

    // Función para detectar si el archivo es un video
    const isVideoFile = (url: string): boolean => {
        const videoExtensions = ['.webm', '.mp4', '.avi', '.mov', '.mkv', '.m4v'];
        const lowerUrl = url.toLowerCase();
        return videoExtensions.some(ext => lowerUrl.includes(ext));
    };

    // Función para detectar si el archivo es una imagen
    const isImageFile = (url: string): boolean => {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'];
        const lowerUrl = url.toLowerCase();
        return imageExtensions.some(ext => lowerUrl.includes(ext));
    };

    const openMediaModal = (fileUrl: string) => {
        let normalizedUrl = fileUrl;
        try {
            if (normalizedUrl.startsWith('/')) {
                normalizedUrl = `${API_URL}${normalizedUrl}`;
            } else if (normalizedUrl.includes('localhost:5173')) {
                normalizedUrl = normalizedUrl.replace('localhost:5173', 'localhost:8000');
            }
        } catch (e) {
            console.error('Error normalizando file_url:', e);
        }
        setSelectedImage(normalizedUrl);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedImage(null);
    };

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} onLogout={onLogout} />

            <div className="flex-1 p-8">
                {/* Header */}
                <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                        <button
                            onClick={onBack}
                            className="mb-4 text-blue-600 hover:text-blue-800 flex items-center"
                        >
                            <svg
                                className="w-5 h-5 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                            Volver al Detalle de la Evaluación
                        </button>

                        <h1 className="text-3xl font-bold text-gray-900">
                            Monitorización - {eventName}
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Logs y estadísticas del participante
                        </p>
                    </div>
                    {/* Botón Actualizar arriba a la derecha de la página */}
                    <button
                        onClick={handleRefresh}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center mt-4 md:mt-0"
                    >
                        <svg
                            className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        Actualizar
                    </button>
                </div>

                {/* Estadísticas de conexión */}
                {connectionStats && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Estadísticas de Conexión
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Tiempo Total</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {connectionStats.total_time_minutes} min
                                </p>
                            </div>

                            {/* Estado del Monitoreo */}
                            <div className={`p-4 rounded-lg ${connectionStats.monitoring_is_active ? 'bg-green-50' : 'bg-red-50'}`}>
                                <p className="text-sm text-gray-600">Monitoreo</p>
                                <p className={`text-2xl font-bold ${connectionStats.monitoring_is_active ? 'text-green-600' : 'text-red-600'}`}>
                                    {connectionStats.monitoring_is_active ? 'Activo' : 'Inactivo'}
                                </p>
                            </div>

                            <div className="bg-purple-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Sesiones de Monitoreo</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {connectionStats.monitoring_sessions_count}
                                </p>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Último cambio monitoreo</p>
                                <p className="text-sm font-semibold text-yellow-700">
                                    {connectionStats.monitoring_last_change
                                        ? parseUTCTimestamp(connectionStats.monitoring_last_change)
                                        : 'N/A'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {loading && (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <p className="text-red-800">{error}</p>
                        <button
                            onClick={loadEventLogs}
                            className="mt-2 text-red-600 hover:text-red-800 underline"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                {/* Modal para visualizar medios (imagen/video) */}
                {isModalOpen && selectedImage && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={closeModal}>
                        <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold text-gray-900">
                                    Vista Previa - {isVideoFile(selectedImage) ? 'Video' : 'Imagen'}
                                </h3>
                                <div className="flex items-center space-x-2">
                                    <a
                                        href={selectedImage}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                        title="Abrir en nueva pestaña"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>
                                    <button
                                        onClick={closeModal}
                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                        title="Cerrar"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="flex justify-center">
                                {isVideoFile(selectedImage) ? (
                                    <video
                                        src={selectedImage}
                                        controls
                                        className="max-w-full h-auto rounded-lg"
                                        style={{ maxHeight: '70vh' }}
                                        preload="metadata"
                                        onError={(e) => {
                                            console.error('Error cargando video:', e);
                                            // Mostrar mensaje de error si no se puede cargar
                                        }}
                                    >
                                        Tu navegador no soporta la reproducción de video.
                                    </video>
                                ) : isImageFile(selectedImage) ? (
                                    <img
                                        src={selectedImage}
                                        alt="Vista previa"
                                        className="max-w-full h-auto rounded-lg"
                                        onError={(e) => {
                                            console.error('Error cargando imagen:', e);
                                        }}
                                    />
                                ) : (
                                    <div className="text-center text-gray-600 p-8">
                                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p>Tipo de archivo no soportado para vista previa</p>
                                        <p className="text-sm mt-2">Haz clic en "Abrir en nueva pestaña" para descargar</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Logs table */}
                {!loading && !error && (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center space-x-4">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    Logs de Actividad ({filteredLogs.length})
                                </h2>
                                {/* Filtro por tipo de log al lado del título */}
                                <div>
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    >
                                        <option value="all">Todos los tipos</option>
                                        {logTypes.map((type) => (
                                            <option key={type} value={type}>
                                                {type}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {filteredLogs.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                No hay logs disponibles con los filtros seleccionados
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    ID
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Tipo
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Tiempo
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Mensaje
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Archivo
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Acciones
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {paginatedLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {log.id}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                            {log.name}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                        {parseUTCTimestamp(log.created_at)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600">
                                                        {log.message}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        {log.has_file ? (
                                                            <span className="text-green-600 flex items-center">
                                                                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                                                </svg>
                                                                Sí
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">No</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                        {log.has_file && log.file_url && (
                                                            <button
                                                                onClick={() => log.file_url && openMediaModal(log.file_url)}
                                                                className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full transition-colors"
                                                                title="Ver archivo"
                                                            >
                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Controles de paginación */}
                                {totalPages > 1 && (
                                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                                        <div className="text-sm text-gray-700">
                                            Mostrando {startIndex + 1} a {Math.min(endIndex, filteredLogs.length)} de {filteredLogs.length} logs
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => setCurrentPage(1)}
                                                disabled={currentPage === 1}
                                                className="p-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Primera página"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Anterior
                                            </button>
                                            <span className="text-sm text-gray-700">
                                                Página {currentPage} de {totalPages}
                                            </span>
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Siguiente
                                            </button>
                                            <button
                                                onClick={() => setCurrentPage(totalPages)}
                                                disabled={currentPage === totalPages}
                                                className="p-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Última página"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonitoringPage;

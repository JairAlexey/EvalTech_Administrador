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
}

const MonitoringPage = ({ eventId, participantId, onBack, onNavigate }: MonitoringPageProps) => {
    const [logs, setLogs] = useState<ParticipantLog[]>([]);
    const [eventName, setEventName] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [connectionStats, setConnectionStats] = useState<ConnectionStats | null>(null);
    const [filterType, setFilterType] = useState<string>('all');

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
            const stats = await monitoringService.getParticipantConnectionStats(participantId);
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

    // Tipos de logs únicos
    const logTypes = Array.from(new Set(logs.map(log => log.name)));

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar onNavigate={onNavigate} />

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
                            <div className={`p-4 rounded-lg ${connectionStats.is_active ? 'bg-green-50' : 'bg-red-50'}`}>
                                <p className="text-sm text-gray-600">Estado</p>
                                <p className={`text-2xl font-bold ${connectionStats.is_active ? 'text-green-600' : 'text-red-600'}`}>
                                    {connectionStats.is_active ? 'Activo' : 'Inactivo'}
                                </p>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Puerto</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {connectionStats.port || 'N/A'}
                                </p>
                            </div>
                            <div className="bg-yellow-50 p-4 rounded-lg">
                                <p className="text-sm text-gray-600">Última Actividad</p>
                                <p className="text-sm font-semibold text-yellow-700">
                                    {connectionStats.last_activity
                                        ? new Date(connectionStats.last_activity).toLocaleString('es-ES')
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
                                        {filteredLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {log.id}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                        {log.name}
                                                    </span>
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
                                                        (() => {
                                                            // Normalizar la URL del archivo hacia el backend (localhost:8000)
                                                            let fileUrl = log.file_url;

                                                            try {
                                                                // Si la URL es relativa (comienza con /), prefijar con API_URL
                                                                if (fileUrl.startsWith('/')) {
                                                                    fileUrl = `${API_URL}${fileUrl}`;
                                                                } else if (fileUrl.includes('localhost:5173')) {
                                                                    // Reemplazar el host del frontend por el del backend
                                                                    fileUrl = fileUrl.replace('localhost:5173', 'localhost:8000');
                                                                }
                                                            } catch (e) {
                                                                // En caso de cualquier problema, usar la URL original
                                                                console.error('Error normalizando file_url:', e);
                                                            }

                                                            return (
                                                                <a
                                                                    href={fileUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:text-blue-800 underline"
                                                                >
                                                                    Ver archivo
                                                                </a>
                                                            );
                                                        })()
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MonitoringPage;

import { useState, useEffect } from 'react';
import { ArrowLeft, Loader } from 'lucide-react';
import Sidebar from './Sidebar';
import candidateService, { type CandidateDetail } from '../services/candidateService';
import eventService, { type EventDetail } from '../services/eventService';

interface CandidateDetailsProps {
  onBack?: () => void;
  onNavigate?: (page: string) => void;
  candidateId?: string;
  onEdit?: (candidateId: string) => void;
}

export default function CandidateDetails({ onBack, onNavigate, candidateId, onEdit }: CandidateDetailsProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'información' | 'credenciales' | 'evaluaciones' | 'historial'>('información');

  // Estados para almacenar los datos del backend
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<any | null>(null);
  const [eventLoading, setEventLoading] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  // Obtener detalles del candidato del backend
  useEffect(() => {
    const fetchCandidateDetails = async () => {
      if (!candidateId) {
        setLoading(false);
        setError("No candidate ID provided");
        console.error("CandidateDetails component rendered without candidateId prop");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setEventError(null);

        // Ensure ID is properly formatted as a string
        const formattedId = String(candidateId);

        // Agregamos logs para depuración
        console.log("CandidateDetails - Getting details for candidate ID:", formattedId);

        try {
          // Añadimos un timeout para evitar bloqueos si la API no responde
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000)
          );

          const candidatePromise = candidateService.getCandidateDetails(formattedId);
          const candidateData = await Promise.race([candidatePromise, timeoutPromise]) as CandidateDetail;

          console.log("CandidateDetails - Candidate data received:", candidateData);

          if (!candidateData) {
            setError('No se pudieron obtener los datos del candidato');
            setLoading(false);
            return;
          }

          setCandidate(candidateData);

          // Si el candidato tiene un evento asignado, obtener detalles del evento
          if (candidateData.eventId) {
            setEventLoading(true);
            try {
              console.log("CandidateDetails - Getting event details for ID:", candidateData.eventId);
              const eventResponse = await eventService.getEventDetails(String(candidateData.eventId));
              console.log("CandidateDetails - Event data received:", eventResponse);

              // Verificar el tipo de respuesta y extraer los datos del evento correctamente
              if (eventResponse && typeof eventResponse === 'object') {
                // Verificar si es una EventDetailResponse (tiene propiedad 'event')
                if ('event' in eventResponse && eventResponse.event) {
                  setEventDetails(eventResponse.event);
                } else {
                  // Si es un EventDetail directo, usarlo como está
                  setEventDetails(eventResponse as EventDetail);
                }
              } else {
                console.error("CandidateDetails - Event data has unexpected structure:", eventResponse);
                setEventError('Formato de respuesta de evento inesperado');
              }
            } catch (err) {
              console.error('CandidateDetails - Error loading event details:', err);
              setEventError('Error al cargar detalles del evento');
            } finally {
              setEventLoading(false);
            }
          }
        } catch (networkError) {
          console.error('CandidateDetails - Network or format error:', networkError);
          setError('Error de conexión o formato de respuesta incorrecto. Por favor, verifique que el backend esté ejecutándose correctamente.');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar los datos del candidato';
        console.error('CandidateDetails - Error loading candidate data:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchCandidateDetails();
  }, [candidateId]);

  // Obtener las iniciales del nombre
  const getInitials = (name: string | undefined): string => {
    if (!name) return '??';

    try {
      return name
        .split(' ')
        .filter(part => part.length > 0)
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .substring(0, 2) || '??';
    } catch (e) {
      console.error('Error al obtener iniciales:', e);
      return '??';
    }
  };

  // Función para generar un color basado en el ID del candidato
  const getColor = (id: string | number): string => {
    const colors = [
      'bg-blue-100', 'bg-green-100', 'bg-yellow-100',
      'bg-purple-100', 'bg-pink-100', 'bg-indigo-100'
    ];

    // Check if id is a string, if not convert it to string
    const idStr = typeof id === 'string' ? id : String(id);

    // Now safely use split on the string
    const hash = idStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Renderizar pestañas
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-6 h-6 text-blue-600 animate-spin mr-3" />
          <span className="text-gray-600">Cargando información...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p>{error}</p>
        </div>
      );
    }

    if (!candidate) {
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
          <p>No se encontró información del candidato</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'información':
        return (
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Información Personal</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500">Nombre completo</p>
                    <p className="font-medium">{`${candidate.nombre} ${candidate.apellidos}`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Correo electrónico</p>
                    <p className="font-medium">{candidate.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fecha de registro</p>
                    <p className="font-medium">
                      {candidate.createdAt ?
                        new Date(candidate.createdAt).toLocaleDateString() :
                        'No disponible'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Última actualización</p>
                    <p className="font-medium">
                      {candidate.updatedAt ?
                        new Date(candidate.updatedAt).toLocaleDateString() :
                        'No disponible'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Notas</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <p className="text-sm text-gray-700">{candidate.notes || 'No hay notas disponibles'}</p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Información Profesional</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500">Puesto</p>
                    <p className="font-medium">{candidate.position}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Años de experiencia</p>
                    <p className="font-medium">{candidate.experienceYears || 'No especificado'}</p>
                  </div>
                  {candidate.skills && candidate.skills.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500">Habilidades</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {candidate.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 text-xs font-medium rounded-md bg-gray-100 text-gray-800"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Evento Asignado</h3>
                <div className="space-y-4">
                  {renderEventDetails()}
                </div>
              </div>
            </div>
          </div>
        );
      case 'credenciales':
        if (loading) return <div className="flex items-center justify-center py-12"><Loader className="w-6 h-6 text-blue-600 animate-spin mr-3" /><span>Cargando...</span></div>;
        if (!candidate) return <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700"><p>No se encontró información del candidato</p></div>;

        return (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-4">Credenciales</h3>
            <p className="text-gray-600">Información de credenciales y accesos del candidato.</p>
            <div className="mt-4 space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-medium mb-2">Credenciales para acceso al sistema</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Usuario</p>
                    <p className="font-medium">{candidate.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Envío de credenciales</p>
                    <p className="font-medium">{candidate.sendCredentials ? 'Activado' : 'Desactivado'}</p>
                    <button className="text-xs text-blue-600 mt-1 hover:underline">
                      {candidate.sendCredentials ? 'Desactivar envío' : 'Activar envío'}
                    </button>
                  </div>
                </div>
              </div>

              {candidate.eventId && (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <h4 className="font-medium mb-2">Recordatorios para el evento</h4>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-700">Envío de recordatorios</p>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${candidate.sendReminder ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {candidate.sendReminder ? 'Activado' : 'Desactivado'}
                      </span>
                    </div>
                    <button className="text-xs text-blue-600 mt-2 hover:underline">
                      {candidate.sendReminder ? 'Desactivar recordatorios' : 'Activar recordatorios'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'evaluaciones':
        if (loading) return <div className="flex items-center justify-center py-12"><Loader className="w-6 h-6 text-blue-600 animate-spin mr-3" /><span>Cargando...</span></div>;
        if (!candidate) return <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700"><p>No se encontró información del candidato</p></div>;

        return (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Evaluaciones</h3>

              {candidate.eventId ? (
                <div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                    Evento asignado
                  </span>
                </div>
              ) : (
                <div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                    Sin evento asignado
                  </span>
                </div>
              )}
            </div>

            {candidate.eventId ? (
              <div className="space-y-4">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex flex-col">
                    <div className="mb-4">
                      <h4 className="font-medium">Estado de la evaluación</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {candidate.event}
                      </p>
                    </div>

                    <div className="flex items-center mt-2">
                      <div className={`w-3 h-3 rounded-full mr-2 ${candidate.status === 'Activo' ? 'bg-green-500' :
                        candidate.status === 'Pendiente' ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`}></div>
                      <span className="text-sm">
                        {candidate.status === 'Activo' ? 'Candidato activo' :
                          candidate.status === 'Pendiente' ? 'Pendiente de confirmación' :
                            candidate.status === 'Inactivo' ? 'Candidato inactivo' :
                              'Candidato cancelado'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 border border-dashed border-gray-300 rounded-lg text-center">
                  <p className="text-gray-500 mb-2">No hay datos de progreso disponibles</p>
                  <p className="text-sm text-gray-400">Los datos de evaluación se mostrarán cuando el candidato comience su evaluación</p>
                </div>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-gray-300 rounded-lg text-center">
                <p className="text-gray-500 mb-2">Este candidato no está asignado a ningún evento</p>
                <p className="text-sm text-gray-400">Para ver evaluaciones, primero asigne este candidato a un evento</p>
                {onEdit && candidateId && (
                  <button
                    onClick={() => onEdit(candidateId)}
                    className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition"
                  >
                    Editar candidato
                  </button>
                )}
              </div>
            )}
          </div>
        );

      case 'historial':
        if (loading) return <div className="flex items-center justify-center py-12"><Loader className="w-6 h-6 text-blue-600 animate-spin mr-3" /><span>Cargando...</span></div>;
        if (!candidate) return <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700"><p>No se encontró información del candidato</p></div>;

        // Formatear fecha para mostrar en formato legible
        const formatDate = (dateString: string | undefined | null) => {
          if (!dateString) return 'No disponible';

          try {
            const date = new Date(dateString);

            // Verificar si la fecha es válida
            if (isNaN(date.getTime())) {
              return 'Fecha inválida';
            }

            return date.toLocaleString();
          } catch (e) {
            console.error('Error al formatear fecha:', e);
            return 'Formato de fecha incorrecto';
          }
        };

        return (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-4">Historial de actividades</h3>

            <div className="space-y-6">
              {/* Última actualización */}
              {candidate.updatedAt !== candidate.createdAt && (
                <div className="relative pl-6 pb-6 border-l border-gray-200">
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-1.5 bg-blue-500"></div>
                  <div className="mb-1">
                    <span className="text-xs font-medium text-blue-500">{formatDate(candidate.updatedAt)}</span>
                  </div>
                  <p className="text-sm">Actualización del candidato</p>
                </div>
              )}

              {/* Asignación a evento */}
              {candidate.eventId && (
                <div className="relative pl-6 pb-6 border-l border-gray-200">
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-1.5 bg-green-500"></div>
                  <div className="mb-1">
                    <span className="text-xs font-medium text-green-500">{formatDate(candidate.createdAt)}</span>
                  </div>
                  <p className="text-sm">Asignado al evento: {candidate.event}</p>
                </div>
              )}

              {/* Registro inicial */}
              <div className="relative pl-6">
                <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-1.5 bg-gray-400"></div>
                <div className="mb-1">
                  <span className="text-xs font-medium text-gray-500">{formatDate(candidate.createdAt)}</span>
                </div>
                <p className="text-sm">Registrado en el sistema</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderEventDetails = () => {
    if (!candidate || !candidate.eventId) {
      return <p className="text-sm text-gray-500">No hay evento asignado</p>;
    }

    if (eventLoading) {
      return (
        <div className="flex items-center py-2">
          <Loader className="w-4 h-4 text-blue-600 animate-spin mr-2" />
          <span className="text-sm text-gray-600">Cargando datos del evento...</span>
        </div>
      );
    }

    if (eventError) {
      return (
        <div className="p-3 bg-red-50 rounded-md">
          <p className="text-sm text-red-600">{eventError}</p>
          <button
            className="text-blue-600 hover:underline text-xs mt-1"
            onClick={() => window.location.reload()}
          >
            Reintentar carga
          </button>
        </div>
      );
    }

    if (eventDetails) {
      return (
        <>
          <div>
            <p className="text-xs text-gray-500">Código de evento</p>
            <p className="font-medium">{eventDetails.code}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Nombre del evento</p>
            <p className="font-medium">{eventDetails.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fecha del evento</p>
            <p className="font-medium">{eventDetails.date}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Estado del evento</p>
            <div className="inline-block">
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                {eventDetails.status}
              </span>
            </div>
          </div>
        </>
      );
    }

    // Fallback si no hay detalles pero sí hay un nombre de evento
    return <p className="text-sm text-gray-500">{candidate.event || 'Evento sin detalles disponibles'}</p>;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="candidatos" onNavigate={onNavigate} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Volver a candidatos</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Detalles del Candidato</h1>
              <p className="text-gray-600 mt-1">Visualización detallada de candidatos registrados</p>
            </div>
            <div className="flex items-center gap-3">
              {!loading && candidate && (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${candidate.status === 'Activo' ? 'bg-green-100 text-green-800' :
                  candidate.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                    candidate.status === 'Inactivo' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                  }`}>
                  {candidate.status}
                </span>
              )}
              <button
                onClick={() => onEdit && candidateId && onEdit(candidateId)}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
              >
                Editar
              </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="mb-8 flex items-center justify-center py-6">
              <Loader className="w-6 h-6 text-blue-600 animate-spin mr-3" />
              <span className="text-gray-600">Cargando información del candidato...</span>
            </div>
          ) : error ? (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <p>Error: {error}</p>
              <button
                className="text-blue-600 hover:underline mt-2 text-sm"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </button>
            </div>
          ) : candidate ? (
            <div className="mb-8 flex items-center space-x-6">
              <div className={`w-16 h-16 ${getColor(candidate.id || '0')} rounded-full flex items-center justify-center text-gray-700 text-2xl font-medium`}>
                {getInitials(`${candidate.nombre} ${candidate.apellidos}`)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{`${candidate.nombre} ${candidate.apellidos}`}</h2>
                <p className="text-gray-600">{candidate.position}</p>
              </div>
              <div className="ml-auto flex items-center space-x-4">
                {/* No tenemos progreso real en el backend, pero mantenemos la interfaz */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">Estado actual</p>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${candidate.status === 'Activo' ? 'bg-green-100 text-green-800' :
                    candidate.status === 'Pendiente' ? 'bg-yellow-100 text-yellow-800' :
                      candidate.status === 'Inactivo' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                    }`}>
                    {candidate.status}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
              <p>No se encontró información del candidato</p>
            </div>
          )}

          {/* Pestañas de navegación */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('información')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${activeTab === 'información'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Información
              </button>
              <button
                onClick={() => setActiveTab('credenciales')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${activeTab === 'credenciales'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Credenciales
              </button>
              <button
                onClick={() => setActiveTab('evaluaciones')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${activeTab === 'evaluaciones'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Evaluaciones
              </button>
              <button
                onClick={() => setActiveTab('historial')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${activeTab === 'historial'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Historial
              </button>
            </nav>
          </div>

          {/* Contenido de la pestaña activa */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <p>{error}</p>
                <button
                  className="text-blue-600 hover:underline mt-2 text-sm"
                  onClick={() => window.location.reload()}
                >
                  Reintentar
                </button>
              </div>
            ) : renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
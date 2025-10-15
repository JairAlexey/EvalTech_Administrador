import { useState, useEffect } from 'react';
import { ArrowLeft, Loader } from 'lucide-react';
import Sidebar from './Sidebar';
import { candidateService } from '../services/candidateService';
import { eventService, Event } from '../services/eventService';

interface CreateCandidateProps {
  onBack?: () => void;
  onCreate?: (candidateData: any) => void;
  onNavigate?: (page: string) => void;
}

export default function CreateCandidate({ onBack, onCreate, onNavigate }: CreateCandidateProps) {
  // Estados para los campos del formulario
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [puesto, setPuesto] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [habilidades, setHabilidades] = useState('');
  const [evento, setEvento] = useState('');
  const [notas, setNotas] = useState('');
  const [enviarCredenciales, setEnviarCredenciales] = useState(true);
  const [enviarRecordatorio, setEnviarRecordatorio] = useState(true);

  // Estados para la lista de eventos
  const [eventos, setEventos] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Cargar eventos al iniciar
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedEvents = await eventService.getEvents();
        setEventos(fetchedEvents);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar eventos');
        console.error('Error al cargar eventos:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Manejar el envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      // Preparar datos del candidato en el formato esperado por el backend
      const candidateData: any = {
        nombre: nombre,
        apellidos: apellidos,
        correo: correo,
        puesto: puesto,
        experiencia: experiencia ? parseInt(experiencia) : 0,
        habilidades: habilidades.split(',').filter(h => h.trim() !== ''),
        notas: notas,
        configuracion: {
          enviarCredenciales: enviarCredenciales,
          enviarRecordatorio: enviarRecordatorio
        }
      };

      // Solo incluir el evento si se ha seleccionado uno
      if (evento) {
        candidateData.evento = evento;
      }

      // Enviar datos al backend
      const result = await candidateService.createCandidate(candidateData);

      // Notificar éxito
      onCreate && onCreate(result);
      onBack && onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el candidato');
      console.error('Error al crear candidato:', err);
    } finally {
      setSubmitting(false);
    }
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
              <h1 className="text-2xl font-bold text-gray-900">Crear Candidato</h1>
              <p className="text-gray-600 mt-1">Registra un nuevo candidato en el sistema</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Columna 1: Información Personal */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Personal</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="apellidos" className="block text-sm font-medium text-gray-700 mb-1">
                      Apellidos <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="apellidos"
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="correo" className="block text-sm font-medium text-gray-700 mb-1">
                      Correo Electrónico <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="correo"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Se enviarán las credenciales a este correo</p>
                  </div>
                </div>
              </div>

              {/* Columna 2: Información Profesional */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Profesional</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="puesto" className="block text-sm font-medium text-gray-700 mb-1">
                      Puesto al que aplica <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="puesto"
                      value={puesto}
                      onChange={(e) => setPuesto(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="experiencia" className="block text-sm font-medium text-gray-700 mb-1">
                      Años de experiencia
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="experiencia"
                        value={experiencia}
                        onChange={(e) => setExperiencia(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        min="0"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="habilidades" className="block text-sm font-medium text-gray-700 mb-1">
                      Habilidades principales
                    </label>
                    <input
                      type="text"
                      id="habilidades"
                      value={habilidades}
                      onChange={(e) => setHabilidades(e.target.value)}
                      placeholder="Ej: JavaScript, React, Node.js"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Separadas por comas</p>
                  </div>
                </div>
              </div>

              {/* Columna 3: Asignación de Evento */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Asignación de Evento</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="evento" className="block text-sm font-medium text-gray-700 mb-1">
                      Evento
                    </label>
                    <div className="relative">
                      {loading ? (
                        <div className="flex items-center justify-center p-2 border border-gray-300 rounded-md">
                          <Loader className="h-4 w-4 text-gray-400 animate-spin" />
                          <span className="ml-2 text-sm text-gray-500">Cargando eventos...</span>
                        </div>
                      ) : error ? (
                        <div className="p-2 border border-red-300 bg-red-50 rounded-md">
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      ) : (
                        <select
                          id="evento"
                          value={evento}
                          onChange={(e) => setEvento(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none"
                          disabled={loading || submitting}
                        >
                          <option value="">Seleccionar evento (opcional)</option>
                          {eventos.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.code}: {event.name} ({event.date})
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">
                      Notas adicionales
                    </label>
                    <textarea
                      id="notas"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Añadir notas sobre el candidato..."
                    ></textarea>
                  </div>

                  <div className="pt-3">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Configuración de Acceso</h3>

                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mb-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3 text-xs text-blue-700">
                          <p>El sistema generará automáticamente las credenciales de acceso y las enviará al correo proporcionado.</p>
                          <p className="mt-1">El candidato puede ser creado sin asignar a un evento, y asignado posteriormente.</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enviarCredenciales}
                          onChange={(e) => setEnviarCredenciales(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Enviar credenciales por correo</span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enviarRecordatorio}
                          onChange={(e) => setEnviarRecordatorio(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Enviar recordatorio 24h antes</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error al crear el candidato</h3>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6 space-x-3">
              <button
                type="button"
                onClick={onBack}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
              >
                {submitting ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin mr-2" />
                    Creando...
                  </>
                ) : (
                  "Crear Candidato"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
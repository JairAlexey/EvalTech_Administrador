import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Info } from 'lucide-react';
import Sidebar from './Sidebar';
import eventService, { EventFormData } from '../services/eventService';
import candidateService from '../services/candidateService';

interface Candidate {
  id: string;
  name: string;
  role?: string;
  position?: string;
  email: string;
  initials: string;
  color: string;
  selected: boolean;
}

interface CreateEventProps {
  onBack?: () => void;
  onNavigate?: (page: string) => void;
  onEventCreated?: (eventId: string) => void;
}

export default function CreateEvent({ onBack, onNavigate, onEventCreated }: CreateEventProps) {
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [evaluationType, setEvaluationType] = useState('');
  const [evaluator, setEvaluator] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenEnabled, setScreenEnabled] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);

  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Cargar los candidatos al montar el componente
  useEffect(() => {
    const fetchCandidates = async () => {
      setIsLoadingCandidates(true);
      try {
        const candidatesData = await candidateService.getCandidates();
        // Transformar los datos al formato que necesitamos
        const formattedCandidates: Candidate[] = candidatesData.map(candidate => ({
          id: candidate.id,
          name: candidate.name,
          position: candidate.position,
          email: candidate.email,
          initials: candidate.initials,
          color: candidate.color,
          selected: false
        }));
        setCandidates(formattedCandidates);
      } catch (error) {
        console.error('Error al cargar los candidatos:', error);
      } finally {
        setIsLoadingCandidates(false);
      }
    };

    fetchCandidates();
  }, []);

  // Filtrar candidatos según el término de búsqueda
  const filteredCandidates = candidates.filter(candidate =>
    candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (candidate.position && candidate.position.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedCount = candidates.filter(c => c.selected).length;

  const toggleCandidate = (id: string) => {
    setCandidates(candidates.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ));
  };

  const clearSelection = () => {
    setCandidates(candidates.map(c => ({ ...c, selected: false })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Validar campos obligatorios
      if (!eventName || !startDate || !startTime || !duration || !evaluationType || !evaluator) {
        throw new Error('Por favor complete todos los campos obligatorios');
      }

      // Validar que al menos un candidato esté seleccionado
      if (selectedCount === 0) {
        throw new Error('Debe seleccionar al menos un candidato para el evento');
      }

      // Preparar los datos del formulario
      const eventData: EventFormData = {
        eventName,
        description,
        startDate,
        startTime,
        duration,
        evaluationType,
        evaluator,
        cameraEnabled,
        micEnabled,
        screenEnabled,
        candidates: candidates.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          role: c.role || c.position,
          selected: c.selected
        }))
      };

      // Enviar los datos al servidor
      const result = await eventService.createEvent(eventData);

      // Si todo sale bien, notificar y redirigir
      if (onEventCreated) {
        onEventCreated(result.id); // Cambiado de result.eventId a result.id
      } else if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error('Error al crear el evento:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Error al crear el evento');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="eventos" onNavigate={onNavigate} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Volver</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Crear Evento de Evaluación</h1>
              <p className="text-gray-600 mt-1">Configure los detalles del nuevo evento de evaluación técnica</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Información del Evento</h2>

              <div className="space-y-5">
                <div>
                  <label htmlFor="eventName" className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre del evento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="eventName"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="Ej: Evaluación Técnica - Desarrolladores Frontend"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Descripción
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Breve descripción del evento de evaluación"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                      Fecha de inicio <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                      Hora de inicio <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      id="startTime"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="--:--"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                      Duración (minutos) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="evaluationType" className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de evaluación <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="evaluationType"
                      value={evaluationType}
                      onChange={(e) => setEvaluationType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="tecnica">Evaluación Técnica</option>
                      <option value="practica">Evaluación Práctica</option>
                      <option value="teorica">Evaluación Teórica</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="evaluator" className="block text-sm font-medium text-gray-700 mb-2">
                    Evaluador asignado <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="evaluator"
                    value={evaluator}
                    onChange={(e) => setEvaluator(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
                  >
                    <option value="">Seleccionar evaluador...</option>
                    <option value="evaluador1">Carlos Martínez</option>
                    <option value="evaluador2">Ana Silva</option>
                    <option value="evaluador3">Roberto Gómez</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Configuración de monitoreo
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={cameraEnabled}
                        onChange={(e) => setCameraEnabled(e.target.checked)}
                        className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Habilitar monitoreo de cámara</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={micEnabled}
                        onChange={(e) => setMicEnabled(e.target.checked)}
                        className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Habilitar monitoreo de micrófono</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={screenEnabled}
                        onChange={(e) => setScreenEnabled(e.target.checked)}
                        className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Habilitar monitoreo de pantalla</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Asignación de Candidatos</h2>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar candidato..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">Candidatos disponibles</p>
                <span className="text-sm font-medium text-blue-600">{filteredCandidates.length} disponibles</span>
              </div>

              {isLoadingCandidates ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Cargando candidatos...</p>
                </div>
              ) : filteredCandidates.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">No se encontraron candidatos{searchTerm ? ` para "${searchTerm}"` : ''}</p>
                </div>
              ) : (
                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {filteredCandidates.map((candidate) => (
                    <div
                      key={candidate.id}
                      onClick={() => toggleCandidate(candidate.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${candidate.selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-full ${candidate.color} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                        {candidate.initials}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{candidate.name}</p>
                        <p className="text-xs text-gray-600">{candidate.position || candidate.role || 'Sin puesto'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`${selectedCount === 0 ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"} border rounded-lg p-4 mb-4`}>
                <div className="flex gap-3">
                  <Info className={`w-5 h-5 ${selectedCount === 0 ? "text-red-600" : "text-blue-600"} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Información</p>
                    {selectedCount === 0 ? (
                      <p className="text-xs text-gray-700">
                        <strong>Importante:</strong> Debe seleccionar al menos un candidato para crear el evento.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-700">Los candidatos seleccionados recibirán una notificación por correo electrónico con los detalles del evento y las instrucciones para acceder a la evaluación.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div>
                  <span className="text-sm text-gray-600">Candidatos seleccionados: </span>
                  <span className="text-lg font-bold text-gray-900">{selectedCount}</span>
                </div>
                {selectedCount > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>
            </div>

            <div className="col-span-2 flex justify-end gap-3">
              {errorMessage && (
                <div className="flex-1 text-red-600 text-sm mt-1">
                  {errorMessage}
                </div>
              )}
              <button
                type="button"
                onClick={onBack}
                disabled={isSubmitting}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedCount === 0}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Creando...' : 'Crear Evento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
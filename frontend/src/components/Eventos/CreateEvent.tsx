import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Info } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import eventService, { type EventFormData } from '../../services/eventService';
import participantService from '../../services/participantService';
import evaluatorService from '../../services/evaluatorService';
import BlockedPagesModal from './BlockedPagesModal';

interface Participant {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  selected: boolean;
}

interface CreateEventProps {
  onBack?: () => void;
  onNavigate?: (page: string) => void;
  onEventCreated?: (eventId: string) => void;
  onLogout?: () => void;
}

export default function CreateEvent({ onBack, onNavigate, onEventCreated, onLogout }: CreateEventProps) {
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [duration, setDuration] = useState('');
  const [evaluator, setEvaluator] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [isLoadingEvaluators, setIsLoadingEvaluators] = useState(true);
  const [showBlockedPagesModal, setShowBlockedPagesModal] = useState(false);
  const [selectedBlockedWebsites, setSelectedBlockedWebsites] = useState<string[]>([]);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [evaluators, setEvaluators] = useState<{ id: string; name: string }[]>([]);

  // Cargar los participantes al montar el componente
  useEffect(() => {
    const fetchParticipants = async () => {
      setIsLoadingParticipants(true);
      try {
        const participantsData = await participantService.getParticipants();
        // Transformar los datos al formato que necesitamos
        const formattedParticipants: Participant[] = participantsData.map(participant => ({
          id: participant.id,
          name: participant.name,
          email: participant.email,
          initials: participant.initials,
          color: participant.color,
          selected: false
        }));
        setParticipants(formattedParticipants);
      } catch (error) {
        console.error('Error al cargar los participantes:', error);
      } finally {
        setIsLoadingParticipants(false);
      }
    };

    fetchParticipants();
  }, []);

  // Cargar los evaluadores al montar el componente
  useEffect(() => {
    const fetchEvaluators = async () => {
      setIsLoadingEvaluators(true);
      try {
        const evaluatorsData = await evaluatorService.getEvaluators();
        setEvaluators(evaluatorsData);
      } catch (error) {
        console.error('Error al cargar los evaluadores:', error);
      } finally {
        setIsLoadingEvaluators(false);
      }
    };

    fetchEvaluators();
  }, []);

  // Filtrar participantes según el término de búsqueda
  const filteredParticipants = participants.filter(participant =>
    participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    participant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = participants.filter(c => c.selected).length;

  const toggleParticipant = (id: string) => {
    setParticipants(participants.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ));
  };

  const clearSelection = () => {
    setParticipants(participants.map(c => ({ ...c, selected: false })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // Obtener timezone del navegador
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Guayaquil';

      // Preparar los datos del formulario
      const eventData: EventFormData = {
        eventName,
        description,
        startDate,
        evaluator,
        participants: participants.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          selected: c.selected,
          initials: c.initials,
          color: c.color
        })),
        timezone,
        startTime,
        closeTime,
        duration: parseInt(duration),
        blockedWebsites: selectedBlockedWebsites,
      };

      // Enviar los datos al servidor
      const result = await eventService.createEvent(eventData);

      // Si todo sale bien, notificar y redirigir
      if (onEventCreated) {
        onEventCreated(result.id);
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

  const handleBlockedWebsitesChange = (selectedIds: string[]) => {
    setSelectedBlockedWebsites(selectedIds);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="eventos" onNavigate={onNavigate} onLogout={onLogout} />

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
                    Descripción <span className="text-red-500">*</span>
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
                      min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}
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
                    <label htmlFor="closeTime" className="block text-sm font-medium text-gray-700 mb-2">
                      Hora cierre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      id="closeTime"
                      value={closeTime}
                      onChange={(e) => setCloseTime(e.target.value)}
                      placeholder="--:--"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                      Duración (minutos) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="Ej: 60"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 15 min, máximo 5 horas</p>
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
                    {isLoadingEvaluators ? (
                      <option disabled>Cargando evaluadores...</option>
                    ) : (
                      evaluators.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))
                    )}
                  </select>
                </div>

                {/* Botón para páginas bloqueadas */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700">Páginas bloqueadas</label>
                    <span className="text-xs text-gray-500">{selectedBlockedWebsites.length} seleccionado(s)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBlockedPagesModal(true)}
                    className="w-full px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition font-medium"
                  >
                    Configurar sitios bloqueados
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Asignación de Participantes</h2>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar participante..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>

              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">Participantes disponibles</p>
                <span className="text-sm font-medium text-blue-600">{filteredParticipants.length} disponibles</span>
              </div>

              {isLoadingParticipants ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Cargando participantes...</p>
                </div>
              ) : filteredParticipants.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">No se encontraron participantes{searchTerm ? ` para "${searchTerm}"` : ''}</p>
                </div>
              ) : (
                <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {filteredParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      onClick={() => toggleParticipant(participant.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${participant.selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-full ${participant.color} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                        {participant.initials}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{participant.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`bg-blue-50 border-blue-200 border rounded-lg p-4 mb-4 mt-4`}>
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Información</p>
                    <p className="text-xs text-gray-700">
                      Puede crear el evento sin participantes y asignarlos más tarde.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div>
                  <span className="text-sm text-gray-600">Participantes seleccionados: </span>
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
                <div className="flex-1 text-red-600 text-sm">
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
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Creando...' : 'Crear Evento'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de páginas bloqueadas */}
      <BlockedPagesModal
        isOpen={showBlockedPagesModal}
        onClose={() => setShowBlockedPagesModal(false)}
        selectedWebsites={selectedBlockedWebsites}
        onSave={handleBlockedWebsitesChange}
      />
    </div>
  );
}
import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Info, Loader } from 'lucide-react';
import Sidebar from '../utils/Sidebar';
import eventService, { type EventDetail, type Participant, type EventFormData } from '../../services/eventService';
import participantService from '../../services/participantService';
import evaluatorService from '../../services/evaluatorService';
import BlockedPagesModal from './BlockedPagesModal';
import blockedPagesService from '../../services/blockedPagesService';
import { useAuth } from '../../contexts/AuthContext';

interface EditEventProps {
  onBack?: () => void;
  eventId?: string;
  onNavigate?: (page: string) => void;
}

export default function EditEvent({ onBack, eventId, onNavigate }: EditEventProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [eventStatus, setEventStatus] = useState<string>('programado');

  // Estados para los campos del formulario
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [duration, setDuration] = useState('');
  const [evaluator, setEvaluator] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para participantes
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);

  // Evaluadores y páginas bloqueadas
  const [isLoadingEvaluators, setIsLoadingEvaluators] = useState(true);
  const [evaluators, setEvaluators] = useState<{ id: string; name: string }[]>([]);
  const [showBlockedPagesModal, setShowBlockedPagesModal] = useState(false);
  const [selectedBlockedWebsites, setSelectedBlockedWebsites] = useState<string[]>([]);

  const { user } = useAuth();
  const isEvaluatorUser = user?.role === 'evaluator';

  // Utilidad para convertir UTC a local
  function formatUTCToLocalInput(dateStr?: string, timeStr?: string) {
    if (!dateStr || !timeStr) return { localDate: '', localTime: '' };
    const utcDate = new Date(`${dateStr}T${timeStr}:00Z`);
    const localDate = `${utcDate.getFullYear()}-${(utcDate.getMonth() + 1).toString().padStart(2, '0')}-${utcDate.getDate().toString().padStart(2, '0')}`;
    const localTime = `${utcDate.getHours().toString().padStart(2, '0')}:${utcDate.getMinutes().toString().padStart(2, '0')}`;
    return { localDate, localTime };
  }

  // Cargar datos del evento
  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Cargar datos del evento
        const eventResponse = await eventService.getEventDetails(eventId);
        let eventData: EventDetail;
        if (typeof eventResponse === 'object' && eventResponse !== null) {
          if ('event' in eventResponse) {
            eventData = eventResponse.event as EventDetail;
          } else {
            eventData = eventResponse as EventDetail;
          }
        } else {
          throw new Error('Formato de respuesta inesperado');
        }

        setEvent(eventData);
        setEventName(eventData.name);
        setDescription(eventData.description || '');

        // Guardar el estado del evento
        setEventStatus(eventData.status?.toLowerCase() || 'programado');

        // Formatear fechas
        let localDate = '';
        let localTime = '';
        let localCloseTime = '';
        if (eventData.startDate && eventData.startTime) {
          const formatted = formatUTCToLocalInput(eventData.startDate, eventData.startTime);
          localDate = formatted.localDate;
          localTime = formatted.localTime;
        }

        // Transformar hora de cierre a local si existe
        if (eventData.startDate && eventData.closeTime) {
          const formattedClose = formatUTCToLocalInput(eventData.startDate, eventData.closeTime);
          localCloseTime = formattedClose.localTime;
        } else {
          localCloseTime = eventData.closeTime || '';
        }

        setEventDate(localDate);
        setEventTime(localTime);
        setCloseTime(localCloseTime);
        setDuration(String(eventData.duration || ''));
        setEvaluator(eventData.evaluatorId || '');

        // Cargar evaluadores
        setIsLoadingEvaluators(true);
        const evs = await evaluatorService.getEvaluators();
        setEvaluators(evs);
        setIsLoadingEvaluators(false);

        // Cargar sitios bloqueados
        const blocked = await blockedPagesService.getEventBlockedHosts(eventId);
        setSelectedBlockedWebsites(blocked);

        // Cargar TODOS los participantes disponibles
        setIsLoadingParticipants(true);
        const allParticipants = await participantService.getParticipants();

        // Mapear participantes: marcar como selected los que están en el evento
        const eventParticipantIds = new Set(
          (eventData.participants || []).map((p: any) => p.id)
        );

        const formattedParticipants: Participant[] = allParticipants.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          selected: eventParticipantIds.has(p.id),
          initials: p.initials,
          color: p.color
        }));

        setParticipants(formattedParticipants);
        setIsLoadingParticipants(false);

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar los datos del evento';
        console.error('Error al cargar datos del evento:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId]);

  // Filtrar participantes
  const filteredParticipants = participants.filter(
    p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedCount = participants.filter(p => p.selected).length;

  const toggleParticipant = (id: string) => {
    setParticipants(participants.map(p =>
      p.id === id ? { ...p, selected: !p.selected } : p
    ));
  };

  const clearSelection = () => {
    setParticipants(participants.map(p => ({ ...p, selected: false })));
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    // Si el evento está completado, no permitir el envío
    if (eventStatus === 'completado') {
      setError('No se puede editar un evento completado');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      let formattedDate = eventDate;
      if (eventDate && !eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const dateParts = eventDate.split(/[\/\-\.]/);
        if (dateParts.length === 3) {
          formattedDate = `${dateParts[2].padStart(4, '20')}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        }
      }

      let formattedTime = eventTime;
      if (eventTime && !eventTime.match(/^\d{2}:\d{2}$/)) {
        const timeParts = eventTime.replace(/[^0-9:]/g, '').split(':');
        if (timeParts.length >= 2) {
          formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
        }
      }

      let formattedCloseTime = closeTime;
      if (closeTime && !closeTime.match(/^\d{2}:\d{2}$/)) {
        const timeParts = closeTime.replace(/[^0-9:]/g, '').split(':');
        if (timeParts.length >= 2) {
          formattedCloseTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
        }
      }

      const eventData: EventFormData = {
        eventName: eventName.trim(),
        description: description.trim(),
        startDate: formattedDate,
        evaluator: evaluator.trim(),
        participants: participants.map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          selected: p.selected,
          initials: p.initials,
          color: p.color
        })),
        timezone: userTimezone,
        startTime: formattedTime,
        closeTime: formattedCloseTime,
        duration: parseInt(duration),
        blockedWebsites: selectedBlockedWebsites,
      };

      await eventService.updateEvent(eventId, eventData);
      
      // Notificar al proxy sobre la actualización de hosts bloqueados si hubo cambios
      try {
        await blockedPagesService.notifyProxyUpdate(eventId);
        console.log('✅ Proxy notificado sobre actualización de hosts bloqueados');
      } catch (proxyError) {
        console.warn('⚠️  Error notificando al proxy (no crítico):', proxyError);
        // No mostramos este error al usuario ya que el evento se guardó correctamente
      }
      
      onBack && onBack();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar los cambios del evento';
      setError(errorMessage);
      console.error('Error al actualizar evento:', err);
    } finally {
      setSaving(false);
    }
  };

  // Determinar si los campos deben estar deshabilitados
  const isInProgress = eventStatus === 'en_progreso';
  const isCompleted = eventStatus === 'completado';
  const isStartDateDisabled = isInProgress || isCompleted;
  const isStartTimeDisabled = isInProgress || isCompleted;
  const isFieldDisabled = isCompleted;

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
                <span className="text-sm">Volver a eventos</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Editar Evento de Evaluación</h1>
              <p className="text-gray-600 mt-1">Modifique los detalles del evento según sea necesario</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="w-8 h-8 text-blue-600 animate-spin mr-3" />
              <span className="text-gray-600 text-lg">Cargando información del evento...</span>
            </div>
          ) : !event ? (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-center">
              <p className="mb-2 font-medium">No se pudo encontrar información del evento</p>
              <p>El evento solicitado no existe o no tiene permiso para verlo.</p>
              <button
                onClick={onBack}
                className="mt-4 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-md hover:bg-yellow-200 transition"
              >
                Volver a la lista de eventos
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-8">
              {/* Columna izquierda: Información del evento */}
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
                      disabled={isFieldDisabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      disabled={isFieldDisabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-2">
                        Fecha de inicio <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        id="eventDate"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        disabled={isStartDateDisabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label htmlFor="eventTime" className="block text-sm font-medium text-gray-700 mb-2">
                        Hora de inicio <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        id="eventTime"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        disabled={isStartTimeDisabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={isFieldDisabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={isFieldDisabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                      disabled={isFieldDisabled || isEvaluatorUser}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
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

                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Páginas bloqueadas</label>
                      <span className="text-xs text-gray-500">{selectedBlockedWebsites.length} seleccionado(s)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBlockedPagesModal(true)}
                      disabled={isFieldDisabled}
                      className="w-full px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition font-medium disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed disabled:border-gray-200"
                    >
                      Configurar sitios bloqueados
                    </button>
                  </div>
                </div>
              </div>

              {/* Columna derecha: Participantes */}
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
                        onClick={() => !isFieldDisabled && toggleParticipant(participant.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition ${isFieldDisabled
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer'
                          } ${participant.selected
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

                <div className="bg-blue-50 border-blue-200 border rounded-lg p-4 mb-4 mt-4">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-1">Información</p>
                      <p className="text-xs text-gray-700">
                        Seleccione los participantes para este evento. Los cambios se guardarán al actualizar.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div>
                    <span className="text-sm text-gray-600">Participantes seleccionados: </span>
                    <span className="text-lg font-bold text-gray-900">{selectedCount}</span>
                  </div>
                  {selectedCount > 0 && !isFieldDisabled && (
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

              {/* Botones de acción */}
              <div className="col-span-2 flex justify-end gap-3">
                {error && (
                  <div className="flex-1 text-red-600 text-sm px-4 py-2">
                    {error}
                  </div>
                )}
                <button
                  type="button"
                  onClick={onBack}
                  disabled={saving}
                  className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || isCompleted}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {saving ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar cambios'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <BlockedPagesModal
        isOpen={showBlockedPagesModal}
        onClose={() => setShowBlockedPagesModal(false)}
        selectedWebsites={selectedBlockedWebsites}
        onSave={(ids) => setSelectedBlockedWebsites(ids)}
        eventId={eventId}
      />
    </div>
  );
}
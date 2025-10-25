import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Info, UserCheck, UserMinus, UserX, Loader } from 'lucide-react';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';
import eventService, { type EventDetail, type Participant, type EventFormData } from '../services/eventService';
import participantService from '../services/participantService';

interface EditEventProps {
  onBack?: () => void;
  eventId?: string;
  onNavigate?: (page: string) => void;
}

export default function EditEvent({ onBack, eventId, onNavigate }: EditEventProps) {
  // Estado para el modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Estado para manejar las pestañas
  const [activeTab, setActiveTab] = useState<'informacion' | 'participantes' | 'historial'>('informacion');

  // Estados para carga de datos y errores
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [availableParticipants, setAvailableParticipants] = useState<Participant[]>([]);

  // Estados para los campos del formulario
  const [eventName, setEventName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [duration, setDuration] = useState('');
  const [evaluationType, setEvaluationType] = useState('');
  const [evaluator, setEvaluator] = useState('');

  // Estados para las opciones de monitoreo
  const [notifyParticipants, setNotifyParticipants] = useState(true);

  // Estado para el mensaje personalizado
  const [customMessage, setCustomMessage] = useState('');

  // Estado para buscar participantes
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para participantes
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Utilidad para convertir UTC a local y formatear para input date/time
  function formatUTCToLocalInput(dateStr?: string, timeStr?: string) {
    if (!dateStr || !timeStr) return { localDate: '', localTime: '' };
    // Construir el objeto Date en UTC
    const utcDate = new Date(`${dateStr}T${timeStr}:00Z`);
    // Obtener fecha local en formato YYYY-MM-DD
    const localDate = `${utcDate.getFullYear()}-${(utcDate.getMonth() + 1).toString().padStart(2, '0')}-${utcDate.getDate().toString().padStart(2, '0')}`;
    // Obtener hora local en formato HH:MM
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

        console.log("Obteniendo detalles del evento con ID:", eventId);

        // Cargar datos del evento con timeout para evitar bloqueos
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Tiempo de espera agotado')), 10000)
          );

          const eventPromise = eventService.getEventDetails(eventId);
          const eventResponse = await Promise.race([eventPromise, timeoutPromise]);

          console.log("Respuesta completa del evento:", eventResponse);

          // Verificar si la respuesta tiene la estructura esperada
          if (!eventResponse) {
            throw new Error('No se recibieron datos del evento');
          }

          // Extraer los datos del evento de forma segura con tipos correctos
          let eventData: EventDetail;
          if (typeof eventResponse === 'object' && eventResponse !== null) {
            if ('event' in eventResponse && typeof eventResponse.event === 'object' && eventResponse.event !== null) {
              // La respuesta tiene la estructura {event: {...}}
              eventData = eventResponse.event as EventDetail;
              console.log("Datos del evento extraídos:", eventData);
            } else {
              // La respuesta ya es el objeto de evento directamente
              eventData = eventResponse as EventDetail;
              console.log("Usando datos de evento directamente");
            }
          } else {
            throw new Error('Formato de respuesta inesperado');
          }

          setEvent(eventData);

          // Ahora podemos acceder a las propiedades de manera segura
          setEventName(eventData.name);
          setDescription(eventData.description || '');

          // Formatear fecha y hora en base a la zona horaria local
          let localDate = '';
          let localTime = '';
          if (eventData.startDate && eventData.startTime) {
            const formatted = formatUTCToLocalInput(eventData.startDate, eventData.startTime);
            localDate = formatted.localDate;
            localTime = formatted.localTime;
          } else if (eventData.date && eventData.time) {
            const formatted = formatUTCToLocalInput(eventData.date, eventData.time);
            localDate = formatted.localDate;
            localTime = formatted.localTime;
          }

          setEventDate(localDate);
          setEventTime(localTime);

          setDuration(eventData.duration ? eventData.duration.toString() : '60');
          setEvaluationType(eventData.evaluationType || '');
          setEvaluator(eventData.evaluator || '');

          // Procesar participantes
          if (eventData.participants && eventData.participants.length > 0) {
            const mappedParticipants = eventData.participants.map((p: any) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              selected: true,
              initials: p.initials || p.name.split(' ').map((word: string) => word[0]).join('').toUpperCase().substring(0, 2),
              color: p.color || getRandomColor(p.id)
            }));

            setParticipants(mappedParticipants);
          } else {
            // Si no hay participantes, inicializar con array vacío
            setParticipants([]);
          }
        } catch (eventError) {
          console.error("Error al obtener detalles del evento:", eventError);
          throw eventError;
        }

        // Cargar participantes disponibles
        try {
          const participants = await participantService.getParticipants();

          // Filtrar participantes que no están ya asignados al evento
          const assignedIds = new Set(participants.map(p => p.id));
          const availableCands = participants
            .filter(c => !assignedIds.has(c.id))
            .map(c => ({
              id: c.id,
              name: c.name,
              email: c.email,
              selected: false,
              role: c.position,
              initials: c.initials,
              color: c.color
            }));

          setAvailableParticipants(availableCands);
        } catch (participantErr) {
          console.error('Error al cargar participantes disponibles:', participantErr);
          setAvailableParticipants([]);
          // No bloqueamos el flujo por errores en participantes disponibles
        }

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

  // Función para generar un color aleatorio basado en el ID
  const getRandomColor = (id: string): string => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500',
      'bg-pink-500', 'bg-yellow-500', 'bg-red-500',
      'bg-indigo-500', 'bg-teal-500'
    ];

    // Usar el ID para generar un índice para el color
    const idNumber = parseInt(id) || id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[idNumber % colors.length];
  };

  // Función para contar participantes seleccionados
  const selectedCount = participants.filter(p => p.selected).length;

  // Función para alternar la selección de un participante
  const toggleParticipant = (id: string) => {
    setParticipants(participants.map(p =>
      p.id === id ? { ...p, selected: !p.selected } : p
    ));
  };

  // Función para seleccionar/deseleccionar todos los participantes
  const toggleAllParticipants = (select: boolean) => {
    setParticipants(participants.map(p => ({ ...p, selected: select })));
  };

  // Manejar envío del formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;

    try {
      setSaving(true);
      setError(null);

      // Obtener el timezone del usuario
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Format date and time properly
      // Make sure date is in YYYY-MM-DD format
      let formattedDate = eventDate;
      if (eventDate && !eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Try to reformat it
        const dateParts = eventDate.split(/[\/\-\.]/);
        if (dateParts.length === 3) {
          // Assume day/month/year format if not already YYYY-MM-DD
          formattedDate = `${dateParts[2].padStart(4, '20')}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        }
      }

      // Make sure time is in HH:MM format
      let formattedTime = eventTime;
      if (eventTime && !eventTime.match(/^\d{2}:\d{2}$/)) {
        // Try to extract hours and minutes
        const timeParts = eventTime.replace(/[^0-9:]/g, '').split(':');
        if (timeParts.length >= 2) {
          formattedTime = `${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}`;
        }
      }

      // Validate duration is a number
      const durationValue = parseInt(duration);
      if (isNaN(durationValue) || durationValue <= 0) {
        setError('La duración debe ser un número positivo');
        setSaving(false);
        return;
      }

      // Log formatted values
      console.log('Formatted date:', formattedDate);
      console.log('Formatted time:', formattedTime);
      console.log('Duration as number:', durationValue);

      // Format participants data correctly
      const selectedParticipants = participants
        .filter(p => p.selected)
        .map(p => ({
          id: p.id,
          name: p.name,
          email: p.email,
          selected: true
        }));

      const newSelectedParticipants = availableParticipants
        .filter(c => c.selected)
        .map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          selected: true
        }));

      // Prepare data for update
      const eventData: EventFormData = {
        eventName: eventName.trim(),
        description: description.trim(),
        startDate: formattedDate,
        startTime: formattedTime,
        duration: durationValue.toString(),
        evaluationType: evaluationType,
        evaluator: evaluator.trim(),
        participants: [...selectedParticipants, ...newSelectedParticipants],
        timezone: userTimezone
      };

      console.log('Sending event update:', eventData);

      // Actualizar el evento en el backend
      await eventService.updateEvent(eventId, eventData);

      // Si se configuró enviar notificaciones, llamar al endpoint correspondiente
      if (notifyParticipants) {
        try {
          await eventService.sendEventEmails(eventId);
          console.log('Notificaciones enviadas correctamente');
        } catch (emailErr) {
          console.error('Error al enviar notificaciones:', emailErr);
          // No bloqueamos el flujo por errores en las notificaciones
        }
      }

      // Notificar éxito y volver a la vista anterior
      onBack && onBack();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar los cambios del evento';
      setError(errorMessage);
      console.error('Error al actualizar evento:', err);
    } finally {
      setSaving(false);
    }
  };

  // Manejar eliminación del evento
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!eventId) return;

    try {
      setLoading(true);
      await eventService.deleteEvent(eventId);
      setShowDeleteModal(false);
      onBack && onBack();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar el evento';
      setError(errorMessage);
      console.error('Error al eliminar evento:', err);
      setShowDeleteModal(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };

  // Filtrar participantes según el término de búsqueda
  const filteredParticipants = participants.filter(
    p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <button
              onClick={handleDeleteClick}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              disabled={loading || saving}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Eliminar evento
            </button>
          </div>
        </div>

        <div className="p-8">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="w-8 h-8 text-blue-600 animate-spin mr-3" />
              <span className="text-gray-600 text-lg">Cargando información del evento...</span>
            </div>
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <p className="mb-2 font-medium">Error al cargar los datos del evento</p>
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 text-sm text-blue-700 hover:underline"
              >
                Reintentar
              </button>
            </div>
          ) : event ? (
            <>
              {/* Alerta de notificación basada en la fecha del evento */}
              {event.status === 'Programado' && new Date(event.date).getTime() - new Date().getTime() < 86400000 * 2 && (
                <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 flex gap-3">
                  <div className="text-amber-500 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <p className="text-sm text-amber-800">
                    Atención: Este evento está programado pronto. Los cambios realizados serán notificados a todos los participantes.
                  </p>
                </div>
              )}

              {/* Pestañas de navegación */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('informacion')}
                    className={`border-b-2 py-2 px-1 text-sm font-medium ${activeTab === 'informacion'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Información del evento
                  </button>
                  <button
                    onClick={() => setActiveTab('participantes')}
                    className={`border-b-2 py-2 px-1 text-sm font-medium ${activeTab === 'participantes'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Participantes
                  </button>
                  <button
                    onClick={() => setActiveTab('historial')}
                    className={`border-b-2 py-2 px-1 text-sm font-medium ${activeTab === 'historial'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Historial de cambios
                  </button>
                </nav>
              </div>

              <form onSubmit={handleSubmit}>
                {activeTab === 'informacion' ? (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div>
                        <label htmlFor="event-id" className="block text-sm font-medium text-gray-700 mb-1">
                          ID del evento
                        </label>
                        <input
                          type="text"
                          id="event-id"
                          value={event.code || `EVT-${event.id}`}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 bg-gray-50 text-gray-500 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>

                      <div>
                        <label htmlFor="event-name" className="block text-sm font-medium text-gray-700 mb-1">
                          Nombre del evento <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="event-name"
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                          Descripción
                        </label>
                        <textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 mb-1">
                            Fecha de inicio <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              id="event-date"
                              value={eventDate}
                              onChange={(e) => setEventDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="event-time" className="block text-sm font-medium text-gray-700 mb-1">
                            Hora de inicio <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="time"
                            id="event-time"
                            value={eventTime}
                            onChange={(e) => setEventTime(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                            Duración (minutos) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              id="duration"
                              value={duration}
                              onChange={(e) => setDuration(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                              required
                              min="1"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                                <polyline points="18 15 12 9 6 15" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="evaluation-type" className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo de evaluación <span className="text-red-500">*</span>
                          </label>
                          <select
                            id="evaluation-type"
                            value={evaluationType}
                            onChange={(e) => setEvaluationType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                            required
                          >
                            <option value="">Seleccione un tipo</option>
                            <option value="tecnica">Entrevista Técnica</option>
                            <option value="practica">Prueba Práctica</option>
                            <option value="teorica">Evaluación Teórica</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="evaluator" className="block text-sm font-medium text-gray-700 mb-1">
                          Evaluador asignado <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="evaluator"
                          value={evaluator}
                          onChange={(e) => setEvaluator(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                          required
                          placeholder="Nombre y rol del evaluador"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Notificaciones</h3>
                        <div className="flex items-center mb-4">
                          <input
                            id="notify-participants"
                            type="checkbox"
                            checked={notifyParticipants}
                            onChange={(e) => setNotifyParticipants(e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="notify-participants" className="ml-2 block text-sm text-gray-700">
                            Notificar cambios a los participantes
                          </label>
                        </div>

                        <div>
                          <label htmlFor="custom-message" className="block text-sm font-medium text-gray-700 mb-1">
                            Mensaje personalizado para notificación
                          </label>
                          <textarea
                            id="custom-message"
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder="Mensaje opcional que se incluirá en la notificación de cambios..."
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />
                        </div>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 text-blue-600">
                            <Info className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Información sobre cambios</h4>
                            <p className="mt-1 text-xs text-gray-700">
                              Los cambios en la fecha, hora o duración del evento generarán notificaciones automáticas a todos los participantes. Asegúrese de que los cambios sean comunicados con suficiente antelación.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-1">Resumen de participantes</h3>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500"></div>
                          <span className="text-sm">Confirmados</span>
                          <span className="text-sm font-bold ml-auto">{participants.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activeTab === 'participantes' ? (
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-gray-900">Participantes del evento</h3>
                        {/* 
                        <button
                          type="button"
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition"
                        >
                          <Plus className="w-4 h-4" />
                          Añadir participante
                        </button>
                        */}
                      </div>

                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar participante..."
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => toggleAllParticipants(true)}
                            className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            <UserCheck className="w-4 h-4 text-green-600" />
                            Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAllParticipants(false)}
                            className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            <UserMinus className="w-4 h-4 text-gray-600" />
                            Ninguno
                          </button>
                          {selectedCount > 0 && (
                            <button
                              type="button"
                              className="flex items-center gap-1 px-3 py-1 text-sm border border-red-200 text-red-600 rounded-md hover:bg-red-50"
                            >
                              <UserX className="w-4 h-4" />
                              Eliminar ({selectedCount})
                            </button>
                          )}
                        </div>

                        <span className="text-sm text-gray-600">{participants.length} participantes</span>
                      </div>

                      <div className="overflow-hidden border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  checked={participants.length > 0 && participants.every(p => p.selected)}
                                  onChange={(e) => toggleAllParticipants(e.target.checked)}
                                />
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Participante
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Correo
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                              </th>
                              <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Acciones</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {filteredParticipants.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                  {participants.length > 0
                                    ? 'No se encontraron participantes con el término de búsqueda'
                                    : 'Este evento no tiene participantes asignados'}
                                </td>
                              </tr>
                            ) : (
                              filteredParticipants.map((participant) => (
                                <tr key={participant.id} className={participant.selected ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <input
                                      type="checkbox"
                                      checked={participant.selected}
                                      onChange={() => toggleParticipant(participant.id ?? '')}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className={`w-8 h-8 rounded-full ${participant.color} flex items-center justify-center text-white font-medium text-sm`}>
                                        {participant.initials}
                                      </div>
                                      <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-600">{participant.email}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                      Confirmado
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                      type="button"
                                      className="text-red-600 hover:text-red-900"
                                    >
                                      Eliminar
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex gap-3">
                          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 mb-1">Información</p>
                            <p className="text-xs text-gray-700">Los participantes seleccionados recibirán notificaciones sobre este evento. Puedes añadir o eliminar participantes en cualquier momento.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Historial de cambios</h3>

                      {/* Como el historial de cambios real no está disponible, mostrar mensaje */}
                      <p className="text-gray-600 text-center py-8">
                        El historial detallado de cambios no está disponible en este momento.
                        <br />
                        Esta funcionalidad se implementará en futuras actualizaciones.
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 mr-2 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-medium">Error al guardar los cambios</p>
                        <p className="text-sm mt-1">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onBack}
                    disabled={saving}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
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
            </>
          ) : (
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
          )}
        </div>
      </div>

      {/* Modal de confirmación para eliminar evento */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Confirmar eliminación"
        message="¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer y afectará a todos los participantes."
        confirmButtonText="Eliminar"
        cancelButtonText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDestructive={true}
      />
    </div>
  );
}
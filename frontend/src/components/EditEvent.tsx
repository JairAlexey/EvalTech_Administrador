import { useState } from 'react';
import { ArrowLeft, Search, Info, Plus, UserCheck, UserMinus, UserX } from 'lucide-react';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';

interface EditEventProps {
  onBack?: () => void;
  eventId?: string;
  onNavigate?: (page: string) => void;
}

export default function EditEvent({ onBack, eventId = 'EVT-2023-089', onNavigate }: EditEventProps) {
  // Estado para el modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Estado para manejar las pestañas
  const [activeTab, setActiveTab] = useState<'informacion' | 'participantes' | 'historial'>('informacion');
  
  // Datos de ejemplo para la demostración
  const [eventName, setEventName] = useState('Evaluación Técnica - Desarrolladores Frontend');
  const [description, setDescription] = useState(
    'Evaluación técnica para candidatos a la posición de Desarrollador Frontend. Se evaluarán conocimientos en HTML, CSS, JavaScript y frameworks modernos.'
  );
  const [eventDate, setEventDate] = useState('2023-11-15');
  const [eventTime, setEventTime] = useState('10:00');
  const [duration, setDuration] = useState('90');
  const [evaluationType, setEvaluationType] = useState('Entrevista Técnica');
  const [evaluator, setEvaluator] = useState('Carlos Rodríguez (Tech Lead)');
  
  // Estados para las opciones de monitoreo
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [screenEnabled, setScreenEnabled] = useState(true);
  const [notifyParticipants, setNotifyParticipants] = useState(true);
  
  // Estado para el mensaje personalizado
  const [customMessage, setCustomMessage] = useState('');
  
  // Estado para buscar participantes
  const [searchTerm, setSearchTerm] = useState('');
  
  // Datos de ejemplo de participantes
  const [participants, setParticipants] = useState([
    { id: '1', name: 'Juan Díaz', role: 'Frontend Developer', initials: 'JD', color: 'bg-blue-500', selected: true },
    { id: '2', name: 'María Rodríguez', role: 'Backend Developer', initials: 'MR', color: 'bg-green-500', selected: true },
    { id: '3', name: 'Pedro López', role: 'Frontend Developer', initials: 'PL', color: 'bg-purple-500', selected: true },
    { id: '4', name: 'Ana García', role: 'UX/UI Designer', initials: 'AG', color: 'bg-pink-500', selected: false },
    { id: '5', name: 'Carlos Martínez', role: 'Full Stack Developer', initials: 'CM', color: 'bg-yellow-500', selected: false },
    { id: '6', name: 'Sofía Pérez', role: 'Frontend Developer', initials: 'SP', color: 'bg-red-500', selected: false }
  ]);
  
  // Función para contar participantes seleccionados
  const selectedCount = participants.filter(p => p.selected).length;
  
  // Función para alternar la selección de un participante
  const toggleParticipant = (id: string) => {
    setParticipants(participants.map(p =>
      p.id === id ? { ...p, selected: !p.selected } : p
    ));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Evento actualizado');
    onBack && onBack();
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    console.log(`Eliminando evento con ID: ${eventId}`);
    setShowDeleteModal(false);
    onBack && onBack();
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
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
                <span className="text-sm">Volver a eventos</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Editar Evento de Evaluación</h1>
              <p className="text-gray-600 mt-1">Modifique los detalles del evento según sea necesario</p>
            </div>
            <button 
              onClick={handleDeleteClick}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
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
          {/* Alerta de notificación */}
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 flex gap-3">
            <div className="text-amber-500 mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <p className="text-sm text-amber-800">
              Atención: Este evento está programado para mañana. Los cambios realizados serán notificados a todos los participantes.
            </p>
          </div>

          {/* Pestañas de navegación */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button 
                onClick={() => setActiveTab('informacion')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${
                  activeTab === 'informacion' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Información del evento
              </button>
              <button 
                onClick={() => setActiveTab('participantes')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${
                  activeTab === 'participantes' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Participantes
              </button>
              <button 
                onClick={() => setActiveTab('historial')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${
                  activeTab === 'historial' 
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
                    value={eventId}
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
                      <option value="Entrevista Técnica">Entrevista Técnica</option>
                      <option value="Prueba Práctica">Prueba Práctica</option>
                      <option value="Evaluación Teórica">Evaluación Teórica</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="evaluator" className="block text-sm font-medium text-gray-700 mb-1">
                    Evaluador asignado <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="evaluator"
                    value={evaluator}
                    onChange={(e) => setEvaluator(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    required
                  >
                    <option value="Carlos Rodríguez (Tech Lead)">Carlos Rodríguez (Tech Lead)</option>
                    <option value="Ana Silva (Senior Developer)">Ana Silva (Senior Developer)</option>
                    <option value="Miguel Torres (CTO)">Miguel Torres (CTO)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Configuración de monitoreo</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        id="camera-enabled"
                        type="checkbox"
                        checked={cameraEnabled}
                        onChange={(e) => setCameraEnabled(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="camera-enabled" className="ml-2 block text-sm text-gray-700">
                        Habilitar monitoreo de cámara
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="mic-enabled"
                        type="checkbox"
                        checked={micEnabled}
                        onChange={(e) => setMicEnabled(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="mic-enabled" className="ml-2 block text-sm text-gray-700">
                        Habilitar monitoreo de micrófono
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                        id="screen-enabled"
                        type="checkbox"
                        checked={screenEnabled}
                        onChange={(e) => setScreenEnabled(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="screen-enabled" className="ml-2 block text-sm text-gray-700">
                        Habilitar monitoreo de pantalla
                      </label>
                    </div>
                  </div>
                </div>

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
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
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
                    <span className="text-sm font-bold ml-auto">3</span>
                  </div>
                </div>
              </div>
            </div>
            ) : activeTab === 'participantes' ? (
              <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">Participantes del evento</h3>
                    <button
                      type="button"
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition"
                    >
                      <Plus className="w-4 h-4" />
                      Añadir participante
                    </button>
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
                        className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        <UserCheck className="w-4 h-4 text-green-600" />
                        Todos
                      </button>
                      <button
                        type="button"
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
                            />
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Participante
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rol
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
                        {participants.map((participant) => (
                          <tr key={participant.id} className={participant.selected ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={participant.selected}
                                onChange={() => toggleParticipant(participant.id)}
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
                              <div className="text-sm text-gray-600">{participant.role}</div>
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
                        ))}
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
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <path d="M3 12h4l3 8 4-16 3 8h4"/>
                          </svg>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">Admin</span> modificó la fecha del evento
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Ayer a las 15:30</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="8.5" cy="7" r="4"/>
                            <line x1="20" y1="8" x2="20" y2="14"/>
                            <line x1="23" y1="11" x2="17" y2="11"/>
                          </svg>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">Admin</span> añadió un nuevo participante: María Rodríguez
                        </p>
                        <p className="text-xs text-gray-500 mt-1">10 de Octubre, 2025 a las 10:15</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-gray-900">Admin</span> creó el evento
                        </p>
                        <p className="text-xs text-gray-500 mt-1">9 de Octubre, 2025 a las 09:45</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Guardar cambios
              </button>
            </div>
          </form>
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
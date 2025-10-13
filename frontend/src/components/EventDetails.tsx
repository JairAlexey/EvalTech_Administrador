import { useState } from 'react';
import { ArrowLeft, UserPlus, Trash2 } from 'lucide-react';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';

interface EventDetailsProps {
  onBack?: () => void;
  onEdit?: (eventId: string) => void;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

export default function EventDetails({ onBack, onEdit, onNavigate, onLogout }: EventDetailsProps) {
  // Estado para el modal de confirmación de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Datos de ejemplo para la demostración
  const eventData = {
    id: 'EVT-2023-089',
    name: 'Evaluación Técnica - Desarrolladores Frontend',
    date: '15 de Noviembre, 2023',
    time: '10:00 AM - 11:30 AM',
    duration: '90 minutos',
    type: 'Entrevista Técnica',
    status: 'Programado',
    evaluator: 'Carlos Rodríguez (Tech Lead)',
    description: 'Evaluación técnica para candidatos a la posición de Desarrollador Frontend. Se evaluarán conocimientos en HTML, CSS, JavaScript y frameworks modernos. Los candidatos deberán resolver problemas prácticos y responder preguntas técnicas durante la sesión.',
    participants: [
      {
        id: 'CAND-2023-045',
        initials: 'JD',
        name: 'Juan Díaz',
        experience: '3 años',
        role: 'Frontend Developer',
        email: 'jdiaz@email.com',
        phone: '+34 612 345 678',
        status: 'Confirmado'
      },
      {
        id: 'CAND-2023-046',
        initials: 'MR',
        name: 'María Rodríguez',
        experience: '5 años',
        role: 'Frontend Developer',
        email: 'mrodriguez@email.com',
        phone: '+34 623 456 789',
        status: 'Confirmado'
      },
      {
        id: 'CAND-2023-047',
        initials: 'PL',
        name: 'Pedro López',
        experience: '2 años',
        role: 'Frontend Developer',
        email: 'plopez@email.com',
        phone: '+34 634 567 890',
        status: 'Confirmado'
      }
    ]
  };

  // Funciones para manejar la eliminación
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    console.log(`Eliminando evento con ID: ${eventData.id}`);
    setShowDeleteModal(false);
    onBack && onBack();
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
  };
  
  // Función para generar colores consistentes para las iniciales basados en el nombre
  const getInitialsColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500',
      'bg-teal-500'
    ];
    
    // Genera un índice basado en el nombre
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[charCodeSum % colors.length];
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
              <h1 className="text-2xl font-bold text-gray-900">Detalles del Evento</h1>
              <p className="text-gray-600 mt-1">Información completa del evento de evaluación</p>
            </div>
            <div className="flex gap-4">
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Exportar datos
              </button>
              <button 
                onClick={() => onEdit && onEdit(eventData.id)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
                Editar evento
              </button>
              <button 
                onClick={handleDeleteClick}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition shadow-sm"
              >
                <Trash2 size={20} />
                Eliminar evento
              </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200 mb-6">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{eventData.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">ID: {eventData.id}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700`}>
                  {eventData.status}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Fecha</p>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <p className="text-sm font-medium">{eventData.date}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Hora</p>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <p className="text-sm font-medium">{eventData.time}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Duración</p>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    <p className="text-sm font-medium">{eventData.duration}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">Tipo</p>
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <line x1="10" y1="9" x2="8" y2="9" />
                    </svg>
                    <p className="text-sm font-medium">{eventData.type}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-gray-700 font-medium">Evaluador asignado</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-sm">
                    CR
                  </div>
                  <p className="text-sm font-medium">{eventData.evaluator}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-700 font-medium mb-2">Descripción</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {eventData.description}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Participantes del Evento</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition">
                  <UserPlus className="w-4 h-4" />
                  Añadir participante
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Candidato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Experiencia
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {eventData.participants.map((participant) => (
                    <tr key={participant.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getInitialsColor(participant.name)} flex items-center justify-center text-white font-medium text-xs`}>
                            {participant.initials}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{participant.name}</p>
                            <p className="text-xs text-gray-500">ID: {participant.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900">{participant.experience}</p>
                          <p className="text-xs text-gray-500">{participant.role}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900">{participant.email}</p>
                          <p className="text-xs text-gray-500">{participant.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {participant.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                          </button>
                          <button className="p-1.5 text-red-600 hover:bg-red-50 rounded transition">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para eliminar evento */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Confirmar eliminación"
        message="¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer y cancelará la evaluación para todos los participantes."
        confirmButtonText="Eliminar"
        cancelButtonText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDestructive={true}
      />
    </div>
  );
}
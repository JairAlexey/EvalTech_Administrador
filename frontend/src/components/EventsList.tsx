import { useState } from 'react';
import { Plus, Search, Filter, Eye, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';

interface Event {
  id: string;
  code: string;
  name: string;
  date: string;
  time: string;
  duration: string;
  participants: number;
  status: 'Programado' | 'En progreso' | 'Completado' | 'Cancelado';
  selected: boolean;
}

interface EventsListProps {
  onCreateEvent: () => void;
  onViewEventDetails: (eventId: string) => void;
  onEditEvent: (eventId: string) => void;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

export default function EventsList({ onCreateEvent, onViewEventDetails, onEditEvent, onNavigate, onLogout }: EventsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);

  const handleDeleteClick = (eventId: string) => {
    setEventToDelete(eventId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (eventToDelete) {
      // Eliminar el evento de la lista
      setEvents(events.filter(event => event.id !== eventToDelete));
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setEventToDelete(null);
  };

  const [events, setEvents] = useState<Event[]>([
    {
      id: '1',
      code: 'EVT-2023-155',
      name: 'Evaluación Técnica - Desarrolladores Frontend',
      date: '15/11/2023',
      time: '10:00 AM',
      duration: '90 minutos',
      participants: 4,
      status: 'Programado',
      selected: false,
    },
    {
      id: '2',
      code: 'EVT-2023-090',
      name: 'Evaluación de Habilidades - UX/UI Designers',
      date: '16/11/2023',
      time: '14:30 PM',
      duration: '120 minutos',
      participants: 3,
      status: 'Programado',
      selected: false,
    },
    {
      id: '3',
      code: 'EVT-2023-088',
      name: 'Prueba Técnica - Backend Developers',
      date: '14/11/2023',
      time: '08:00 AM',
      duration: '180 minutos',
      participants: 5,
      status: 'En progreso',
      selected: false,
    },
    {
      id: '4',
      code: 'EVT-2023-087',
      name: 'Evaluación de Conocimientos - DevOps',
      date: '13/11/2023',
      time: '11:00 AM',
      duration: '120 minutos',
      participants: 2,
      status: 'Completado',
      selected: false,
    },
    {
      id: '5',
      code: 'EVT-2023-088',
      name: 'Entrevista Técnica - Data Scientists',
      date: '10/11/2023',
      time: '15:00 PM',
      duration: '90 minutos',
      participants: 3,
      status: 'Cancelado',
      selected: false,
    },
  ]);

  const selectedCount = events.filter(e => e.selected).length;

  const toggleEvent = (id: string) => {
    setEvents(events.map(e =>
      e.id === id ? { ...e, selected: !e.selected } : e
    ));
  };

  const toggleAllEvents = () => {
    const allSelected = events.every(e => e.selected);
    setEvents(events.map(e => ({ ...e, selected: !allSelected })));
  };

  const getStatusColor = (status: Event['status']) => {
    switch (status) {
      case 'Programado':
        return 'bg-blue-100 text-blue-700';
      case 'En progreso':
        return 'bg-yellow-100 text-yellow-700';
      case 'Completado':
        return 'bg-green-100 text-green-700';
      case 'Cancelado':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="eventos" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestión de Eventos</h1>
              <p className="text-gray-600 mt-1">Administre los eventos de evaluación técnica</p>
            </div>
            <button
              onClick={onCreateEvent}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo evento
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={events.length > 0 && events.every(e => e.selected)}
                      onChange={toggleAllEvents}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-600">{selectedCount} seleccionados</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar eventos..."
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-64"
                    />
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm">
                    <Filter className="w-4 h-4" />
                    Filtros
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-12 px-6 py-3"></th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Evento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Fecha y Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Duración
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Participantes
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
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={event.selected}
                          onChange={() => toggleEvent(event.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{event.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{event.code}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900">{event.date}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{event.time}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{event.duration}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{event.participants} candidatos</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                          {event.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => onViewEventDetails(event.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => onEditEvent(event.id)}
                            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(event.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Mostrando 1 a 5 de 12 eventos
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>

                  <button className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                    1
                  </button>
                  <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                    2
                  </button>
                  <button className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                    3
                  </button>

                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de confirmación para eliminar evento */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Confirmar eliminación"
        message="¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer."
        confirmButtonText="Eliminar"
        cancelButtonText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDestructive={true}
      />
    </div>
  );
}

import { useState } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, ClipboardList } from 'lucide-react';
import Sidebar from './Sidebar';

interface Event {
  id: string;
  code: string;
  name: string;
  date: string;
  time: string;
  duration: string;
  participants: Participant[];
  status: 'Programado' | 'En progreso' | 'Completado' | 'Cancelado';
}

interface Participant {
  id: string;
  name: string;
  position: string;
  status: 'Pendiente' | 'En progreso' | 'Completado' | 'No presentó';
  risk: 'Bajo' | 'Medio' | 'Alto' | null;
}

interface EvaluationsListProps {
  onNavigate?: (page: string) => void;
  onViewEvaluation?: (participantId: string, eventId: string) => void;
}

export default function EvaluationsList({ onNavigate, onViewEvaluation }: EvaluationsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  // Eventos de ejemplo
  const events: Event[] = [
    {
      id: 'EVT-2025-001',
      code: 'DEV-FE-OCT',
      name: 'Evaluación Frontend React/TypeScript',
      date: '10/10/2025',
      time: '10:00 AM',
      duration: '60 min',
      status: 'Completado',
      participants: [
        {
          id: 'CAND-2025-001',
          name: 'Juan Pérez',
          position: 'Frontend Developer',
          status: 'Completado',
          risk: 'Alto'
        },
        {
          id: 'CAND-2025-002',
          name: 'Ana Gómez',
          position: 'Frontend Developer',
          status: 'Completado',
          risk: 'Bajo'
        },
        {
          id: 'CAND-2025-003',
          name: 'Carlos Rodríguez',
          position: 'Frontend Developer',
          status: 'Completado',
          risk: 'Medio'
        }
      ]
    },
    {
      id: 'EVT-2025-002',
      code: 'DEV-BE-OCT',
      name: 'Evaluación Backend Node.js',
      date: '12/10/2025',
      time: '14:00 PM',
      duration: '90 min',
      status: 'En progreso',
      participants: [
        {
          id: 'CAND-2025-004',
          name: 'María López',
          position: 'Backend Developer',
          status: 'En progreso',
          risk: null
        },
        {
          id: 'CAND-2025-005',
          name: 'Roberto Sánchez',
          position: 'Backend Developer',
          status: 'Pendiente',
          risk: null
        }
      ]
    },
    {
      id: 'EVT-2025-003',
      code: 'DEV-FS-OCT',
      name: 'Evaluación Full Stack',
      date: '15/10/2025',
      time: '11:00 AM',
      duration: '120 min',
      status: 'Programado',
      participants: [
        {
          id: 'CAND-2025-006',
          name: 'David Martínez',
          position: 'Full Stack Developer',
          status: 'Pendiente',
          risk: null
        },
        {
          id: 'CAND-2025-007',
          name: 'Laura Díaz',
          position: 'Full Stack Developer',
          status: 'Pendiente',
          risk: null
        },
        {
          id: 'CAND-2025-008',
          name: 'Pedro Vázquez',
          position: 'Full Stack Developer',
          status: 'Pendiente',
          risk: null
        }
      ]
    }
  ];

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !filterStatus || event.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Función para obtener el evento seleccionado
  const getSelectedEvent = () => {
    if (!selectedEvent) return null;
    return events.find(event => event.id === selectedEvent);
  };

  // Función para manejar la paginación
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  // Renderizar color de acuerdo al nivel de riesgo
  const getRiskBadgeColor = (risk: 'Bajo' | 'Medio' | 'Alto' | null) => {
    switch (risk) {
      case 'Alto':
        return 'bg-red-100 text-red-800';
      case 'Medio':
        return 'bg-orange-100 text-orange-800';
      case 'Bajo':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Renderizar color de acuerdo al estado
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Completado':
        return 'bg-green-100 text-green-800';
      case 'En progreso':
        return 'bg-blue-100 text-blue-800';
      case 'Programado':
        return 'bg-purple-100 text-purple-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      case 'Pendiente':
        return 'bg-gray-100 text-gray-800';
      case 'No presentó':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="evaluaciones" onNavigate={onNavigate} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white p-6 shadow-sm border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Evaluaciones</h1>
          </div>
        </div>

        {/* Barra de búsqueda y filtros */}
        <div className="p-6 bg-white border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative w-full md:w-96">
              <input
                type="text"
                placeholder="Buscar evaluaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Filtrar:</span>
              <select
                className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterStatus || ''}
                onChange={(e) => setFilterStatus(e.target.value || null)}
              >
                <option value="">Todos</option>
                <option value="Programado">Programados</option>
                <option value="En progreso">En progreso</option>
                <option value="Completado">Completados</option>
                <option value="Cancelado">Cancelados</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6">
          {selectedEvent ? (
            <div>
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="mr-4 px-3 py-1.5 border border-gray-300 rounded-md flex items-center text-sm font-medium hover:bg-gray-50 transition"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Volver
                </button>
                <h2 className="text-xl font-bold text-gray-900">
                  {getSelectedEvent()?.name}
                </h2>
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="font-medium text-gray-700 mr-2">Código:</div>
                  <div>{getSelectedEvent()?.code}</div>
                </div>
                <div className="flex items-center">
                  <div className="font-medium text-gray-700 mr-2">Fecha:</div>
                  <div>{getSelectedEvent()?.date}</div>
                </div>
                <div className="flex items-center">
                  <div className="font-medium text-gray-700 mr-2">Hora:</div>
                  <div>{getSelectedEvent()?.time}</div>
                </div>
                <div className="flex items-center">
                  <div className="font-medium text-gray-700 mr-2">Duración:</div>
                  <div>{getSelectedEvent()?.duration}</div>
                </div>
                <div className="flex items-center">
                  <div className="font-medium text-gray-700 mr-2">Estado:</div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(getSelectedEvent()?.status || '')}`}>
                    {getSelectedEvent()?.status}
                  </span>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-4">Participantes</h3>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Puesto
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Riesgo
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getSelectedEvent()?.participants.map((participant) => (
                      <tr key={participant.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {participant.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {participant.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {participant.position}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(participant.status)}`}>
                            {participant.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {participant.risk ? (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getRiskBadgeColor(participant.risk)}`}>
                              {participant.risk}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">No evaluado</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            className="text-blue-600 hover:text-blue-900 flex items-center"
                            onClick={() => onViewEvaluation && onViewEvaluation(participant.id, getSelectedEvent()?.id || '')}
                          >
                            <ClipboardList className="h-4 w-4 mr-1" />
                            Evaluación
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Código
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Participantes
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {event.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {event.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {event.date}
                          </div>
                          <div className="text-xs text-gray-500">
                            {event.time} ({event.duration})
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(event.status)}`}>
                            {event.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {event.participants.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            className="text-blue-600 hover:text-blue-900 flex items-center"
                            onClick={() => setSelectedEvent(event.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver participantes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-gray-700">
                  Mostrando <span className="font-medium">{filteredEvents.length}</span> eventos
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 border border-gray-300 rounded-md text-sm ${currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={filteredEvents.length < 10}
                    className={`px-3 py-1 border border-gray-300 rounded-md text-sm ${filteredEvents.length < 10
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

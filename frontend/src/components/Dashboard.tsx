import { useState } from 'react';
import { Calendar, Users, FileText, Activity, ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import Sidebar from './Sidebar';

interface DashboardProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

export default function Dashboard({ onNavigate, onLogout }: DashboardProps) {
  // Estado para el filtro de fechas
  const [dateFilter, setDateFilter] = useState('month');

  // Datos simulados para las tarjetas de resumen
  const summaryData = {
    events: {
      total: 24,
      change: 8,
      increasing: true
    },
    participants: {
      total: 124,
      change: 12,
      increasing: true
    },
    evaluations: {
      total: 78,
      change: 5,
      increasing: true
    },
    completion: {
      total: 67,
      change: 3,
      increasing: false
    }
  };

  // Datos simulados para eventos próximos
  const upcomingEvents = [
    {
      id: '1',
      name: 'Evaluación Frontend',
      date: '15/10/2025',
      time: '10:00 AM',
      participants: 5,
      status: 'Programado'
    },
    {
      id: '2',
      name: 'Evaluación Backend',
      date: '17/10/2025',
      time: '14:30 PM',
      participants: 4,
      status: 'Programado'
    },
    {
      id: '3',
      name: 'Entrevista UX/UI',
      date: '20/10/2025',
      time: '09:00 AM',
      participants: 3,
      status: 'Programado'
    }
  ];

  // Datos simulados para participantes recientes
  const recentParticipants = [
    {
      id: '1',
      name: 'Juan Díaz',
      initials: 'JD',
      color: 'bg-blue-200',
      position: 'Frontend Developer',
      date: '10/10/2025'
    },
    {
      id: '2',
      name: 'María Rodríguez',
      initials: 'MR',
      color: 'bg-green-200',
      position: 'Backend Developer',
      date: '09/10/2025'
    },
    {
      id: '3',
      name: 'Carlos López',
      initials: 'CL',
      color: 'bg-purple-200',
      position: 'Full Stack Developer',
      date: '08/10/2025'
    },
    {
      id: '4',
      name: 'Laura García',
      initials: 'LG',
      color: 'bg-yellow-200',
      position: 'UX Designer',
      date: '07/10/2025'
    }
  ];

  // Datos simulados para las estadísticas de evaluaciones
  const evaluationStats = {
    totalCompleted: 78,
    average: 72,
    bySkill: [
      { name: 'JavaScript', score: 68 },
      { name: 'React', score: 75 },
      { name: 'Node.js', score: 63 },
      { name: 'CSS', score: 80 }
    ]
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar currentPage="dashboard" onNavigate={onNavigate} onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">Resumen y análisis de evaluaciones técnicas</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Ver datos de:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Última semana</option>
                <option value="month">Último mes</option>
                <option value="quarter">Último trimestre</option>
                <option value="year">Último año</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Tarjetas de resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Tarjeta de Eventos */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Eventos</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{summaryData.events.total}</h3>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-700" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${summaryData.events.increasing ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                  {summaryData.events.increasing ?
                    <ArrowUp className="w-3 h-3 mr-1" /> :
                    <ArrowDown className="w-3 h-3 mr-1" />
                  }
                  {summaryData.events.change}%
                </span>
                <span className="text-xs text-gray-500 ml-2">vs periodo anterior</span>
              </div>
            </div>

            {/* Tarjeta de Participantes */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Participantes</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{summaryData.participants.total}</h3>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="w-6 h-6 text-green-700" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${summaryData.participants.increasing ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                  {summaryData.participants.increasing ?
                    <ArrowUp className="w-3 h-3 mr-1" /> :
                    <ArrowDown className="w-3 h-3 mr-1" />
                  }
                  {summaryData.participants.change}%
                </span>
                <span className="text-xs text-gray-500 ml-2">vs periodo anterior</span>
              </div>
            </div>

            {/* Tarjeta de Evaluaciones */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Evaluaciones</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{summaryData.evaluations.total}</h3>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-700" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${summaryData.evaluations.increasing ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                  {summaryData.evaluations.increasing ?
                    <ArrowUp className="w-3 h-3 mr-1" /> :
                    <ArrowDown className="w-3 h-3 mr-1" />
                  }
                  {summaryData.evaluations.change}%
                </span>
                <span className="text-xs text-gray-500 ml-2">vs periodo anterior</span>
              </div>
            </div>

            {/* Tarjeta de Porcentaje de Completado */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">% Completado</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{summaryData.completion.total}%</h3>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Activity className="w-6 h-6 text-amber-700" />
                </div>
              </div>
              <div className="flex items-center mt-4">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${summaryData.completion.increasing ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                  {summaryData.completion.increasing ?
                    <ArrowUp className="w-3 h-3 mr-1" /> :
                    <ArrowDown className="w-3 h-3 mr-1" />
                  }
                  {summaryData.completion.change}%
                </span>
                <span className="text-xs text-gray-500 ml-2">vs periodo anterior</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Rendimiento */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Rendimiento de Evaluaciones</h3>

              <div className="h-64 flex items-end justify-between space-x-2">
                {/* Simulamos un gráfico de barras simple */}
                <div className="flex flex-col items-center">
                  <div className="w-10 bg-blue-500 rounded-t-md" style={{ height: '40%' }}></div>
                  <span className="text-xs mt-2">Lun</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 bg-blue-500 rounded-t-md" style={{ height: '65%' }}></div>
                  <span className="text-xs mt-2">Mar</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 bg-blue-500 rounded-t-md" style={{ height: '45%' }}></div>
                  <span className="text-xs mt-2">Mié</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 bg-blue-500 rounded-t-md" style={{ height: '70%' }}></div>
                  <span className="text-xs mt-2">Jue</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 bg-blue-500 rounded-t-md" style={{ height: '55%' }}></div>
                  <span className="text-xs mt-2">Vie</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 bg-blue-500 rounded-t-md" style={{ height: '25%' }}></div>
                  <span className="text-xs mt-2">Sáb</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-10 bg-blue-500 rounded-t-md" style={{ height: '15%' }}></div>
                  <span className="text-xs mt-2">Dom</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-600">Promedio de puntuación</p>
                  <p className="text-xl font-bold text-gray-900">{evaluationStats.average}/100</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Evaluaciones completadas</p>
                  <p className="text-xl font-bold text-gray-900">{evaluationStats.totalCompleted}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Mejor habilidad</p>
                  <p className="text-xl font-bold text-gray-900">CSS (80%)</p>
                </div>
              </div>
            </div>

            {/* Habilidades Evaluadas */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Puntuación por Habilidad</h3>

              <div className="space-y-4">
                {evaluationStats.bySkill.map((skill) => (
                  <div key={skill.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{skill.name}</span>
                      <span className="text-sm font-bold">{skill.score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${skill.score}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              <button className="mt-6 w-full py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 rounded-md border border-gray-200 transition">
                Ver todas las habilidades
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Eventos Próximos */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Eventos Próximos</h3>
                <button className="text-sm text-blue-600 font-medium hover:text-blue-800">
                  Ver todos
                </button>
              </div>

              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                      <Calendar className="w-5 h-5 text-blue-700" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">{event.name}</h4>
                      <p className="text-xs text-gray-500">{event.date} - {event.time}</p>
                    </div>
                    <div>
                      <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {event.participants} participantes
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Participantes Recientes */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Participantes Recientes</h3>
                <button className="text-sm text-blue-600 font-medium hover:text-blue-800">
                  Ver todos
                </button>
              </div>

              <div className="space-y-4">
                {recentParticipants.map((participant) => (
                  <div key={participant.id} className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition">
                    <div className={`w-10 h-10 rounded-full ${participant.color} flex items-center justify-center text-gray-700 font-medium text-sm mr-4`}>
                      {participant.initials}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium">{participant.name}</h4>
                      <p className="text-xs text-gray-500">{participant.position}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500">Registrado</span>
                      <p className="text-xs font-medium">{participant.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Estadísticas de Conversión */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Métricas de Evaluación</h3>
              <div className="flex space-x-2">
                <button className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md">
                  Mensual
                </button>
                <button className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md">
                  Trimestral
                </button>
                <button className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md">
                  Anual
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-md mr-3">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tasa de aprobación</p>
                    <p className="text-lg font-bold">68%</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-md mr-3">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tiempo promedio</p>
                    <p className="text-lg font-bold">45 min</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
                <div className="flex items-center">
                  <div className="p-2 bg-amber-100 rounded-md mr-3">
                    <Users className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tasa de participación</p>
                    <p className="text-lg font-bold">92%</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-gray-100 rounded-lg bg-gray-50">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-md mr-3">
                    <Calendar className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Evaluaciones/semana</p>
                    <p className="text-lg font-bold">12.5</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
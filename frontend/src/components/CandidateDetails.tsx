import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Sidebar from './Sidebar';

interface CandidateDetailsProps {
  onBack?: () => void;
  onNavigate?: (page: string) => void;
  candidateId?: string;
  onEdit?: (candidateId: string) => void;
}

export default function CandidateDetails({ onBack, onNavigate, candidateId, onEdit }: CandidateDetailsProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<'información' | 'credenciales' | 'evaluaciones' | 'historial'>('información');
  
  // Datos de ejemplo para la demostración
  const candidateData = {
    id: 'CAND-2023-001',
    initials: 'JD',
    color: 'bg-blue-200',
    nombre: 'Juan Díaz Rodríguez',
    email: 'jdiaz@email.com',
    telefono: '+52 55 1234 5678',
    fechaRegistro: '05/11/2023',
    puesto: 'Desarrollador Frontend',
    años: '3 años',
    habilidades: ['JavaScript', 'React', 'HTML', 'CSS', 'Tailwind'],
    evento: {
      codigo: 'EVT-2023-089',
      nombre: 'Evaluación Frontend - Noviembre 2023',
      fecha: '15/11/2023',
      estado: 'Confirmado',
    },
    progreso: 75,
    estado: 'Activo',
    notas: 'Candidato con experiencia en proyectos de e-commerce. Mostró interés en el stack tecnológico de la empresa durante la entrevista inicial.'
  };
  
  // Renderizar pestañas
  const renderTabContent = () => {
    switch (activeTab) {
      case 'información':
        return (
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Información Personal</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500">Nombre completo</p>
                    <p className="font-medium">{candidateData.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Correo electrónico</p>
                    <p className="font-medium">{candidateData.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Teléfono</p>
                    <p className="font-medium">{candidateData.telefono}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fecha de registro</p>
                    <p className="font-medium">{candidateData.fechaRegistro}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Notas</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                  <p className="text-sm text-gray-700">{candidateData.notas}</p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="mb-8">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Información Profesional</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500">Puesto</p>
                    <p className="font-medium">{candidateData.puesto}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Años de experiencia</p>
                    <p className="font-medium">{candidateData.años}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Habilidades</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {candidateData.habilidades.map((skill, index) => (
                        <span 
                          key={index}
                          className={`px-2 py-1 text-xs font-medium rounded-md ${
                            skill === 'JavaScript' ? 'bg-yellow-100 text-yellow-800' : 
                            skill === 'React' ? 'bg-blue-100 text-blue-800' : 
                            skill === 'HTML' ? 'bg-red-100 text-red-800' : 
                            skill === 'CSS' ? 'bg-purple-100 text-purple-800' : 
                            skill === 'Tailwind' ? 'bg-teal-100 text-teal-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Evento Asignado</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500">Código de evento</p>
                    <p className="font-medium">{candidateData.evento.codigo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Nombre del evento</p>
                    <p className="font-medium">{candidateData.evento.nombre}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fecha del evento</p>
                    <p className="font-medium">{candidateData.evento.fecha}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Estado de participación</p>
                    <div className="inline-block">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        {candidateData.evento.estado}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'credenciales':
        return (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-4">Credenciales</h3>
            <p className="text-gray-600">Información de credenciales y accesos del candidato.</p>
            {/* Contenido para la pestaña de credenciales */}
            <div className="mt-4 space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-medium mb-2">Credenciales para el evento {candidateData.evento.codigo}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Usuario</p>
                    <p className="font-medium">{candidateData.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Contraseña temporal</p>
                    <p className="font-medium">********</p>
                    <button className="text-xs text-blue-600 mt-1">Generar nueva</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'evaluaciones':
        return (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Evaluaciones</h3>
              <div className="space-x-2">
                <span className="text-sm">Progreso total:</span>
                <div className="inline-block w-40 bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${candidateData.progreso}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold">{candidateData.progreso}%</span>
              </div>
            </div>
            {/* Lista de evaluaciones */}
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-medium">Evaluación Técnica Frontend</h4>
                    <p className="text-sm text-gray-500">Cuestionario de conocimientos</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-medium text-blue-600">85%</span>
                    <span className="text-sm text-gray-500">Completado</span>
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-medium">Ejercicio Práctico</h4>
                    <p className="text-sm text-gray-500">Desarrollo de componente UI</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-medium text-blue-600">65%</span>
                    <span className="text-sm text-gray-500">En progreso</span>
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: '65%' }}></div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'historial':
        return (
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-medium mb-4">Historial de actividades</h3>
            {/* Timeline de actividades */}
            <div className="space-y-6">
              <div className="relative pl-6 pb-6 border-l border-gray-200">
                <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-1.5 bg-blue-500"></div>
                <div className="mb-1">
                  <span className="text-xs font-medium text-blue-500">Hoy - 10:30 AM</span>
                </div>
                <p className="text-sm">Completó la sección 3 del cuestionario técnico</p>
              </div>
              
              <div className="relative pl-6 pb-6 border-l border-gray-200">
                <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-1.5 bg-blue-500"></div>
                <div className="mb-1">
                  <span className="text-xs font-medium text-blue-500">Ayer - 3:45 PM</span>
                </div>
                <p className="text-sm">Inició el ejercicio práctico de desarrollo</p>
              </div>
              
              <div className="relative pl-6 pb-6 border-l border-gray-200">
                <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-1.5 bg-green-500"></div>
                <div className="mb-1">
                  <span className="text-xs font-medium text-green-500">10 Oct, 2025 - 1:15 PM</span>
                </div>
                <p className="text-sm">Confirmó asistencia al evento de evaluación</p>
              </div>
              
              <div className="relative pl-6">
                <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-1.5 bg-gray-400"></div>
                <div className="mb-1">
                  <span className="text-xs font-medium text-gray-500">5 Oct, 2025 - 9:20 AM</span>
                </div>
                <p className="text-sm">Registrado en el sistema</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
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
              <h1 className="text-2xl font-bold text-gray-900">Detalles del Candidato</h1>
              <p className="text-gray-600 mt-1">Visualización detallada de candidatos registrados</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                candidateData.estado === 'Activo' ? 'bg-green-100 text-green-800' : 
                'bg-gray-100 text-gray-800'
              }`}>
                {candidateData.estado}
              </span>
              <button 
                onClick={() => onEdit && candidateId && onEdit(candidateId)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Editar
              </button>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-8 flex items-center space-x-6">
            <div className={`w-16 h-16 ${candidateData.color} rounded-full flex items-center justify-center text-gray-700 text-2xl font-medium`}>
              {candidateData.initials}
            </div>
            <div>
              <h2 className="text-xl font-bold">{candidateData.nombre}</h2>
              <p className="text-gray-600">{candidateData.puesto}</p>
            </div>
            <div className="ml-auto flex items-center space-x-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Progreso general</p>
                <div className="w-40 bg-gray-200 rounded-full h-2.5 mb-1">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${candidateData.progreso}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Progreso</span>
                  <span className="font-medium">{candidateData.progreso}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pestañas de navegación */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('información')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${
                  activeTab === 'información'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Información
              </button>
              <button
                onClick={() => setActiveTab('credenciales')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${
                  activeTab === 'credenciales'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Credenciales
              </button>
              <button
                onClick={() => setActiveTab('evaluaciones')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${
                  activeTab === 'evaluaciones'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Evaluaciones
              </button>
              <button
                onClick={() => setActiveTab('historial')}
                className={`border-b-2 py-2 px-1 text-sm font-medium ${
                  activeTab === 'historial'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Historial
              </button>
            </nav>
          </div>

          {/* Contenido de la pestaña activa */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { ArrowLeft, Search, Info } from 'lucide-react';
import Sidebar from './Sidebar';

interface Candidate {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
  selected: boolean;
}

interface CreateEventProps {
  onBack?: () => void;
  onNavigate?: (page: string) => void;
}

export default function CreateEvent({ onBack, onNavigate }: CreateEventProps) {
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

  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: '1', name: 'Juan Pérez', role: 'Frontend Developer', initials: 'JP', color: 'bg-blue-500', selected: false },
    { id: '2', name: 'María Rodríguez', role: 'Backend Developer', initials: 'MR', color: 'bg-green-500', selected: false },
    { id: '3', name: 'Alejandro López', role: 'Full Stack Developer', initials: 'AL', color: 'bg-purple-500', selected: false },
    { id: '4', name: 'Sofía García', role: 'UX/UI Designer', initials: 'SG', color: 'bg-red-500', selected: false },
  ]);

  const selectedCount = candidates.filter(c => c.selected).length;

  const toggleCandidate = (id: string) => {
    setCandidates(candidates.map(c =>
      c.id === id ? { ...c, selected: !c.selected } : c
    ));
  };

  const clearSelection = () => {
    setCandidates(candidates.map(c => ({ ...c, selected: false })));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Event created');
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
                <span className="text-sm font-medium text-blue-600">{candidates.length} disponibles</span>
              </div>

              <div className="space-y-2 mb-6">
                {candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    onClick={() => toggleCandidate(candidate.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      candidate.selected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full ${candidate.color} flex items-center justify-center text-white font-semibold text-sm flex-shrink-0`}>
                      {candidate.initials}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{candidate.name}</p>
                      <p className="text-xs text-gray-600">{candidate.role}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Información</p>
                    <p className="text-xs text-gray-700">Los candidatos seleccionados recibirán una notificación por correo electrónico con los detalles del evento y las instrucciones para acceder a la evaluación.</p>
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
              <button
                type="button"
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
              >
                Crear Evento
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

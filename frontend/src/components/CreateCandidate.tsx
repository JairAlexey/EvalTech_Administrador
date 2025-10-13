import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Sidebar from './Sidebar';

interface CreateCandidateProps {
  onBack?: () => void;
  onCreate?: (candidateData: any) => void;
  onNavigate?: (page: string) => void;
}

export default function CreateCandidate({ onBack, onCreate, onNavigate }: CreateCandidateProps) {
  // Estados para los campos del formulario
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [puesto, setPuesto] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [habilidades, setHabilidades] = useState('');
  const [evento, setEvento] = useState('');
  const [notas, setNotas] = useState('');
  const [enviarCredenciales, setEnviarCredenciales] = useState(true);
  const [enviarRecordatorio, setEnviarRecordatorio] = useState(true);

  // Manejar el envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate && onCreate({
      nombre,
      apellidos,
      correo,
      puesto,
      experiencia,
      habilidades: habilidades.split(',').map(h => h.trim()),
      evento,
      notas,
      configuracion: {
        enviarCredenciales,
        enviarRecordatorio
      }
    });
    onBack && onBack();
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
              <h1 className="text-2xl font-bold text-gray-900">Crear Candidato</h1>
              <p className="text-gray-600 mt-1">Registra un nuevo candidato en el sistema</p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Columna 1: Información Personal */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Personal</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="apellidos" className="block text-sm font-medium text-gray-700 mb-1">
                      Apellidos <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="apellidos"
                      value={apellidos}
                      onChange={(e) => setApellidos(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="correo" className="block text-sm font-medium text-gray-700 mb-1">
                      Correo Electrónico <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="correo"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Se enviarán las credenciales a este correo</p>
                  </div>
                </div>
              </div>

              {/* Columna 2: Información Profesional */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Profesional</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="puesto" className="block text-sm font-medium text-gray-700 mb-1">
                      Puesto al que aplica <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="puesto"
                      value={puesto}
                      onChange={(e) => setPuesto(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="experiencia" className="block text-sm font-medium text-gray-700 mb-1">
                      Años de experiencia
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="experiencia"
                        value={experiencia}
                        onChange={(e) => setExperiencia(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                        min="0"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="habilidades" className="block text-sm font-medium text-gray-700 mb-1">
                      Habilidades principales
                    </label>
                    <input
                      type="text"
                      id="habilidades"
                      value={habilidades}
                      onChange={(e) => setHabilidades(e.target.value)}
                      placeholder="Ej: JavaScript, React, Node.js"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">Separadas por comas</p>
                  </div>
                </div>
              </div>

              {/* Columna 3: Asignación de Evento */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Asignación de Evento</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="evento" className="block text-sm font-medium text-gray-700 mb-1">
                      Evento <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="evento"
                        value={evento}
                        onChange={(e) => setEvento(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none"
                        required
                      >
                        <option value="">Seleccionar evento</option>
                        <option value="EVT-2023-089">EVT-2023-089: Evaluación Frontend (15/11/2023)</option>
                        <option value="EVT-2023-090">EVT-2023-090: Evaluación Backend (20/11/2023)</option>
                        <option value="EVT-2023-091">EVT-2023-091: Evaluación UX/UI (25/11/2023)</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">
                      Notas adicionales
                    </label>
                    <textarea
                      id="notas"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Añadir notas sobre el candidato..."
                    ></textarea>
                  </div>

                  <div className="pt-3">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Configuración de Acceso</h3>
                    
                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 mb-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="ml-3 text-xs text-blue-700">
                          El sistema generará automáticamente las credenciales de acceso y las enviará al correo proporcionado.
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enviarCredenciales}
                          onChange={(e) => setEnviarCredenciales(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Enviar credenciales por correo</span>
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={enviarRecordatorio}
                          onChange={(e) => setEnviarRecordatorio(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Enviar recordatorio 24h antes</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6 space-x-3">
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
                Crear Candidato
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
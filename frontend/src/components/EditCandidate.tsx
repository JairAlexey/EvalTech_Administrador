import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import ConfirmationModal from './ConfirmationModal';

interface EditCandidateProps {
  onBack?: () => void;
  onSave?: (candidateData: any) => void;
  candidateId?: string;
  onNavigate?: (page: string) => void;
}

export default function EditCandidate({ onBack, onSave, candidateId, onNavigate }: EditCandidateProps) {
  // Estados para los campos del formulario
  const [nombre, setNombre] = useState('Juan');
  const [apellidos, setApellidos] = useState('Díaz');
  const [correo, setCorreo] = useState('jdiaz@email.com');
  const [puesto, setPuesto] = useState('Desarrollador Frontend');
  const [experiencia, setExperiencia] = useState('3');
  const [habilidades, setHabilidades] = useState('JavaScript, React, HTML, CSS, Tailwind');
  const [evento, setEvento] = useState('EVT-2023-089: Evaluación Frontend (15/11/2023)');
  const [estado, setEstado] = useState('Activo');
  const [notas, setNotas] = useState('Candidato con experiencia en proyectos de e-commerce');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Manejar el guardado del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave && onSave({
      nombre,
      apellidos,
      correo,
      puesto,
      experiencia,
      habilidades: habilidades.split(',').map(h => h.trim()),
      evento,
      estado,
      notas
    });
    onBack && onBack();
  };

  // Manejar el clic en el botón de eliminar
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  // Confirmar eliminación
  const handleConfirmDelete = () => {
    console.log(`Eliminando candidato con ID: ${candidateId}`);
    setShowDeleteModal(false);
    onBack && onBack();
  };

  // Cancelar eliminación
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
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
              <h1 className="text-2xl font-bold text-gray-900">Editar Candidato</h1>
              <p className="text-gray-600 mt-1">Actualiza la información del candidato</p>
            </div>
            <div className="flex items-center">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                Activo
              </span>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="mb-8 flex items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 text-xl font-medium mr-4">
              JD
            </div>
            <div>
              <h2 className="text-xl font-bold">Juan Díaz</h2>
              <p className="text-gray-500 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M3 4a2 2 0 00-2 2v1.161l8.441 4.221a1.25 1.25 0 001.118 0L19 7.162V6a2 2 0 00-2-2H3z" />
                  <path d="M19 8.839l-7.77 3.885a2.75 2.75 0 01-2.46 0L1 8.839V14a2 2 0 002 2h14a2 2 0 002-2V8.839z" />
                </svg>
                jdiaz@email.com
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 mr-1">
                  <path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 002 3.5V15a1.5 1.5 0 001.5 1.5h3.25a.75.75 0 000-1.5H3.5V3.5h9v3.75a.75.75 0 001.5 0V3.5A1.5 1.5 0 0012.5 2h-9z" clipRule="evenodd" />
                  <path d="M13.22 3.22a.75.75 0 011.06 0l5.5 5.5a.75.75 0 010 1.06l-5.5 5.5a.75.75 0 01-1.06-1.06L18.69 9.5l-5.47-5.22a.75.75 0 010-1.06z" />
                </svg>
                Desarrollador Frontend
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-yellow-100 text-yellow-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 mr-1">
                  <path d="M5.25 12a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM6.25 4.25a.75.75 0 00-.75.75v3.5c0 .414.336.75.75.75h3.5a.75.75 0 00.75-.75V5a.75.75 0 00-.75-.75h-3.5zM5.5 15.25a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM14.25 4.25a.75.75 0 00-.75.75v3.5c0 .414.336.75.75.75h3.5a.75.75 0 00.75-.75V5a.75.75 0 00-.75-.75h-3.5z" />
                </svg>
                EVT-2023-089
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
                  <h2 className="text-lg font-medium mb-4">Información Personal</h2>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Se usará para comunicaciones</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <h2 className="text-lg font-medium mb-4">Historial de cambios</h2>
                  <div className="space-y-6">
                    <div className="relative pl-8 pb-6 border-l border-gray-200">
                      <div className="absolute left-0 top-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm -translate-x-1.5"></div>
                      <div className="mb-1">
                        <span className="text-sm font-medium">Actualización de estado</span>
                      </div>
                      <p className="text-sm text-gray-600">Cambio de "Pendiente" a "Activo"</p>
                      <p className="text-xs text-gray-500 mt-1">Por: Ana Martínez - 10/11/2023 14:32</p>
                    </div>
                    <div className="relative pl-8 pb-6 border-l border-gray-200">
                      <div className="absolute left-0 top-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm -translate-x-1.5"></div>
                      <div className="mb-1">
                        <span className="text-sm font-medium">Asignación a evento</span>
                      </div>
                      <p className="text-sm text-gray-600">Asignado a "EVT-2023-089: Evaluación Técnica - Desarrolladores Frontend"</p>
                      <p className="text-xs text-gray-500 mt-1">Por: Carlos López - 08/11/2023 09:15</p>
                    </div>
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1 w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-sm -translate-x-1.5"></div>
                      <div className="mb-1">
                        <span className="text-sm font-medium">Registro inicial</span>
                      </div>
                      <p className="text-sm text-gray-600">Candidato registrado en el sistema</p>
                      <p className="text-xs text-gray-500 mt-1">Por: Carlos López - 05/11/2023 11:23</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
                  <h2 className="text-lg font-medium mb-4">Información Profesional</h2>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                            <polyline points="6 9 12 15 18 9" />
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="JavaScript, React, HTML, CSS, Tailwind"
                      />
                      <p className="text-xs text-gray-500 mt-1">Separadas por comas</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
                  <h2 className="text-lg font-medium mb-4">Asignación de Evento</h2>
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none"
                        >
                          <option value="EVT-2023-089: Evaluación Frontend (15/11/2023)">EVT-2023-089: Evaluación Frontend (15/11/2023)</option>
                          <option value="EVT-2023-090: Evaluación Backend (20/11/2023)">EVT-2023-090: Evaluación Backend (20/11/2023)</option>
                          <option value="EVT-2023-091: Evaluación UX/UI (25/11/2023)">EVT-2023-091: Evaluación UX/UI (25/11/2023)</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="estado" className="block text-sm font-medium text-gray-700 mb-1">
                        Estado
                      </label>
                      <div className="relative">
                        <select
                          id="estado"
                          value={estado}
                          onChange={(e) => setEstado(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none"
                        >
                          <option value="Activo">Activo</option>
                          <option value="Pendiente">Pendiente</option>
                          <option value="Inactivo">Inactivo</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
                            <polyline points="6 9 12 15 18 9" />
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
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="Añadir notas relevantes sobre el candidato..."
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={handleDeleteClick}
                className="flex items-center text-red-600 hover:text-red-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M3 6h18"></path>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                </svg>
                Eliminar candidato
              </button>
              <div className="flex gap-3">
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
            </div>
          </form>
        </div>
      </div>

      {/* Modal de confirmación para eliminar candidato */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Eliminar candidato"
        message="¿Estás seguro de que deseas eliminar este candidato? Esta acción no se puede deshacer y eliminará todos los datos asociados."
        confirmButtonText="Eliminar"
        cancelButtonText="Cancelar"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDestructive={true}
      />
    </div>
  );
}
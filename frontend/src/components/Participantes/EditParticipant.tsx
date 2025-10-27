import { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import participantService from '../../services/participantService';

interface EditParticipantProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  participantId: string | null;
}

export default function EditParticipant({ isOpen, onClose, onSuccess, participantId }: EditParticipantProps) {
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [correo, setCorreo] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos del participante cuando se abre el modal
  useEffect(() => {
    const loadParticipant = async () => {
      if (!isOpen || !participantId) return;

      try {
        setLoading(true);
        setError(null);
        const participantData = await participantService.getParticipantDetails(participantId);

        setNombre(participantData.first_name || '');
        setApellidos(participantData.last_name || '');
        setCorreo(participantData.email || '');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el participante');
        console.error('Error al cargar participante:', err);
      } finally {
        setLoading(false);
      }
    };

    loadParticipant();
  }, [isOpen, participantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId) return;

    try {
      setSubmitting(true);
      setError(null);

      const updatedData = {
        first_name: nombre,
        last_name: apellidos,
        email: correo
      };

      await participantService.updateParticipant(participantId, updatedData);

      // Limpiar formulario
      setNombre('');
      setApellidos('');
      setCorreo('');

      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el participante');
      console.error('Error al actualizar participante:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting && !loading) {
      setNombre('');
      setApellidos('');
      setCorreo('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Editar Participante</h2>
          <button
            onClick={handleClose}
            disabled={submitting || loading}
            className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-600">Cargando datos...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="correo" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="correo"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {submitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Guardar'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
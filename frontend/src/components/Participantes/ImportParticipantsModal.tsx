import { useState } from 'react';
import { X, Loader, Upload, FileDown, AlertCircle, CheckCircle } from 'lucide-react';
import participantService, { type ImportRow } from '../../services/participantService';

interface ImportParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ImportParticipantsModal({ isOpen, onClose, onSuccess }: ImportParticipantsModalProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorRows, setErrorRows] = useState<ImportRow[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<{
    created?: number;
    updated?: number;
    deleted?: number;
    total_processed?: number;
  } | null>(null);

  const resetState = () => {
    setUploading(false);
    setError(null);
    setFileName(null);
    setErrorRows([]);
    setSuccessMessage(null);
    setImportStats(null);
  };

  const handleClose = () => {
    if (uploading) return;
    resetState();
    onClose();
  };

  const handleExport = async () => {
    try {
      console.log('Exportando participantes...');
      const blob = await participantService.exportParticipants();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = 'participantes.xlsx';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('No se pudo exportar los datos.');
      console.error(e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccessMessage(null);
    setErrorRows([]);
    setImportStats(null);
    setUploading(true);
    setFileName(file.name);

    try {
      const result = await participantService.importParticipants(
        file
      );

      if (result.success) {
        // Importación exitosa
        setSuccessMessage(result.message || 'Importación completada exitosamente');
        setImportStats({
          created: result.created,
          updated: result.updated,
          deleted: result.deleted,
          total_processed: result.total_processed,
        });
        setErrorRows([]);

        // Notificar éxito inmediatamente para refrescar la lista
        onSuccess && onSuccess();
      } else {
        // Hay errores - mostrar solo las filas con error
        setError(result.message || 'Se encontraron errores en el archivo');
        setErrorRows(result.rows || []);
        setSuccessMessage(null);
        setImportStats(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
      setErrorRows([]);
      setSuccessMessage(null);
      setImportStats(null);
    } finally {
      setUploading(false);
      // Resetear el input file para permitir subir el mismo archivo otra vez
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            Importar/Exportar Participantes
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={uploading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
              disabled={uploading}
            >
              <FileDown className="w-4 h-4" />
              Exportar datos
            </button>

            <label className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              <Upload className="w-4 h-4" />
              Seleccionar Excel (.xlsx)
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>

            {fileName && !successMessage && !errorRows.length && (
              <span className="text-sm text-gray-500">
                Archivo: <span className="font-medium">{fileName}</span>
              </span>
            )}
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-gray-600 p-3 bg-gray-50 rounded-md">
              <Loader className="w-4 h-4 animate-spin" />
              Procesando archivo...
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">{successMessage}</p>
                  {importStats && (
                    <div className="mt-2 text-sm text-green-700 space-y-1">
                      <p>• Creados: <strong>{importStats.created || 0}</strong></p>
                      <p>• Actualizados: <strong>{importStats.updated || 0}</strong></p>
                      <p>• Eliminados: <strong>{importStats.deleted || 0}</strong></p>
                      <p>• Total procesados: <strong>{importStats.total_processed || 0}</strong></p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && errorRows.length > 0 && (
            <div className="space-y-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    Se encontraron <strong>{errorRows.length}</strong> {errorRows.length === 1 ? 'fila' : 'filas'} con errores.
                    Corrija el archivo Excel y vuelva a importar.
                  </p>
                </div>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Fila</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Nombre</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Apellidos</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Errores</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {errorRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{row.row_number}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{row.id || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{row.first_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{row.last_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{row.email}</td>
                          <td className="px-4 py-2 text-sm">
                            <ul className="text-red-700 list-disc ml-4 space-y-0.5">
                              {row.errors?.map((err, errIdx) => (
                                <li key={errIdx}>{err}</li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {error && errorRows.length === 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700" dangerouslySetInnerHTML={{ __html: error }} />
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

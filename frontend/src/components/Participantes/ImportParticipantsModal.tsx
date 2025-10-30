import { useState } from 'react';
import { X, Loader, Upload, FileDown } from 'lucide-react';
import participantService, { type ImportRow } from '../../services/participantService';

interface ImportParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ImportParticipantsModal({ isOpen, onClose, onSuccess }: ImportParticipantsModalProps) {
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const [rows, setRows] = useState<ImportRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);

  const hasPreview = rows.length > 0;

  const resetState = () => {
    setUploading(false);
    setCommitting(false);
    setError(null);
    setFileName(null);
    setRows([]);
    setValidCount(0);
    setInvalidCount(0);
  };

  const handleClose = () => {
    if (uploading || committing) return;
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await participantService.downloadParticipantsTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_participantes.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('No se pudo descargar la plantilla.');
      console.error(e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setFileName(file.name);
    try {
      const preview = await participantService.previewImportParticipants(file);
      setRows(preview.rows || []);
      setValidCount(preview.valid_count || 0);
      setInvalidCount(preview.invalid_count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
      setRows([]);
      setValidCount(0);
      setInvalidCount(0);
    } finally {
      setUploading(false);
    }
  };

  const updateRowField = (index: number, field: keyof Pick<ImportRow, 'first_name' | 'last_name' | 'email'>, value: string) => {
    setRows(prev => {
      const out = [...prev];
      const r = { ...out[index] };
      (r as any)[field] = value;
      // Al editar, limpiamos errores locales; el backend validará al enviar
      r.errors = [];
      out[index] = r;
      return out;
    });
  };

  const handleCommit = async () => {
    if (rows.length === 0) return;
    setCommitting(true);
    setError(null);
    try {
      // Enviar todas las filas; el backend validará y creará sólo las válidas
      const payload = rows.map(({ first_name, last_name, email }) => ({ first_name, last_name, email }));
      const res = await participantService.commitImportParticipants(payload);

      if (res.failed > 0) {
        // Mantener en la tabla SOLO las filas con errores; las correctas desaparecen
        const failedOnly: ImportRow[] = (res.rows || [])
          .filter((r: any) => Array.isArray(r.errors) && r.errors.length > 0)
          .map((r: any) => ({
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            errors: r.errors || [],
          }));

        setRows(failedOnly);
        setValidCount(0);
        setInvalidCount(failedOnly.length);
        setError('Se importaron algunas filas. Corrige las restantes y vuelve a enviar.');
        return;
      }

      // Éxito total
      onSuccess && onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar participantes');
    } finally {
      setCommitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Cargar participantes</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition" disabled={uploading || committing}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
            >
              <FileDown className="w-4 h-4" />
              Descargar plantilla
            </button>

            <label className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm cursor-pointer">
              <Upload className="w-4 h-4" />
              Seleccionar Excel (.xlsx)
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleFileChange} />
            </label>

            {fileName && (
              <span className="text-sm text-gray-500">Archivo seleccionado: <span className="font-medium">{fileName}</span></span>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
          )}

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader className="w-4 h-4 animate-spin" /> Procesando archivo...
            </div>
          )}

          {hasPreview && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  Válidas: <span className="font-medium text-green-700">{validCount}</span> · Con errores: <span className="font-medium text-red-700">{invalidCount}</span>
                </p>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={committing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {committing ? (<><Loader className="w-4 h-4 animate-spin" /> Enviando...</>) : 'Enviar cambios'}
                </button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Nombre</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Apellidos</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Errores</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input value={r.first_name || ''} onChange={(e) => updateRowField(i, 'first_name', e.target.value)} className="w-full px-2 py-1 border rounded" />
                          </td>
                          <td className="px-4 py-2">
                            <input value={r.last_name || ''} onChange={(e) => updateRowField(i, 'last_name', e.target.value)} className="w-full px-2 py-1 border rounded" />
                          </td>
                          <td className="px-4 py-2">
                            <input value={r.email || ''} onChange={(e) => updateRowField(i, 'email', e.target.value)} className="w-full px-2 py-1 border rounded" />
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {r.errors && r.errors.length > 0 ? (
                              <ul className="text-red-700 list-disc ml-4">
                                {r.errors.map((e, idx) => (
                                  <li key={idx}>{e}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-green-700">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading || committing}
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

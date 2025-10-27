import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, Globe } from 'lucide-react';
import blockedPagesService, { type BlockedPage } from '../../services/blockedPagesService';

interface BlockedPagesModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedWebsites?: string[];
    onSave?: (selectedIds: string[]) => void;
}

export default function BlockedPagesModal({
    isOpen,
    onClose,
    selectedWebsites = [],
    onSave
}: BlockedPagesModalProps) {
    const [websites, setWebsites] = useState<BlockedPage[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedWebsites));
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newHostname, setNewHostname] = useState('');
    const [editHostname, setEditHostname] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [search, setSearch] = useState('');

    // Limpiar mensajes de éxito/error al abrir modal o cambiar selectedWebsites
    useEffect(() => {
        if (isOpen) {
            fetchWebsites();
            setSelectedIds(new Set(selectedWebsites));
            setErrorMessage('');
            setSuccessMessage('');
        }
    }, [isOpen, selectedWebsites]);

    // Limpiar mensaje de éxito después de 2 segundos
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(''), 2000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const fetchWebsites = async () => {
        setIsLoading(true);
        try {
            const data = await blockedPagesService.getWebsites();
            setWebsites(data);
        } catch (error) {
            console.error('Error al cargar sitios web:', error);
            setErrorMessage('Error al cargar los sitios web');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newHostname.trim()) {
            setErrorMessage('El nombre del sitio no puede estar vacío');
            setSuccessMessage('');
            return;
        }

        try {
            const created = await blockedPagesService.createWebsite(newHostname.trim());
            setWebsites([...websites, created]);
            setNewHostname('');
            setIsCreating(false);
            setErrorMessage('');
            setSuccessMessage('Sitio web creado exitosamente');
        } catch (error: any) {
            setErrorMessage(error.message || 'Error al crear el sitio web');
            setSuccessMessage('');
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editHostname.trim()) {
            setErrorMessage('El nombre del sitio no puede estar vacío');
            setSuccessMessage('');
            return;
        }

        try {
            const updated = await blockedPagesService.updateWebsite(id, editHostname.trim());
            setWebsites(websites.map(w => w.id === id ? updated : w));
            setEditingId(null);
            setEditHostname('');
            setErrorMessage('');
            setSuccessMessage('Sitio web actualizado exitosamente');
        } catch (error: any) {
            setErrorMessage(error.message || 'Error al actualizar el sitio web');
            setSuccessMessage('');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar este sitio web?')) return;

        try {
            await blockedPagesService.deleteWebsite(id);
            setWebsites(websites.filter(w => w.id !== id));
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
            setErrorMessage('');
        } catch (error: any) {
            setErrorMessage(error.message || 'Error al eliminar el sitio web');
        }
    };

    const toggleSelection = (id: string) => {
        setErrorMessage('');
        setSuccessMessage('');
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSave = () => {
        setErrorMessage('');
        setSuccessMessage('');
        if (onSave) {
            onSave(Array.from(selectedIds));
        }
        onClose();
    };

    // Filtrar sitios web por búsqueda
    const filteredWebsites = search.trim()
        ? websites.filter(w => w.hostname.toLowerCase().includes(search.trim().toLowerCase()))
        : websites;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            {/* Floating Toast Notification */}
            {(errorMessage || successMessage) && (
                <div className={`fixed top-4 right-4 z-60 p-4 rounded-lg shadow-lg border max-w-sm animate-in slide-in-from-right duration-300
                    ${errorMessage ? 'bg-red-50 border-red-200 text-red-700' : ''}
                    ${successMessage ? 'bg-green-50 border-green-200 text-green-700' : ''}
                `}>
                    <div className="flex items-center gap-2">
                        {successMessage && <Check className="w-5 h-5 text-green-600" />}
                        {errorMessage && <X className="w-5 h-5 text-red-600" />}
                        <p className="font-medium text-sm">
                            {errorMessage || successMessage}
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Globe className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Páginas Bloqueadas</h2>
                            <p className="text-sm text-gray-600">Gestione los sitios web bloqueados para este evento</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Search bar */}
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar sitio web..."
                        className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    />

                    {/* Add new website */}
                    {!isCreating ? (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="w-full mb-4 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="font-medium">Agregar nuevo sitio web</span>
                        </button>
                    ) : (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <input
                                type="text"
                                value={newHostname}
                                onChange={(e) => setNewHostname(e.target.value)}
                                placeholder="Ej: facebook.com"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm mb-3"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCreate}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm font-medium"
                                >
                                    Crear
                                </button>
                                <button
                                    onClick={() => {
                                        setIsCreating(false);
                                        setNewHostname('');
                                        setErrorMessage('');
                                    }}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition text-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Websites list */}
                    {isLoading ? (
                        <div className="text-center py-8">
                            <p className="text-gray-500">Cargando sitios web...</p>
                        </div>
                    ) : filteredWebsites.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
                            <Globe className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-500">
                                {search.trim()
                                    ? 'No se encontraron sitios web con ese nombre'
                                    : 'No hay sitios web registrados'}
                            </p>
                            {!search.trim() && (
                                <p className="text-sm text-gray-400">Agregue el primer sitio web para comenzar</p>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredWebsites.map((website) => (
                                <div
                                    key={website.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition ${selectedIds.has(website.id)
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    {/* Checkbox */}
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.has(website.id)}
                                        onChange={() => toggleSelection(website.id)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                    />

                                    {/* Website hostname */}
                                    {editingId === website.id ? (
                                        <input
                                            type="text"
                                            value={editHostname}
                                            onChange={(e) => setEditHostname(e.target.value)}
                                            className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                            autoFocus
                                        />
                                    ) : (
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-900">{website.hostname}</p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    {editingId === website.id ? (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => handleUpdate(website.id)}
                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition"
                                                title="Guardar"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingId(null);
                                                    setEditHostname('');
                                                    setErrorMessage('');
                                                }}
                                                className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition"
                                                title="Cancelar"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditingId(website.id);
                                                    setEditHostname(website.hostname);
                                                    setErrorMessage('');
                                                }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(website.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                    <div className="text-sm text-gray-600">
                        <span className="font-medium text-gray-900">{selectedIds.size}</span> sitio(s) seleccionado(s)
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition text-sm font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shadow-sm"
                        >
                            Guardar Selección
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

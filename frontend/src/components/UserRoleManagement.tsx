import { useState, useEffect } from 'react';
import { Loader, Search, Edit, Trash2 } from 'lucide-react';
import Sidebar from './Sidebar';
import authService, { type User as AuthUser } from '../services/authService';
import CreateUser from './CreateUser';
import EditUserModal from './EditUser';
import ConfirmationModal from './ConfirmationModal';

interface User extends AuthUser {
    role: string;
    roleName?: string;
}
import { useAuth } from '../contexts/AuthContext';

interface UserRoleManagementProps {
    onNavigate?: (page: string) => void;
    onLogout?: () => void;
}

export default function UserRoleManagement({ onNavigate, onLogout }: UserRoleManagementProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { user: currentUser } = useAuth();
    const [showCreateUser, setShowCreateUser] = useState(false);
    const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const ROLE_OPTIONS = [
        { value: 'superadmin', label: 'Super Administrador' },
        { value: 'admin', label: 'Administrador' },
        { value: 'evaluator', label: 'Evaluador' },
    ];

    // Refrescar usuarios después de crear uno nuevo
    const refreshUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const usersData = await authService.getUsersWithRoles();
            setUsers(usersData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleEditUser = async (
        userId: number,
        data: { firstName: string; lastName: string; email: string; role: string; password?: string; }
    ) => {
        try {
            // Editar datos básicos
            const updatedUser = await authService.editUser(userId, {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                password: data.password
            });
            // Editar rol si cambió
            await authService.assignRole(userId, data.role);

            setUsers(users.map(u =>
                u.id === userId
                    ? { ...u, ...updatedUser, role: data.role, roleName: ROLE_OPTIONS.find(r => r.value === data.role)?.label }
                    : u
            ));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al editar usuario');
        }
    };

    // Eliminar usuario
    const handleDeleteUser = async (userId: number) => {
        setDeletingUserId(userId);
        setError(null);
        try {
            await authService.deleteUser(userId);
            setUsers(users.filter(u => u.id !== userId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
        } finally {
            setDeletingUserId(null);
        }
    };

    // Cargar usuarios al montar el componente
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setLoading(true);
                setError(null);
                const usersData = await authService.getUsersWithRoles();
                setUsers(usersData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
                console.error('Error loading users:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // Filtrar usuarios según el término de búsqueda
    const filteredUsers = users.filter(user => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const searchLower = searchTerm.toLowerCase();

        return fullName.includes(searchLower) ||
            user.email.toLowerCase().includes(searchLower) ||
            (user.roleName || '').toLowerCase().includes(searchLower);
    });


    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar currentPage="roles" onNavigate={onNavigate} onLogout={onLogout} />

            <div className="flex-1 overflow-y-auto">
                <div className="bg-white border-b border-gray-200 px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Gestión de Roles</h1>
                            <p className="text-gray-600 mt-1">Asigne roles a los usuarios del sistema</p>
                        </div>
                        <button
                            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
                            onClick={() => setShowCreateUser(true)}
                        >
                            + Crear usuario
                        </button>
                    </div>
                </div>

                {showCreateUser && (
                    <CreateUser
                        onClose={() => setShowCreateUser(false)}
                        onUserCreated={refreshUsers}
                    />
                )}

                <div className="p-8">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-medium text-gray-900">Usuarios</h2>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Buscar usuarios..."
                                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm w-64"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 m-6 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-red-700">{error}</p>
                                <button
                                    onClick={() => setError(null)}
                                    className="text-sm text-red-700 font-medium underline mt-2"
                                >
                                    Cerrar
                                </button>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex justify-center items-center p-12">
                                <Loader className="w-6 h-6 text-blue-600 animate-spin mr-2" />
                                <p>Cargando usuarios...</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Usuario
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Rol Actual
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                                                    {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredUsers.map((user) => (
                                                <tr key={user.id} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-medium">
                                                                {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`}
                                                            </div>
                                                            <div className="ml-4">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {`${user.firstName} ${user.lastName}`}
                                                                </div>
                                                                {user.id === currentUser?.id && (
                                                                    <span className="text-xs text-blue-600">(Tú)</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{user.email}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${user.role === 'admin'
                                                            ? 'bg-purple-100 text-purple-800'
                                                            : user.role === 'evaluator'
                                                                ? 'bg-green-100 text-green-800'
                                                                : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {user.roleName || 'Sin rol'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {/* Solo mostrar botones si NO es superadmin */}
                                                            {user.role !== 'superadmin' && (
                                                                <>
                                                                    {/* Botón Editar */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setEditingUser(user);
                                                                        }}
                                                                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </button>

                                                                    {/* Botón Borrar */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            setUserToDelete(user);
                                                                            setShowDeleteModal(true);
                                                                        }}
                                                                        disabled={deletingUserId === user.id}
                                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        {deletingUserId === user.id ? (
                                                                            <Loader className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Trash2 className="w-4 h-4" />
                                                                        )}
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {editingUser && (
                                                        <EditUserModal
                                                            user={editingUser}
                                                            onClose={() => setEditingUser(null)}
                                                            onSave={handleEditUser}
                                                        />
                                                    )}
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <ConfirmationModal
                isOpen={showDeleteModal}
                title="Eliminar usuario"
                message="¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer."
                confirmButtonText="Eliminar"
                cancelButtonText="Cancelar"
                onConfirm={async () => {
                    if (userToDelete) {
                        await handleDeleteUser(userToDelete.id);
                        setShowDeleteModal(false);
                        setUserToDelete(null);
                    }
                }}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                }}
                isDestructive={true}
            />
        </div>
    );
}

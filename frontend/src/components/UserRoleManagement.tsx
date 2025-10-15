import { useState, useEffect } from 'react';
import { Loader, Search, Check, X } from 'lucide-react';
import Sidebar from './Sidebar';
import { authService, User as AuthUser } from '../services/authService';

interface User extends AuthUser {
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
    const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);
    const { user: currentUser } = useAuth();

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

    const handleRoleChange = async (userId: number, role: string) => {
        try {
            setUpdatingUserId(userId);
            await authService.assignRole(userId, role);

            // Actualizar la lista de usuarios con el nuevo rol
            setUsers(users.map(user => {
                if (user.id === userId) {
                    return {
                        ...user,
                        role: role,
                        roleName: role === 'admin' ? 'Administrador' : 'Evaluador'
                    };
                }
                return user;
            }));

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al actualizar rol');
        } finally {
            setUpdatingUserId(null);
        }
    };

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
                    </div>
                </div>

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
                                                        {updatingUserId === user.id ? (
                                                            <span className="text-gray-500">
                                                                <Loader className="w-4 h-4 animate-spin inline mr-2" />
                                                                Actualizando...
                                                            </span>
                                                        ) : (
                                                            <div className="flex space-x-2">
                                                                <button
                                                                    onClick={() => handleRoleChange(user.id, 'superadmin')}
                                                                    disabled={user.role === 'superadmin'}
                                                                    className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'superadmin'
                                                                        ? 'bg-red-100 text-red-800 cursor-default'
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-800'
                                                                        }`}
                                                                >
                                                                    {user.role === 'superadmin' ? (
                                                                        <Check className="w-3 h-3 inline mr-1" />
                                                                    ) : null}
                                                                    Super Admin
                                                                </button>

                                                                <button
                                                                    onClick={() => handleRoleChange(user.id, 'admin')}
                                                                    disabled={user.role === 'admin'}
                                                                    className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin'
                                                                        ? 'bg-purple-100 text-purple-800 cursor-default'
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-purple-100 hover:text-purple-800'
                                                                        }`}
                                                                >
                                                                    {user.role === 'admin' ? (
                                                                        <Check className="w-3 h-3 inline mr-1" />
                                                                    ) : null}
                                                                    Administrador
                                                                </button>

                                                                <button
                                                                    onClick={() => handleRoleChange(user.id, 'evaluator')}
                                                                    disabled={user.role === 'evaluator'}
                                                                    className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'evaluator'
                                                                        ? 'bg-green-100 text-green-800 cursor-default'
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-800'
                                                                        }`}
                                                                >
                                                                    {user.role === 'evaluator' ? (
                                                                        <Check className="w-3 h-3 inline mr-1" />
                                                                    ) : null}
                                                                    Evaluador
                                                                </button>

                                                                {user.role && (
                                                                    <button
                                                                        onClick={() => handleRoleChange(user.id, '')}
                                                                        className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium hover:bg-red-100"
                                                                    >
                                                                        <X className="w-3 h-3 inline mr-1" />
                                                                        Quitar rol
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
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
        </div>
    );
}

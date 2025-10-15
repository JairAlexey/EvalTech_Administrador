import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function WaitingForRole() {
    const { user, logout } = useAuth();
    const [refreshing, setRefreshing] = useState(false);

    const handleRefresh = () => {
        setRefreshing(true);
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center">
                    <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500" />
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Esperando asignación de rol
                    </h2>
                </div>

                <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <div className="text-center">
                        <p className="text-gray-700 mb-6">
                            Hola <strong>{user?.firstName} {user?.lastName}</strong>,
                        </p>
                        <p className="text-gray-700 mb-6">
                            Tu cuenta ha sido creada correctamente, pero aún no tienes un rol asignado.
                            Un administrador debe asignarte un rol para que puedas acceder al sistema.
                        </p>
                        <p className="text-gray-700 mb-6">
                            Por favor, contacta con un administrador o espera a que te asignen un rol.
                        </p>

                        <div className="mt-8 space-y-3">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {refreshing ? 'Comprobando...' : 'Comprobar estado'}
                            </button>

                            <button
                                onClick={() => logout()}
                                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useState } from 'react';
import { Activity, Settings, FileText, Shield, UserPlus } from 'lucide-react';
import { authService } from '../services/authService';

interface RegisterProps {
    onRegister: () => void;
    onBackToLogin: () => void;
}

export default function Register({ onRegister, onBackToLogin }: RegisterProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validaciones
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setIsLoading(true);

        try {
            await authService.register({
                email,
                password,
                firstName,
                lastName
            });
            onRegister(); // Redirigir al dashboard después del registro exitoso
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error al registrar usuario');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden flex">
                <div className="w-2/5 bg-gradient-to-br from-blue-500 to-blue-700 text-white p-8 flex flex-col">
                    <div className="mb-12">
                        <h1 className="text-3xl font-bold mb-2">EvalTech</h1>
                        <p className="text-blue-100 text-sm">Sistema de Gestión de Evaluaciones Técnicas</p>
                    </div>

                    <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-6">Panel Administrativo</h2>

                        <div className="space-y-6">
                            <div className="flex items-start gap-3">
                                <div className="mt-1">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Análisis en tiempo real</h3>
                                    <p className="text-blue-100 text-sm">Monitoreo de evaluaciones en curso y resultados</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-1">
                                    <Settings className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Gestión de candidatos</h3>
                                    <p className="text-blue-100 text-sm">Administración completa del proceso de evaluación</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="mt-1">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-1">Reportes avanzados</h3>
                                    <p className="text-blue-100 text-sm">Generación de informes detallados y estadísticas</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-8 text-sm text-blue-100">
                        © 2025 EvalTech. Todos los derechos reservados.
                    </div>
                </div>

                <div className="w-3/5 p-12 flex flex-col justify-center">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Crear una cuenta</h2>
                            <p className="text-gray-600">Regístrese para acceder al panel administrativo</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombre
                                    </label>
                                    <input
                                        type="text"
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="John"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                                        Apellido
                                    </label>
                                    <input
                                        type="text"
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Doe"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Correo electrónico
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="usuario@evaltech.com"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    required
                                    minLength={6}
                                />
                                <p className="mt-1 text-xs text-gray-500">La contraseña debe tener al menos 6 caracteres</p>
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                                    Confirmar contraseña
                                </label>
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition shadow-md flex items-center justify-center ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isLoading ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Registrando...
                                    </span>
                                ) : (
                                    <span className="flex items-center">
                                        <UserPlus className="mr-2 h-5 w-5" />
                                        Crear cuenta
                                    </span>
                                )}
                            </button>

                            <div className="flex items-center justify-center mt-6">
                                <p className="text-sm text-gray-600">
                                    ¿Ya tiene una cuenta?{' '}
                                    <button
                                        type="button"
                                        onClick={onBackToLogin}
                                        className="text-blue-600 hover:text-blue-700 font-medium focus:outline-none"
                                    >
                                        Iniciar sesión
                                    </button>
                                </p>
                            </div>

                            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex-shrink-0">
                                    <Shield className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Registro seguro</p>
                                    <p className="text-xs text-gray-600">Sus datos están protegidos con estándares de seguridad</p>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
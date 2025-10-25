import { useState, useEffect } from 'react';
import { Activity, Settings, FileText } from 'lucide-react';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
  error?: string | null;
  onGoHome?: () => void;
}

export default function Login({ onLogin, error: externalError, onGoHome }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setError(externalError || null);
  }, [externalError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onLogin(email, password);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error al iniciar sesión');
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
                  <h3 className="font-semibold mb-1">Gestión de participantes</h3>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Bienvenido de nuevo</h2>
              <p className="text-gray-600">Acceda al panel administrativo para gestionar evaluaciones técnicas</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@evaltech.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Contraseña
                  </label>
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 mb-4">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition shadow-md ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>

              {/* Texto minimalista para volver al inicio */}
              <div className="mt-4 text-center">
                <span
                  className="text-blue-600 hover:underline cursor-pointer text-sm"
                  onClick={onGoHome}
                >
                  Volver al inicio
                </span>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

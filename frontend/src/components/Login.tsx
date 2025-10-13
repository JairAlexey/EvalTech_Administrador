import { useState } from 'react';
import { Activity, Settings, FileText, Shield } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
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
            © 2023 EvalTech. Todos los derechos reservados.
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
                  <a href="#" className="text-sm text-blue-600 hover:text-blue-700">
                    ¿Olvidó su contraseña?
                  </a>
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

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
                  Mantener sesión iniciada
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition shadow-md"
              >
                Iniciar Sesión
              </button>

              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex-shrink-0">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Acceso seguro</p>
                  <p className="text-xs text-gray-600">Autenticación de doble factor disponible</p>
                </div>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Activar
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

import { LogOut, LayoutDashboard, Calendar, Users, FileText, User, UserCog } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

// Todas las páginas posibles
const ALL_PAGES = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'GENERAL', roles: ['admin', 'superadmin', 'evaluator'] },
  { id: 'eventos', icon: Calendar, label: 'Eventos', section: 'GENERAL', roles: ['admin', 'superadmin', 'evaluator'] },
  { id: 'participants', icon: Users, label: 'Participantes', section: 'GENERAL', roles: ['admin', 'superadmin'] },
  { id: 'evaluaciones', icon: FileText, label: 'Evaluaciones', section: 'RESULTADOS', roles: ['superadmin', 'evaluator'] },
  { id: 'roles', icon: UserCog, label: 'Roles', section: 'CONFIGURACIÓN', roles: ['superadmin'] },
  { id: 'cuenta', icon: User, label: 'Mi cuenta', section: 'CONFIGURACIÓN', roles: ['admin', 'superadmin', 'evaluator'] },
];

export default function Sidebar({ onNavigate, onLogout, currentPage }: SidebarProps) {
  const { user } = useAuth();
  const role = user?.role ?? '';

  // Filtra las páginas según el rol
  const menuItems = ALL_PAGES.filter(page => role && page.roles.includes(role));
  const sections = [...new Set(menuItems.map(item => item.section))];

  return (
    <div className="w-52 bg-slate-800 text-white h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">EvalTech</h1>
        <p className="text-xs text-slate-400 mt-1">Panel Administrativo</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {sections.map((section) => (
          <div key={section} className="mb-6">
            <div className="px-6 mb-2">
              <p className="text-xs font-semibold text-slate-500 tracking-wider">{section}</p>
            </div>
            {menuItems
              .filter((item) => item.section === section)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate && onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-6 py-2.5 ${currentPage === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                    } transition-colors`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </button>
              ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-slate-300 hover:bg-slate-700 rounded-md transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}
import { LogOut, LayoutDashboard, Calendar, Users, FileText, BarChart3, FileDown, User, UserCog } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

export default function Sidebar({ onNavigate, onLogout, currentPage }: SidebarProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isEvaluator = user?.role === 'evaluator';

  // Define menu items based on role
  const getMenuItems = () => {
    // Base items common for all roles
    const baseItems = [];

    // Add dashboard for admins and evaluators
    if (isEvaluator || isSuperAdmin) {
      baseItems.push({ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'GENERAL' });
    }

    // Admins can manage events and participants
    if (isAdmin) {
      baseItems.push(
        { id: 'eventos', icon: Calendar, label: 'Eventos', section: 'GENERAL' },
        { id: 'participants', icon: Users, label: 'Participantes', section: 'GENERAL' }
      );
    }

    // Evaluators can see evaluations
    if (isEvaluator || isSuperAdmin) {
      baseItems.push({ id: 'evaluaciones', icon: FileText, label: 'Evaluaciones', section: 'GENERAL' });
    }

    // Report items - only for admins
    const reportItems = isAdmin
      ? [
        { id: 'estadisticas', icon: BarChart3, label: 'Estadísticas', section: 'REPORTES' },
        { id: 'exportar', icon: FileDown, label: 'Exportar datos', section: 'REPORTES' },
      ]
      : [];

    // Config items for all users
    const configItems = [
      { id: 'cuenta', icon: User, label: 'Mi cuenta', section: 'CONFIGURACIÓN' },
    ];

    // Only superadmin can manage roles
    if (isSuperAdmin) {
      configItems.unshift({ id: 'roles', icon: UserCog, label: 'Roles', section: 'CONFIGURACIÓN' });
    }

    return [...baseItems, ...reportItems, ...configItems];
  };

  const menuItems = getMenuItems();
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

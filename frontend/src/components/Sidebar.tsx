import { LayoutDashboard, Calendar, Users, FileText, BarChart3, FileDown, Settings, User, LogOut } from 'lucide-react';

interface SidebarProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
  currentPage?: string;
}

export default function Sidebar({ onNavigate, onLogout, currentPage }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'GENERAL' },
    { id: 'eventos', icon: Calendar, label: 'Eventos', section: 'GENERAL' },
    { id: 'candidatos', icon: Users, label: 'Candidatos', section: 'GENERAL' },
    { id: 'evaluaciones', icon: FileText, label: 'Evaluaciones', section: 'GENERAL' },
    { id: 'estadisticas', icon: BarChart3, label: 'Estadísticas', section: 'REPORTES' },
    { id: 'exportar', icon: FileDown, label: 'Exportar datos', section: 'REPORTES' },
    { id: 'ajustes', icon: Settings, label: 'Ajustes', section: 'CONFIGURACIÓN' },
    { id: 'cuenta', icon: User, label: 'Mi cuenta', section: 'CONFIGURACIÓN' },
  ];

  const sections = ['GENERAL', 'REPORTES', 'CONFIGURACIÓN'];

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
              .map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate?.(item.id)}
                    className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm transition ${
                      isActive
                        ? 'bg-slate-700 text-white border-l-4 border-blue-500'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-700">
        <button 
          onClick={() => onLogout ? onLogout() : onNavigate?.('home')}
          className="w-full flex items-center gap-3 px-6 py-4 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  );
}

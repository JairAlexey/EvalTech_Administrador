import Sidebar from './Sidebar';

interface AccessDeniedPageProps {
    onNavigate: (page: string) => void;
    onLogout: () => void;
    currentPage: string;
}

function AccessDenied() {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso restringido</h2>
                <p className="text-gray-700">No tienes permisos para ver esta página.</p>
            </div>
        </div>
    );
}

export default function AccessDeniedPage({ onNavigate, onLogout, currentPage }: AccessDeniedPageProps) {
    return (
        <div className="flex min-h-screen">
            <Sidebar onNavigate={onNavigate} onLogout={onLogout} currentPage={currentPage} />
            <div className="flex-1">
                <AccessDenied />
            </div>
        </div>
    );
}
import Sidebar from './Sidebar';

interface NotFoundPageProps {
    onNavigate: (page: string) => void;
    onLogout: () => void;
    currentPage: string;
}

function NotFound() {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-blue-600 mb-4">404 - Página no encontrada</h2>
                <p className="text-gray-700">La página que buscas no existe.</p>
            </div>
        </div>
    );
}

export default function NotFoundPage({ onNavigate, onLogout, currentPage }: NotFoundPageProps) {
    return (
        <div className="flex min-h-screen">
            <Sidebar onNavigate={onNavigate} onLogout={onLogout} currentPage={currentPage} />
            <div className="flex-1">
                <NotFound />
            </div>
        </div>
    );
}
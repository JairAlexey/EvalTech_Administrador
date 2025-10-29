import { useState, useEffect } from 'react';
import Login from './components/Login';
import EventsList from './components/Eventos/EventsList';
import CreateEvent from './components/Eventos/CreateEvent';
import EventDetails from './components/Eventos/EventDetails';
import EditEvent from './components/Eventos/EditEvent';
import Participant from './components/Participantes/ParticipantsList';
import EditParticipant from './components/Participantes/EditParticipant';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import EvaluationsList from './components/Evaluaciones/EvaluationsList';
import EvaluationDetails from './components/Evaluaciones/EvaluationDetails';
import UserRoleManagement from './components/Roles/UserRoleManagement';
import { useAuth } from './contexts/AuthContext';
import CreateParticipant from './components/Participantes/CreateParticipant';
import Profile from './components/Perfil/Profile';
import AccessDeniedPage from './components/utils/AccessDenied';
import NotFoundPage from './components/utils/NotFound';

type Page = 'home' | 'login' | 'dashboard' | 'eventos' | 'create-event' | 'event-details' | 'edit-event' | 'participants' | 'edit-participant' | 'create-participant' | 'evaluaciones' | 'evaluation-details' | 'estadisticas' | 'exportar' | 'cuenta' | 'roles';

function App() {
    // Recuperar el estado guardado de localStorage o usar valores por defecto
    const getInitialPage = (): Page => {
        const savedPage = localStorage.getItem('currentPage');
        return (savedPage as Page) || 'home';
    };

    const getInitialEventId = (): string | null => {
        return localStorage.getItem('selectedEventId');
    };

    const getInitialParticipantId = (): string | null => {
        return localStorage.getItem('selectedParticipantId');
    };

    const [currentPage, setCurrentPage] = useState<Page>(getInitialPage);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(getInitialEventId);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(getInitialParticipantId);
    const [loginError, setLoginError] = useState<string | null>(null);

    const { isAuthenticated, isLoading, logout, user, hasAnyRole, login } = useAuth();
    const isSuperAdmin = user?.role === 'superadmin';
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    const isEvaluator = user?.role === 'evaluator';

    // Navigation handler for sidebar and component navigation
    const handleNavigate = (page: string) => {
        console.log("Navigating to:", page);

        // Secciones principales
        if (['dashboard', 'eventos', 'participants', 'evaluaciones', 'estadisticas', 'roles'].includes(page)) {
            setSelectedEventId(null);
            setSelectedParticipantId(null);
            localStorage.removeItem('selectedEventId');
            localStorage.removeItem('selectedParticipantId');
        }
        setCurrentPage(page as Page);
        localStorage.setItem('currentPage', page);
    };

    // Efecto para sincronizar los IDs seleccionados con localStorage
    useEffect(() => {
        if (selectedEventId) {
            localStorage.setItem('selectedEventId', selectedEventId);
        } else {
            localStorage.removeItem('selectedEventId');
        }
    }, [selectedEventId]);

    useEffect(() => {
        if (selectedParticipantId) {
            localStorage.setItem('selectedParticipantId', selectedParticipantId);
        } else {
            localStorage.removeItem('selectedParticipantId');
        }
    }, [selectedParticipantId]);

    // Efecto para manejar la página después de la autenticación
    useEffect(() => {
        if (!isLoading) {
            const savedPage = localStorage.getItem('currentPage') as Page;

            // Si no está autenticado y está en una página protegida, ir a home
            if (!isAuthenticated && savedPage && !['home', 'login'].includes(savedPage)) {
                handleNavigate('home');
            }

            // Si está autenticado pero no tiene permisos para la página guardada, ir a dashboard
            if (isAuthenticated && savedPage && !hasPermissionForPage(savedPage)) {
                handleNavigate('dashboard');
            }
        }
    }, [isAuthenticated, isLoading]);

    // Permisos para roles
    const hasPermissionForPage = (page: string): boolean => {

        // Paginas evaluadores
        const evaluatorPages = [
            'dashboard',
            'eventos',
            'create-event',
            'event-details',
            'edit-event',
            'evaluaciones',
            'evaluation-details',
            'estadisticas',
            'exportar',
            'cuenta'
        ];

        // Paginas administradores
        const adminPages = [
            'dashboard',
            'eventos',
            'create-event',
            'event-details',
            'edit-event',
            'participants',
            'edit-participant',
            'create-participant',
            'evaluaciones',
            'evaluation-details',
            'estadisticas',
            'exportar',
            'cuenta'
        ];

        // Paginas superadmin
        const superAdminPages = [...adminPages, 'roles'];

        if (!isAuthenticated) {
            return ['home', 'login'].includes(page);
        }

        if (!hasAnyRole()) {
            return false; // Sin rol asignado
        }

        if (isSuperAdmin) {
            return superAdminPages.includes(page);
        }

        if (isAdmin) {
            return adminPages.includes(page);
        }

        if (isEvaluator) {
            return evaluatorPages.includes(page);
        }

        return false;
    };

    // Controladores de eventos
    const handleCreateEvent = () => {
        handleNavigate('create-event');
    };

    const handleViewEventDetails = (eventId: string) => {
        setSelectedEventId(eventId);
        handleNavigate('event-details');
    };

    const handleEditEvent = (eventId: string) => {
        setSelectedEventId(eventId);
        handleNavigate('edit-event');
    };

    // Controladores de evaluaciones
    const handleViewEvaluationDetails = (participantId: string, eventId: string) => {
        setSelectedParticipantId(participantId);
        setSelectedEventId(eventId);
        handleNavigate('evaluation-details');
    };

    // Controladores de regreso
    const handleBackToEvents = () => {
        setSelectedEventId(null);
        handleNavigate('eventos');
    };

    const handleBackToEvaluations = () => {
        setSelectedParticipantId(null);
        setSelectedEventId(null);
        handleNavigate('evaluaciones');
    };

    const handleNavigateToLogin = () => {
        handleNavigate('login');
    };

    const handleLogout = async () => {
        await logout();
        // Limpiar localStorage al cerrar sesión
        localStorage.removeItem('currentPage');
        localStorage.removeItem('selectedEventId');
        localStorage.removeItem('selectedParticipantId');
        handleNavigate('login');
    };

    // Controladores de autenticacion
    const handleLogin = async (email: string, password: string) => {
        try {
            const userInfo = await login(email, password);

            // Verificar usuario
            if (userInfo && userInfo.role) {
                handleNavigate('dashboard');
            }

        } catch (error) {
            setLoginError(error instanceof Error ? error.message : 'Error al iniciar sesión');
        }
    };

    // Debug logs
    useEffect(() => {
        console.log("Current page:", currentPage);
        console.log("User role:", user?.role);
        console.log("Has any role:", hasAnyRole());
    }, [currentPage, user?.role]);

    // Main content renderer
    const renderContent = () => {
        // Show loading screen
        if (isLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Cargando...</p>
                    </div>
                </div>
            );
        }

        // Non-authenticated users can only see home, login
        if (!isAuthenticated && !['home', 'login'].includes(currentPage)) {
            return <Home onLogin={handleNavigateToLogin} />;
        }

        // Guard centralizado: Accesos
        if (isAuthenticated && !hasPermissionForPage(currentPage)) {
            return (
                <AccessDeniedPage
                    onNavigate={handleNavigate}
                    onLogout={handleLogout}
                    currentPage={currentPage}
                />
            );
        }

        switch (currentPage) {

            case 'home':
                return <Home onLogin={handleNavigateToLogin} />;

            case 'login':
                return (
                    <Login
                        onLogin={handleLogin}
                        error={loginError}
                        onGoHome={() => handleNavigate('home')}
                    />
                );

            case 'dashboard':
                return <Dashboard onNavigate={handleNavigate} onLogout={handleLogout} />;

            case 'eventos':
                return (
                    <EventsList
                        onViewEventDetails={handleViewEventDetails}
                        onEditEvent={handleEditEvent}
                        onCreateEvent={handleCreateEvent}
                        onNavigate={handleNavigate}
                        onLogout={handleLogout}
                    />
                );

            case 'event-details':
                console.log("Rendering EventDetails with ID:", selectedEventId);
                if (!selectedEventId) {
                    console.error("No event ID selected, navigating back to events list");
                    handleNavigate('eventos');
                    return null;
                }
                return (
                    <EventDetails
                        onBack={handleBackToEvents}
                        onNavigate={handleNavigate}
                        eventId={selectedEventId}
                        onEdit={handleEditEvent}
                        onLogout={handleLogout}
                    />
                );

            case 'edit-event':
                if (!selectedEventId) {
                    console.error("No event ID selected, navigating back to events list");
                    handleNavigate('eventos');
                    return null;
                }
                return (
                    <EditEvent
                        onBack={handleBackToEvents}
                        eventId={selectedEventId}
                        onNavigate={handleNavigate}
                    />
                );

            case 'create-event':
                return (
                    <CreateEvent
                        onBack={handleBackToEvents}
                        onNavigate={handleNavigate}
                    />
                );

            case 'participants':
                return (
                    <Participant
                        onNavigate={handleNavigate}
                        canAccess={hasPermissionForPage}
                    />
                );


            case 'create-participant':
                return (
                    <CreateParticipant
                        isOpen={true}
                        onClose={() => handleNavigate('participants')}
                        onSuccess={() => handleNavigate('participants')}
                    />
                );

            case 'edit-participant':
                if (!selectedParticipantId) {
                    console.error("No participant ID selected, navigating back to participants list");
                    handleNavigate('participants');
                    return null;
                }
                return (
                    <EditParticipant
                        isOpen={true}
                        onClose={() => handleNavigate('participants')}
                        onSuccess={() => handleNavigate('participants')}
                        participantId={selectedParticipantId}
                    />
                );

            case 'evaluaciones':
                return (
                    <EvaluationsList
                        onNavigate={handleNavigate}
                        onViewEvaluation={handleViewEvaluationDetails}
                    />
                );

            case 'evaluation-details':
                return (
                    <EvaluationDetails
                        onBack={handleBackToEvaluations}
                        participantId={selectedParticipantId || undefined}
                        eventId={selectedEventId || undefined}
                        onNavigate={handleNavigate}
                    />
                );

            case 'roles':
                return (
                    <UserRoleManagement
                        onNavigate={handleNavigate}
                        onLogout={handleLogout}
                    />
                );

            case 'cuenta':
                return <Profile onNavigate={handleNavigate} />;

            default:
                return (
                    <NotFoundPage
                        onNavigate={handleNavigate}
                        onLogout={handleLogout}
                        currentPage={currentPage}
                    />
                );
        }
    };

    return renderContent();
}

export default App;


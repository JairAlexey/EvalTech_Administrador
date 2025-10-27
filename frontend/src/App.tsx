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

type Page = 'home' | 'login' | 'dashboard' | 'eventos' | 'create-event' | 'event-details' | 'edit-event' | 'participants' | 'edit-participant' | 'create-participant' | 'evaluaciones' | 'evaluation-details' | 'estadisticas' | 'exportar' | 'cuenta' | 'roles';

function App() {
    const [currentPage, setCurrentPage] = useState<Page>('home');
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);

    const { isAuthenticated, isLoading, logout, user, hasAnyRole, login } = useAuth();
    const isSuperAdmin = user?.role === 'superadmin';
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    const isEvaluator = user?.role === 'evaluator';

    // Navigation handler for sidebar and component navigation
    const handleNavigate = (page: string) => {
        console.log("Navigating to:", page);

        // Check permission for the page
        if (!hasPermissionForPage(page)) {
            console.warn("User doesn't have permission to access page:", page);
            return;
        }

        // Reset relevant state when changing main sections
        if (['dashboard', 'eventos', 'participants', 'evaluaciones', 'estadisticas', 'roles'].includes(page)) {
            setSelectedEventId(null);
            setSelectedParticipantId(null);
        }
        setCurrentPage(page as Page);
    };

    // Check if user has permission for a page
    const hasPermissionForPage = (page: string): boolean => {
        // Pages accessible to evaluators
        const evaluatorPages = ['dashboard', 'evaluaciones', 'evaluation-details', 'cuenta'];

        // Pages accessible to admin and superadmin
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

        // Pages accessible only to superadmin
        const superAdminPages = [...adminPages, 'roles'];

        if (!isAuthenticated) {
            return ['home', 'login'].includes(page);
        }

        if (!hasAnyRole()) {
            return false; // User has no role assigned
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

    // Event Handlers
    const handleCreateEvent = () => {
        if (!hasPermissionForPage('create-event')) return;
        setCurrentPage('create-event');
    };

    const handleViewEventDetails = (eventId: string) => {
        console.log("View event details for ID:", eventId);
        // Store the ID first, then navigate
        setSelectedEventId(eventId);
        console.log("Selected event ID set to:", eventId);
        // Navigate immediately instead of using setTimeout
        setCurrentPage('event-details');
        console.log("Navigated to event-details with ID:", eventId);
    };

    const handleEditEvent = (eventId: string) => {
        if (!hasPermissionForPage('edit-event')) return;
        setSelectedEventId(eventId);
        console.log("Edit event ID set to:", eventId);
        // Navigate immediately
        setCurrentPage('edit-event');
        console.log("Navigated to edit-event with ID:", eventId);
    };

    // Evaluation Handlers
    const handleViewEvaluationDetails = (participantId: string, eventId: string) => {
        if (!hasPermissionForPage('evaluation-details')) return;
        setSelectedParticipantId(participantId);
        setSelectedEventId(eventId);
        setCurrentPage('evaluation-details');
    };

    // Return to list view handlers
    const handleBackToEvents = () => {
        setSelectedEventId(null);
        setCurrentPage('eventos');
    };

    const handleBackToEvaluations = () => {
        setSelectedParticipantId(null);
        setSelectedEventId(null);
        setCurrentPage('evaluaciones');
    };

    const handleNavigateToLogin = () => {
        setCurrentPage('login');
    };

    const handleLogout = async () => {
        await logout();
        setCurrentPage('login');
    };

    // Auth Handlers
    const handleLogin = async (email: string, password: string) => {
        try {
            const userInfo = await login(email, password);

            // Verificar usuario
            if (userInfo && userInfo.role) {
                setCurrentPage('dashboard');
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

        // Check permission for current page
        // PROBLEMA: Esta verificación está causando redirecciones no deseadas
        // para páginas como event-details y participant-details
        if (isAuthenticated && !hasPermissionForPage(currentPage)) {
            // Redirect to default page based on role
            if (isSuperAdmin) {
                setCurrentPage('dashboard');
            } else if (isAdmin) {
                setCurrentPage('eventos');
            } else if (isEvaluator) {
                setCurrentPage('evaluaciones');
            }
            return null;
        }

        switch (currentPage) {
            case 'home':
                return <Home onLogin={handleNavigateToLogin} />;

            case 'login':
                return (
                    <Login
                        onLogin={handleLogin}
                        error={loginError}
                        onGoHome={() => setCurrentPage('home')}
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
                    setCurrentPage('eventos');
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
                    setCurrentPage('eventos');
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
                    />
                );


            case 'create-participant':
                return (
                    <CreateParticipant
                        isOpen={true}
                        onClose={() => setCurrentPage('participants')}
                        onSuccess={() => setCurrentPage('participants')}
                    />
                );

            case 'edit-participant':
                if (!selectedParticipantId) {
                    console.error("No participant ID selected, navigating back to participants list");
                    setCurrentPage('participants');
                    return null;
                }
                return (
                    <EditParticipant
                        isOpen={true}
                        onClose={() => setCurrentPage('participants')}
                        onSuccess={() => setCurrentPage('participants')}
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
                return <div>Página no encontrada</div>;
        }
    };

    return renderContent();
}

export default App;


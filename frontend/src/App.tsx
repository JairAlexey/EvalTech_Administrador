import { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import EventsList from './components/EventsList';
import CreateEvent from './components/CreateEvent';
import EventDetails from './components/EventDetails';
import EditEvent from './components/EditEvent';
import CandidatesList from './components/CandidatesList';
import CandidateDetails from './components/CandidateDetails';
import EditCandidate from './components/EditCandidate';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import EvaluationsList from './components/EvaluationsList';
import EvaluationDetails from './components/EvaluationDetails';
import UserRoleManagement from './components/UserRoleManagement';
import WaitingForRole from './components/WaitingForRole';
import { useAuth } from './contexts/AuthContext';
import CreateCandidate from './components/CreateCandidate';

type Page = 'home' | 'login' | 'register' | 'dashboard' | 'eventos' | 'create-event' | 'event-details' | 'edit-event' | 'candidatos' | 'candidate-details' | 'edit-candidate' | 'create-candidate' | 'evaluaciones' | 'evaluation-details' | 'estadisticas' | 'exportar' | 'ajustes' | 'cuenta' | 'roles';

function App() {
    const [currentPage, setCurrentPage] = useState<Page>('home');
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

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
        if (['dashboard', 'eventos', 'candidatos', 'evaluaciones', 'estadisticas', 'ajustes', 'roles'].includes(page)) {
            setSelectedEventId(null);
            setSelectedCandidateId(null);
            setSelectedParticipantId(null);
        }
        setCurrentPage(page as Page);
    };

    // Check if user has permission for a page
    const hasPermissionForPage = (page: string): boolean => {
        // Pages accessible to evaluators
        const evaluatorPages = ['dashboard', 'evaluaciones', 'evaluation-details', 'ajustes', 'cuenta'];

        // Pages accessible to admin and superadmin
        const adminPages = [
            'dashboard',
            'eventos',
            'create-event',
            'event-details',
            'edit-event',
            'candidatos',
            'candidate-details',
            'edit-candidate',
            'create-candidate',
            'evaluaciones',
            'evaluation-details',
            'estadisticas',
            'exportar',
            'ajustes',
            'cuenta'
        ];

        // Pages accessible only to superadmin
        const superAdminPages = [...adminPages, 'roles'];

        if (!isAuthenticated) {
            return ['home', 'login', 'register'].includes(page);
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

    // Candidate Handlers
    const handleCreateCandidate = () => {
        if (!hasPermissionForPage('create-candidate')) return;
        setCurrentPage('create-candidate');
    };

    const handleViewCandidateDetails = (candidateId: string) => {
        console.log("View candidate details for ID:", candidateId);
        // Store the ID first, then navigate
        setSelectedCandidateId(candidateId);
        console.log("Selected candidate ID set to:", candidateId);
        // Navigate immediately
        setCurrentPage('candidate-details');
        console.log("Navigated to candidate-details with ID:", candidateId);
    };

    const handleEditCandidate = (candidateId: string) => {
        if (!hasPermissionForPage('edit-candidate')) return;
        setSelectedCandidateId(candidateId);
        console.log("Edit candidate ID set to:", candidateId);
        // Navigate immediately
        setCurrentPage('edit-candidate');
        console.log("Navigated to edit-candidate with ID:", candidateId);
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

    const handleBackToCandidates = () => {
        setSelectedCandidateId(null);
        setCurrentPage('candidatos');
    };

    const handleBackToEvaluations = () => {
        setSelectedParticipantId(null);
        setSelectedEventId(null);
        setCurrentPage('evaluaciones');
    };

    const handleNavigateToLogin = () => {
        setCurrentPage('login');
    };

    const handleNavigateToRegister = () => {
        setCurrentPage('register');
    };

    const handleLogout = async () => {
        await logout();
        setCurrentPage('home');
    };

    // Auth Handlers
    const handleLogin = async (email: string, password: string) => {
        try {
            const userInfo = await login(email, password);

            // Check if the user has a role before redirecting
            if (userInfo && userInfo.role) {
                // User has a role, navigate to dashboard
                setCurrentPage('dashboard');
            } else {
                // User has no role, stay on the current page
                // The renderContent function will show WaitingForRole component
            }
        } catch (error) {
            console.error('Login error:', error);
            // Let the Login component handle the error
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

        // Non-authenticated users can only see home, login, register
        if (!isAuthenticated && !['home', 'login', 'register'].includes(currentPage)) {
            return <Home onLogin={handleNavigateToLogin} />;
        }

        // Authenticated users with no role see the waiting screen
        if (isAuthenticated && !hasAnyRole()) {
            return <WaitingForRole />;
        }

        // Check permission for current page
        // PROBLEMA: Esta verificación está causando redirecciones no deseadas
        // para páginas como event-details y candidate-details
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
                        onRegister={handleNavigateToRegister}
                    />
                );

            case 'register':
                return (
                    <Register
                        onRegister={() => setCurrentPage('dashboard')}
                        onBackToLogin={handleNavigateToLogin}
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

            case 'candidatos':
                return (
                    <CandidatesList
                        onViewCandidateDetails={handleViewCandidateDetails}
                        onEditCandidate={handleEditCandidate}
                        onCreateCandidate={handleCreateCandidate}
                        onNavigate={handleNavigate}
                    />
                );

            case 'create-candidate':
                return (
                    <CreateCandidate
                        onBack={handleBackToCandidates}
                        onNavigate={handleNavigate}
                        onCreate={() => setCurrentPage('candidatos')}
                    />
                );


            case 'candidate-details':
                console.log("Rendering CandidateDetails with ID:", selectedCandidateId);
                if (!selectedCandidateId) {
                    console.error("No candidate ID selected, navigating back to candidates list");
                    setCurrentPage('candidatos');
                    return null;
                }
                return (
                    <CandidateDetails
                        onBack={handleBackToCandidates}
                        onNavigate={handleNavigate}
                        candidateId={selectedCandidateId}
                        onEdit={handleEditCandidate}
                    />
                );

            case 'edit-candidate':
                if (!selectedCandidateId) {
                    console.error("No candidate ID selected, navigating back to candidates list");
                    setCurrentPage('candidatos');
                    return null;
                }
                return (
                    <EditCandidate
                        onBack={handleBackToCandidates}
                        candidateId={selectedCandidateId}
                        onNavigate={handleNavigate}
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
                        candidateId={selectedParticipantId || undefined}
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

            default:
                return <div>Página no encontrada</div>;
        }
    };

    return renderContent();
}

export default App;


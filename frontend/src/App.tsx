import { useState } from 'react';
import Login from './components/Login';
import EventsList from './components/EventsList';
import CreateEvent from './components/CreateEvent';
import EventDetails from './components/EventDetails';
import EditEvent from './components/EditEvent';
import CandidatesList from './components/CandidatesList';
import CandidateDetails from './components/CandidateDetails';
import EditCandidate from './components/EditCandidate';
import CreateCandidate from './components/CreateCandidate';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import EvaluationsList from './components/EvaluationsList';
import EvaluationDetails from './components/EvaluationDetails';

type Page = 'home' | 'login' | 'eventos' | 'create-event' | 'event-details' | 'edit-event' | 'candidatos' | 'events' | 'candidates' | 'dashboard' | 'evaluaciones' | 'estadisticas' | 'exportar' | 'ajustes' | 'cuenta' | 'candidate-details' | 'edit-candidate' | 'create-candidate' | 'evaluation-details';

function App() {
    const [currentPage, setCurrentPage] = useState<Page>('home');
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

    const handleLogin = () => {
        setCurrentPage('dashboard');
    };

    const handleCreateEvent = () => {
        setCurrentPage('create-event');
    };

    const handleBackToEvents = () => {
        setCurrentPage('events');
    };

    const handleViewEventDetails = (eventId: string) => {
        setSelectedEventId(eventId);
        setCurrentPage('event-details');
    };

    const handleEditEvent = (eventId: string) => {
        setSelectedEventId(eventId);
        setCurrentPage('edit-event');
    };

    const handleViewCandidateDetails = (candidateId: string) => {
        setSelectedCandidateId(candidateId);
        setCurrentPage('candidate-details');
    };

    const handleEditCandidate = (candidateId: string) => {
        setSelectedCandidateId(candidateId);
        setCurrentPage('edit-candidate');
    };

    const handleCreateCandidate = () => {
        setCurrentPage('create-candidate');
    };

    const handleBackToCandidates = () => {
        setCurrentPage('candidatos');
    };

    const handleNavigateToPage = (page: string) => {
        setCurrentPage(page as Page);
    };

    const handleNavigateToLogin = () => {
        setCurrentPage('login');
    };

    const handleLogout = () => {
        setCurrentPage('home');
    };

    const handleViewEvaluationDetails = (participantId: string, eventId: string) => {
        setSelectedParticipantId(participantId);
        setSelectedEventId(eventId);
        setCurrentPage('evaluation-details');
    };

    const handleBackToEvaluations = () => {
        setCurrentPage('evaluaciones');
    };

    return (
        <>
            {currentPage === 'home' && <Home onLogin={handleNavigateToLogin} />}
            {currentPage === 'login' && <Login onLogin={handleLogin} />}
            {(currentPage === 'events' || currentPage === 'eventos') && (
                <EventsList
                    onCreateEvent={handleCreateEvent}
                    onViewEventDetails={handleViewEventDetails}
                    onEditEvent={handleEditEvent}
                    onNavigate={handleNavigateToPage}
                />
            )}
            {currentPage === 'create-event' && <CreateEvent onBack={handleBackToEvents} onNavigate={handleNavigateToPage} />}
            {currentPage === 'event-details' && <EventDetails onBack={handleBackToEvents} onEdit={handleEditEvent} onNavigate={handleNavigateToPage} />}
            {currentPage === 'edit-event' && <EditEvent onBack={handleBackToEvents} eventId={selectedEventId || undefined} onNavigate={handleNavigateToPage} />}
            {(currentPage === 'candidates' || currentPage === 'candidatos') &&
                <CandidatesList
                    onNavigate={handleNavigateToPage}
                    onViewCandidateDetails={handleViewCandidateDetails}
                    onEditCandidate={handleEditCandidate}
                    onCreateCandidate={handleCreateCandidate}
                />
            }
            {currentPage === 'candidate-details' &&
                <CandidateDetails
                    onBack={handleBackToCandidates}
                    candidateId={selectedCandidateId || undefined}
                    onNavigate={handleNavigateToPage}
                    onEdit={handleEditCandidate}
                />
            }
            {currentPage === 'edit-candidate' &&
                <EditCandidate
                    onBack={handleBackToCandidates}
                    candidateId={selectedCandidateId || undefined}
                    onNavigate={handleNavigateToPage}
                />
            }
            {currentPage === 'create-candidate' &&
                <CreateCandidate
                    onBack={handleBackToCandidates}
                    onNavigate={handleNavigateToPage}
                />
            }
            {currentPage === 'dashboard' &&
                <Dashboard onNavigate={handleNavigateToPage} onLogout={handleLogout} />
            }
            {currentPage === 'evaluaciones' &&
                <EvaluationsList
                    onNavigate={handleNavigateToPage}
                    onViewEvaluation={handleViewEvaluationDetails}
                />
            }
            {currentPage === 'evaluation-details' &&
                <EvaluationDetails
                    onBack={handleBackToEvaluations}
                    candidateId={selectedParticipantId || undefined}
                    eventId={selectedEventId || undefined}
                    onNavigate={handleNavigateToPage}
                />
            }
        </>
    );
}

export default App;

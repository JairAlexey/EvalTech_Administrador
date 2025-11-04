import { API_URL } from './authService';

// Interfaces
export interface Event {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  closeDate: string;
  closeTime: string;
  duration: number;
  endDate: string;
  endTime: string;
  status: string;
  participants: number;
  evaluator: string;
  selected: boolean;
}

export interface EventDetail {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  closeDate: string;
  closeTime: string;
  status: string; // Cambiado de 'Programado' | 'En progreso' | 'Completado' a string
  description: string;
  evaluator: string;
  evaluatorId: string;
  duration: number;
  endDate: string;
  endTime: string;
  blockedWebsites?: string[];
  participants: {
    id: string;
    name: string;
    email: string;
    status: string;
    initials: string;
    color: string;
    selected?: boolean;
  }[];
}

export interface EventDetailResponse {
  event: EventDetail;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  selected: boolean;
  initials: string;
  color: string;
}

export interface EventFormData {
  eventName: string;
  description: string;
  startDate: string;
  evaluator: string;
  participants: Array<{
    id: string;
    name: string;
    email: string;
    selected: boolean;
    initials: string;
    color: string;
  }>;
  timezone: string;
  startTime: string;
  closeTime: string;
  duration: number;
  blockedWebsites?: string[];
}

export const eventService = {
  /**
   * Obtiene la lista de eventos
   * @returns Promise con la lista de eventos
   */
  async getEvents(): Promise<Event[]> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/events`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error(`Error al obtener eventos. Status: ${response.status}`);
        const errorText = await response.text();
        console.error(`Respuesta de error: ${errorText}`);
        throw new Error(`Error al obtener los eventos: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API eventos respuesta:", data);
      
      // Verificamos si la respuesta tiene la estructura esperada
      if (!data || !data.events) {
        console.error("Formato de respuesta de eventos incorrecto:", data);
        // Devolver un array vacío en lugar de lanzar un error
        return [];
      }
      
      // Asegurarnos de que events es un array
      if (!Array.isArray(data.events)) {
        console.error("El campo 'events' no es un array:", data.events);
        return [];
      }
      
      return data.events;
    } catch (error) {
      console.error('Error al obtener eventos:', error);
      // En caso de error, devolver un array vacío para evitar errores en el componente
      return [];
    }
  },

  /**
   * Crea un nuevo evento
   * @param eventData Datos del nuevo evento
   * @returns Promise con el ID del evento creado
   */
  async createEvent(eventData: EventFormData): Promise<{ id: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear el evento');
      }

      const data = await response.json();
      return { id: data.id ?? data.eventId };
    } catch (error) {
      console.error('Error al crear evento:', error);
      throw error;
    }
  },

  /**
   * Obtiene los detalles de un evento específico
   * @param eventId ID del evento
   * @returns Promise con los detalles del evento
   */
  async getEventDetails(eventId: string): Promise<EventDetailResponse | EventDetail> {
    try {
      console.log("eventService - Getting event details for ID:", eventId);
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error(`eventService - Error fetching event details. Status: ${response.status}`);
        const errorText = await response.text();
        console.error(`eventService - Response body: ${errorText}`);
        throw new Error(`Error al obtener detalles del evento: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("eventService - Event details response:", data);
      return data;
    } catch (error) {
      console.error(`eventService - Error getting event details for ID ${eventId}:`, error);
      throw error;
    }
  },

  /**
   * Actualiza un evento existente
   * @param eventId ID del evento a actualizar
   * @param eventData Nuevos datos del evento
   * @returns Promise con confirmación de éxito
   */
  async updateEvent(eventId: string, eventData: EventFormData): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar el evento');
      }
    } catch (error) {
      console.error(`Error al actualizar el evento ${eventId}:`, error);
      throw error;
    }
  },

  /**
   * Elimina un evento
   * @param eventId ID del evento a eliminar
   * @returns Promise con confirmación de éxito
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar el evento');
      }
    } catch (error) {
      console.error(`Error al eliminar el evento ${eventId}:`, error);
      throw error;
    }
  },

  /**
   * Envía correos electrónicos a los participantes del evento
   * @param eventId ID del evento
   * @param participantIds (opcional) IDs de participantes seleccionados
   * @returns Promise con confirmación de éxito
   */
  async sendEventEmails(eventId: string, participantIds: string[]): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const body = participantIds && participantIds.length > 0
        ? JSON.stringify({ participantIds })
        : undefined;

      const response = await fetch(`${API_URL}/events/api/events/${eventId}/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al enviar correos electrónicos');
      }
    } catch (error) {
      console.error(`Error al enviar correos para el evento ${eventId}:`, error);
      throw error;
    }
  }
};

export default eventService;
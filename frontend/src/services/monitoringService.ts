import { API_URL } from './authService';

// Interfaces
export interface ParticipantLog {
  id: number;
  name: string;
  message: string;
  created_at: number;
  has_file: boolean;
  file_url: string | null;
}

export interface EventLogsResponse {
  event: {
    id: number;
    name: string;
  };
  logs: ParticipantLog[];
  total: number;
}

export interface ConnectionStats {
  participant: {
    id: number;
    name: string;
    email: string;
  };
  total_time_minutes: number;
  monitoring_is_active: boolean;
  monitoring_last_change: string | null;
  monitoring_sessions_count: number;
}

export const monitoringService = {
  /**
   * Obtiene todos los logs de un participante específico de un evento
   * @param eventId ID del evento
   * @param participantId ID del participante
   * @returns Promise con los logs del participante en el evento
   */
  async getEventLogs(eventId: string, participantId: string): Promise<EventLogsResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(
        `${API_URL}/events/api/events/${eventId}/participants/${participantId}/logs/`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        console.error(`Error al obtener logs del evento. Status: ${response.status}`);
        const errorText = await response.text();
        console.error(`Respuesta de error: ${errorText}`);
        throw new Error(`Error al obtener los logs del evento: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API logs respuesta:", data);
      return data;
    } catch (error) {
      console.error('Error al obtener logs del evento:', error);
      throw error;
    }
  },

  /**
   * Obtiene estadísticas de conexión de un participante en un evento específico
   * @param eventId ID del evento
   * @param participantId ID del participante
   * @returns Promise con las estadísticas de conexión
   */
  async getParticipantConnectionStats(eventId: string, participantId: string): Promise<ConnectionStats> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(
        `${API_URL}/events/api/events/${eventId}/participants/${participantId}/connection-stats/`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        console.error(`Error al obtener estadísticas de conexión. Status: ${response.status}`);
        const errorText = await response.text();
        console.error(`Respuesta de error: ${errorText}`);
        throw new Error(`Error al obtener estadísticas de conexión: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API connection stats respuesta:", data);
      return data;
    } catch (error) {
      console.error('Error al obtener estadísticas de conexión:', error);
      throw error;
    }
  }
};

export default monitoringService;

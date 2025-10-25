import { API_URL } from './authService';

export interface ParticipantFormData {
  first_name: string;
  last_name: string;
  email: string;
}

export interface EventData {
  id: string;
  name: string;
  date: string;
  status: string;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  events?: EventData[];
}

export interface ParticipantDetail {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export const participantService = {
  /**
   * Obtiene la lista de participantes
   * @param searchTerm Término de búsqueda opcional
   * @returns Promise con la lista de participantes
   */
  async getParticipants(searchTerm?: string): Promise<Participant[]> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      let url = `${API_URL}/events/api/participants`;
      if (searchTerm) {
        url += `?search=${encodeURIComponent(searchTerm)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al obtener los participantes');
      }

      const data = await response.json();
      return data.participants;
    } catch (error) {
      console.error('Error al obtener participantes:', error);
      throw error;
    }
  },

  /**
   * Crea un nuevo participante
   * @param participantData Datos del participante a crear
   * @returns Promise con el ID del participante creado
   */
  async createParticipant(participantData: ParticipantFormData): Promise<{ id: string; name: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(participantData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear el participante');
      }

      const data = await response.json();
      return { id: data.id, name: data.name };
    } catch (error) {
      console.error('Error al crear participante:', error);
      throw error;
    }
  },

  /**
   * Obtiene los detalles de un participante específico
   * @param participantId ID del participante
   * @returns Promise con los detalles del participante
   */
  async getParticipantDetails(participantId: string): Promise<ParticipantDetail> {
    try {
      console.log("participantService - Getting participant details for ID:", participantId);
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      // CORREGIDO: Cambiando la ruta de participants
      const response = await fetch(`${API_URL}/events/api/participants/${participantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error(`participantService - Error fetching participant details. Status: ${response.status}`);
        const errorText = await response.text();
        console.error(`participantService - Response body: ${errorText}`);
        throw new Error(`Error al obtener detalles del participante: ${response.statusText}`);
      }

      const data = await response.json();
      // La respuesta del backend contiene los datos del participante en un campo llamado 'participant'
      return data.participant;
    } catch (error) {
      console.error(`participantService - Error getting participant details for ID ${participantId}:`, error);
      throw error;
    }
  },

  /**
   * Actualiza un participante existente
   * @param participantId ID del participante a actualizar
   * @param participantData Nuevos datos del participante
   * @returns Promise con confirmación de éxito
   */
  async updateParticipant(participantId: string, participantData: any): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      const response = await fetch(`${API_URL}/events/api/participants/${participantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: participantData.first_name,
          last_name: participantData.last_name,
          email: participantData.email,
          role: participantData.role,
          experience: participantData.experience,
          skills: participantData.skills,
          event: participantData.event,
          notes: participantData.notes,
          send_credentials: participantData.send_credentials,
          send_reminder: participantData.send_reminder,
          status: participantData.status
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar el participante');
      }
    } catch (error) {
      console.error(`Error al actualizar el participante ${participantId}:`, error);
      throw error;
    }
  },

  /**
   * Actualiza solo el estado de un participante
   * @param participantId ID del participante
   * @param status Nuevo estado del participante
   * @returns Promise con confirmación de éxito
   */
  async updateParticipantStatus(participantId: string, status: string): Promise<{ message: string; status: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/participants/${participantId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar el estado del participante');
      }

      const data = await response.json();
      return { message: data.message, status: data.status };
    } catch (error) {
      console.error(`Error al actualizar estado del participante ${participantId}:`, error);
      throw error;
    }
  },

  /**
   * Elimina un participante
   * @param participantId ID del participante a eliminar
   * @returns Promise con confirmación de éxito
   */
  async deleteParticipant(participantId: string): Promise<{ message: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/participants/${participantId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar el participante');
      }

      const data = await response.json();
      return { message: data.message };
    } catch (error) {
      console.error(`Error al eliminar participante ${participantId}:`, error);
      throw error;
    }
  }
};

export default participantService;
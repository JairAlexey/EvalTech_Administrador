import { API_URL } from './authService';

export interface CandidateFormData {
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  experience: number;
  skills: string[];
  event?: string; // Evento ahora es opcional
  notes: string;
  send_credentials: boolean;
  send_reminder: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  position: string;
  status: string;
  event?: string;
  eventId?: string;
  initials: string;
  color: string;
  skills?: string[];
  experienceYears?: number;
}

export interface CandidateDetail {
  id: string;
  nombre: string;
  apellidos: string;
  name: string;
  email: string;
  position: string;
  experienceYears: number;
  skills: string[];
  notes: string;
  status: string;
  statusKey: string;
  event: string;
  eventId: string | null;
  sendCredentials: boolean;
  sendReminder: boolean;
  initials: string;
  eventKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const candidateService = {
  /**
   * Obtiene la lista de candidatos
   * @param searchTerm Término de búsqueda opcional
   * @returns Promise con la lista de candidatos
   */
  async getCandidates(searchTerm?: string): Promise<Candidate[]> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      let url = `${API_URL}/events/api/candidates`;
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
        throw new Error(error.error || 'Error al obtener los candidatos');
      }

      const data = await response.json();
      return data.participants;
    } catch (error) {
      console.error('Error al obtener candidatos:', error);
      throw error;
    }
  },

  /**
   * Crea un nuevo candidato
   * @param candidateData Datos del candidato a crear
   * @returns Promise con el ID del candidato creado
   */
  async createCandidate(candidateData: CandidateFormData): Promise<{ id: string; name: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/candidates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(candidateData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al crear el candidato');
      }

      const data = await response.json();
      return { id: data.id, name: data.name };
    } catch (error) {
      console.error('Error al crear candidato:', error);
      throw error;
    }
  },

  /**
   * Obtiene los detalles de un candidato específico
   * @param candidateId ID del candidato
   * @returns Promise con los detalles del candidato
   */
  async getCandidateDetails(candidateId: string): Promise<CandidateDetail> {
    try {
      console.log("candidateService - Getting candidate details for ID:", candidateId);
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      // CORREGIDO: Cambiando la ruta de 'participants' a 'candidates'
      const response = await fetch(`${API_URL}/events/api/candidates/${candidateId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error(`candidateService - Error fetching candidate details. Status: ${response.status}`);
        const errorText = await response.text();
        console.error(`candidateService - Response body: ${errorText}`);
        throw new Error(`Error al obtener detalles del candidato: ${response.statusText}`);
      }

      const data = await response.json();
      // La respuesta del backend contiene los datos del candidato en un campo llamado 'participant'
      return data.participant;
    } catch (error) {
      console.error(`candidateService - Error getting candidate details for ID ${candidateId}:`, error);
      throw error;
    }
  },

  /**
   * Actualiza un candidato existente
   * @param candidateId ID del candidato a actualizar
   * @param candidateData Nuevos datos del candidato
   * @returns Promise con confirmación de éxito
   */
  async updateCandidate(candidateId: string, candidateData: any): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }
      
      // Format ID if necessary (remove any non-numeric characters)
      const formattedId = candidateId.toString().replace(/\D/g, '');

      const response = await fetch(`${API_URL}/events/api/candidates/${formattedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          first_name: candidateData.first_name,
          last_name: candidateData.last_name,
          email: candidateData.email,
          role: candidateData.role,
          experience: candidateData.experience,
          skills: candidateData.skills,
          event: candidateData.event,
          notes: candidateData.notes,
          send_credentials: candidateData.send_credentials,
          send_reminder: candidateData.send_reminder
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar el candidato');
      }
    } catch (error) {
      console.error(`Error al actualizar el candidato ${candidateId}:`, error);
      throw error;
    }
  },

  /**
   * Actualiza solo el estado de un candidato
   * @param candidateId ID del candidato
   * @param status Nuevo estado del candidato
   * @returns Promise con confirmación de éxito
   */
  async updateCandidateStatus(candidateId: string, status: string): Promise<{ message: string; status: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/candidates/${candidateId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al actualizar el estado del candidato');
      }

      const data = await response.json();
      return { message: data.message, status: data.status };
    } catch (error) {
      console.error(`Error al actualizar estado del candidato ${candidateId}:`, error);
      throw error;
    }
  },

  /**
   * Elimina un candidato
   * @param candidateId ID del candidato a eliminar
   * @returns Promise con confirmación de éxito
   */
  async deleteCandidate(candidateId: string): Promise<{ message: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/candidates/${candidateId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al eliminar el candidato');
      }

      const data = await response.json();
      return { message: data.message };
    } catch (error) {
      console.error(`Error al eliminar candidato ${candidateId}:`, error);
      throw error;
    }
  }
};

export default candidateService;
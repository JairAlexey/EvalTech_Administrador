import { API_URL } from './authService';

export interface Evaluation {
  id: string;
  name: string;
  startDate: string;
  startTime: string;
  duration: number;
  endDate: string;
  endTime: string;
  participants: number;
  status: string;
}

export interface EvaluationDetail {
  id: string;
  name: string;
  description: string;
  startDate: string;
  startTime: string;
  duration: number;
  endDate: string;
  endTime: string;
  status: string;
  participants: Array<{
    id: string;
    name: string;
    initials: string;
    status: string;
    color: string;
  }>;
  evaluator: string;
}

export const evaluationService = {
  /**
   * Obtiene la lista de evaluaciones (eventos en progreso y completados)
   */
  async getEvaluations(): Promise<Evaluation[]> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/evaluations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error(`Error al obtener evaluaciones. Status: ${response.status}`);
        const errorText = await response.text();
        console.error(`Respuesta de error: ${errorText}`);
        throw new Error(`Error al obtener las evaluaciones: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API evaluaciones respuesta:", data);
      
      if (!data || !data.evaluaciones) {
        console.error("Formato de respuesta de evaluaciones incorrecto:", data);
        return [];
      }
      
      if (!Array.isArray(data.evaluaciones)) {
        console.error("El campo 'evaluaciones' no es un array:", data.evaluaciones);
        return [];
      }
      
      return data.evaluaciones;
    } catch (error) {
      console.error('Error al obtener evaluaciones:', error);
      return [];
    }
  },

  /**
   * Obtiene los detalles de una evaluación específica
   */
  async getEvaluationDetails(evaluationId: string): Promise<EvaluationDetail | null> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/events/api/evaluations/${evaluationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.error(`Error al obtener detalles de evaluación. Status: ${response.status}`);
        const errorText = await response.text();
        console.error(`Respuesta de error: ${errorText}`);
        throw new Error(`Error al obtener detalles: ${response.statusText}`);
      }

      const data = await response.json();
      return data?.event || null;
    } catch (error) {
      console.error('Error al obtener detalles de evaluación:', error);
      return null;
    }
  }
};

export default evaluationService;

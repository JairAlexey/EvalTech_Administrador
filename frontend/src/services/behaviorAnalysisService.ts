import { API_URL } from './authService';

export interface AnalysisStatus {
  event: {
    id: number;
    name: string;
  };
  participant: {
    id: number;
    name: string;
    email: string;
  };
  analysis: {
    id: number | null;
    status: string;
    video_link: string | null;
    fecha_procesamiento: string | null;
  };
}

export interface AnalysisReport {
  event: {
    id: number;
    name: string;
    duration: number;
  };
  participant: {
    id: number;
    name: string;
    email: string;
  };
  analysis: {
    id: number;
    status: string;
    video_link: string;
    fecha_procesamiento: string;
  };
  statistics: {
    total_rostros_detectados: number;
    total_gestos: number;
    total_anomalias_iluminacion: number;
    total_anomalias_voz: number;
    total_hablantes: number;
    total_anomalias_lipsync: number;
    total_ausencias: number;
    tiempo_total_ausencia_segundos: number;
  };
  registros: {
    rostros: Array<{
      id: number;
      persona_id: number;
      tiempo_inicio: number;
      tiempo_fin: number;
    }>;
    gestos: Array<{
      id: number;
      tipo_gesto: string;
      tiempo_inicio: number;
      tiempo_fin: number;
      duracion: number;
    }>;
    iluminacion: Array<{
      id: number;
      tiempo_inicio: number;
      tiempo_fin: number;
    }>;
    voz: Array<{
      id: number;
      tipo_log: string;
      etiqueta_hablante: string | null;
      tiempo_inicio: number;
      tiempo_fin: number;
    }>;
    lipsync: Array<{
      id: number;
      tipo_anomalia: string;
      tiempo_inicio: number;
      tiempo_fin: number;
    }>;
    ausencias: Array<{
      id: number;
      tiempo_inicio: number;
      tiempo_fin: number;
      duracion: number;
    }>;
  };
}

const behaviorAnalysisService = {
  async getAnalysisStatus(eventId: string, participantId: string): Promise<AnalysisStatus> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const response = await fetch(
      `${API_URL}/analysis/status/${eventId}/participants/${participantId}/`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error al obtener estado de análisis:', response.status, errorText);
      throw new Error('No se pudo obtener el estado del análisis');
    }

    return response.json();
  },

  async getAnalysisReport(eventId: string, participantId: string): Promise<AnalysisReport> {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const response = await fetch(
      `${API_URL}/analysis/report/${eventId}/participants/${participantId}/`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error al obtener reporte de análisis:', response.status, errorText);
      throw new Error('No se pudo obtener el reporte del análisis');
    }

    return response.json();
  },
};

export default behaviorAnalysisService;

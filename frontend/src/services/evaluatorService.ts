import { API_URL } from './authService';

export interface User {
    id: string;
    name: string;
}

const evaluatorService = {
  async getEvaluators(): Promise<User[]> {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('No hay token de autenticación');
    const response = await fetch(`${API_URL}/auth/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Error al obtener evaluadores');
    const data = await response.json();
    return data.users || [];
  }
};

export default evaluatorService;
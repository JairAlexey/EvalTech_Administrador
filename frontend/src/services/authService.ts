// Constantes para almacenar las claves de localStorage
export const TOKEN_KEY = 'auth_token';
export const USER_INFO_KEY = 'user_info';

// URL base de la API
export const API_URL = 'http://localhost:8000';

// Interfaces para tipar las respuestas
export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isStaff: boolean;
  role: string | null; // 'admin', 'evaluator', or null
}

export interface AuthResponse {
  token: string;
  user: User;
}

/**
 * Servicio para manejar la autenticación con el backend
 */
export const authService = {
  /**
   * Inicia sesión con email y contraseña
   * @param email - Email del usuario
   * @param password - Contraseña del usuario
   * @returns Promesa con la respuesta de la API
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al iniciar sesión');
      }

      const data = await response.json();
      
      // Guardar el token y la información del usuario en localStorage
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user));
      
      return data;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  },

  /**
   * Registra un nuevo usuario
   * @param userData - Datos del usuario a registrar
   * @returns Promesa con la respuesta de la API
   */
  async register(userData: { 
    email: string; 
    password: string; 
    firstName?: string; 
    lastName?: string 
  }): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al registrar usuario');
      }

      const data = await response.json();
      
      // Guardar el token y la información del usuario en localStorage
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(data.user));
      
      return data;
    } catch (error) {
      console.error('Error en register:', error);
      throw error;
    }
  },

  /**
   * Cierra la sesión del usuario
   */
  logout(): void {
    try {
      // Llamar al endpoint de logout en el servidor
      fetch(`${API_URL}/auth/logout/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Error en logout:', error);
    } finally {
      // Eliminar los datos de autenticación del localStorage
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_INFO_KEY);
    }
  },

  /**
   * Verifica si el token actual es válido
   * @returns Promesa con booleano indicando si el token es válido
   */
  async verifyToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) return false;

      const response = await fetch(`${API_URL}/auth/verify-token/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.valid;
    } catch (error) {
      console.error('Error al verificar token:', error);
      return false;
    }
  },

  /**
   * Actualiza la información del usuario desde el backend
   * @returns Promesa con la información actualizada del usuario
   */
  async refreshUserInfo(): Promise<User> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('No hay token de autenticación');

      const response = await fetch(`${API_URL}/auth/user-info/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        // Si el token no es válido, logout
        if (response.status === 401) {
          this.logout();
        }
        throw new Error('Error al obtener información del usuario');
      }

      const userData = await response.json();
      
      // Actualizar información en localStorage
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Error al refrescar información de usuario:', error);
      throw error;
    }
  },

  /**
   * Obtiene el token almacenado
   * @returns El token o null si no existe
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Obtiene la información del usuario almacenada
   * @returns Información del usuario o null si no existe
   */
  getUserInfo(): User | null {
    const userInfo = localStorage.getItem(USER_INFO_KEY);
    return userInfo ? JSON.parse(userInfo) : null;
  },

  /**
   * Verifica si el usuario tiene un rol específico
   * @param role El rol a verificar
   * @returns Booleano indicando si el usuario tiene ese rol
   */
  hasRole(role: string): boolean {
    const userInfo = this.getUserInfo();
    return userInfo?.role === role;
  },

  /**
   * Verifica si el usuario tiene un rol asignado
   * @returns Booleano indicando si el usuario tiene algún rol
   */
  hasAnyRole(): boolean {
    const userInfo = this.getUserInfo();
    return userInfo?.role !== null && userInfo?.role !== undefined;
  },

  /**
   * Obtiene una lista de todos los usuarios y sus roles (solo para administradores)
   * @returns Promesa con la lista de usuarios
   */
  async getUsersWithRoles(): Promise<User[]> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/auth/roles/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al obtener usuarios');
      }

      const data = await response.json();
      return data.users;
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw error;
    }
  },

  /**
   * Asigna un rol a un usuario (solo para administradores)
   * @param userId ID del usuario
   * @param role Rol a asignar ('admin' o 'evaluator')
   * @returns Promesa con confirmación
   */
  async assignRole(userId: number, role: string): Promise<any> {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(`${API_URL}/auth/roles/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, role })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al asignar rol');
      }

      return await response.json();
    } catch (error) {
      console.error('Error al asignar rol:', error);
      throw error;
    }
  }
};

export default authService;
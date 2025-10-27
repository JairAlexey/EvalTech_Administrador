import { API_URL } from './authService';

export interface UpdateProfileData {
    firstName: string;
    lastName: string;
    email: string;
    currentPassword?: string;
    newPassword?: string;
}

export const profileService = {
    updateProfile: async (data: UpdateProfileData): Promise<any> => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            throw new Error('No hay token de autenticación');
        }

        const response = await fetch(`${API_URL}/auth/update-profile/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al actualizar el perfil');
        }

        return response.json();
    },
};

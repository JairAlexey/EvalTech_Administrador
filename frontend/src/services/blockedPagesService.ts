import { API_URL } from './authService';

export interface BlockedPage {
  id: string;
  hostname: string;
  created_at?: string;
}

export interface EventBlockedHost {
  id: string;
  website_id: string;
  hostname: string;
}

const blockedPagesService = {
  async getWebsites(): Promise<BlockedPage[]> {
    const response = await fetch(`${API_URL}/events/api/websites/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Error al obtener sitios web');
    }

    const data = await response.json();
    return data.websites || [];
  },

  async getEventBlockedHosts(eventId: string): Promise<string[]> {
    const response = await fetch(`${API_URL}/events/api/${eventId}/blocked-hosts/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Error al obtener hosts bloqueados del evento');
    }

    const data = await response.json();
    return data.blocked_website_ids || [];
  },

  async createWebsite(hostname: string): Promise<BlockedPage> {
    const response = await fetch(`${API_URL}/events/api/websites/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hostname }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al crear el sitio web');
    }

    return await response.json();
  },

  async updateWebsite(id: string, hostname: string): Promise<BlockedPage> {
    const response = await fetch(`${API_URL}/events/api/websites/${id}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ hostname }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al actualizar el sitio web');
    }

    return await response.json();
  },

  async deleteWebsite(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/events/api/websites/${id}/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al eliminar el sitio web');
    }
  },
};

export default blockedPagesService;

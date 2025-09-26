import { apiRequest } from "./queryClient";
import type { 
  User, 
  Event, 
  Booking, 
  AuthResponse, 
  ApiResponse, 
  PaginatedResponse,
  AdminStats,
  AdminUsersListResponse
} from "../types";

// Auth API
export const authAPI = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiRequest("POST", "/api/auth/login", { email, password });
    return response.json();
  },

  register: async (email: string, password: string, name: string): Promise<AuthResponse> => {
    const response = await apiRequest("POST", "/api/auth/register", { email, password, name });
    return response.json();
  },

  me: async (): Promise<ApiResponse<User>> => {
    const response = await apiRequest("GET", "/api/auth/me");
    return response.json();
  },
};

// Events API
export const eventsAPI = {
  getEvents: async (page = 1, limit = 6, search?: string): Promise<ApiResponse<PaginatedResponse<Event>>> => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
    });
    const response = await apiRequest("GET", `/api/events?${params}`);
    return response.json();
  },

  getEvent: async (id: number): Promise<ApiResponse<Event>> => {
    const response = await apiRequest("GET", `/api/events/${id}`);
    return response.json();
  },

  createEvent: async (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'availableSlots'>): Promise<ApiResponse<Event>> => {
    const response = await apiRequest("POST", "/api/events", event);
    return response.json();
  },

  updateEvent: async (id: number, event: Partial<Event>): Promise<ApiResponse<Event>> => {
    const response = await apiRequest("PUT", `/api/events/${id}`, event);
    return response.json();
  },

  deleteEvent: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiRequest("DELETE", `/api/events/${id}`);
    return response.json();
  },

  bookEvent: async (id: number): Promise<ApiResponse<Booking>> => {
    const response = await apiRequest("POST", `/api/events/${id}/book`);
    return response.json();
  },

  cancelBooking: async (id: number): Promise<ApiResponse<void>> => {
    const response = await apiRequest("DELETE", `/api/events/${id}/book`);
    return response.json();
  },
  
  getEventBookings: async (eventId: number): Promise<ApiResponse<Booking[]>> => {
    const response = await apiRequest("GET", `/api/events/${eventId}/bookings`);
    return response.json();
  },
};

// Bookings API
export const bookingsAPI = {
  getMyBookings: async (): Promise<ApiResponse<Booking[]>> => {
    const response = await apiRequest("GET", "/api/bookings/my");
    return response.json();
  },

  getEventBookings: async (eventId: number): Promise<ApiResponse<Booking[]>> => {
    const response = await apiRequest("GET", `/api/events/${eventId}/bookings`);
    return response.json();
  },
};

// Admin API
export const adminAPI = {
  getStats: async (): Promise<ApiResponse<AdminStats>> => {
    const response = await apiRequest("GET", "/api/admin/stats");
    return response.json();
  },
  getUsers: async (params?: { page?: number; limit?: number; search?: string; sort?: string; direction?: 'asc' | 'desc' }): Promise<ApiResponse<AdminUsersListResponse>> => {
    const query = new URLSearchParams();
    if (params) {
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.sort) query.set('sort', params.sort);
      if (params.direction) query.set('direction', params.direction);
    }
    const qs = query.toString();
    const response = await apiRequest(`GET`, `/api/admin/users${qs ? `?${qs}` : ''}`);
    return response.json();
  },
  promoteUser: async (id: number): Promise<ApiResponse<any>> => {
    const response = await apiRequest('POST', `/api/admin/users/${id}/promote`);
    return response.json();
  },
  demoteUser: async (id: number): Promise<ApiResponse<any>> => {
    const response = await apiRequest('POST', `/api/admin/users/${id}/demote`);
    return response.json();
  },
  deleteUser: async (id: number): Promise<ApiResponse<any>> => {
    const response = await apiRequest('DELETE', `/api/admin/users/${id}`);
    return response.json();
  },
  createNotification: async (payload: { userId: number; title: string; body?: string; type?: string }): Promise<ApiResponse<any>> => {
    const response = await apiRequest('POST', '/api/admin/notifications', payload);
    return response.json();
  },
  getAuditLogs: async (params: { page?: number; limit?: number; action?: string; actorId?: number; targetType?: string; start?: string; end?: string }): Promise<ApiResponse<any>> => {
    const query = new URLSearchParams();
    Object.entries(params || {}).forEach(([k,v]) => { if (v!==undefined && v!==null && v!=='') query.set(k,String(v)); });
    const response = await apiRequest('GET', `/api/admin/audit-logs?${query.toString()}`);
    return response.json();
  }
};

// Notifications / Profile API
export const notificationsAPI = {
  list: async (page=1, limit=20): Promise<ApiResponse<any>> => {
    const response = await apiRequest('GET', `/api/notifications?page=${page}&limit=${limit}`);
    return response.json();
  },
  markRead: async (id: number): Promise<ApiResponse<any>> => {
    const response = await apiRequest('POST', `/api/notifications/${id}/read`);
    return response.json();
  },
  markAll: async (): Promise<ApiResponse<any>> => {
    const response = await apiRequest('POST', `/api/notifications/read-all`);
    return response.json();
  }
};

export const profileAPI = {
  get: async (): Promise<ApiResponse<any>> => {
    const response = await apiRequest('GET', '/api/profile');
    return response.json();
  },
  update: async (data: { name?: string; bio?: string; avatarUrl?: string; preferences?: any }): Promise<ApiResponse<any>> => {
    const response = await apiRequest('PUT', '/api/profile', data);
    return response.json();
  }
};

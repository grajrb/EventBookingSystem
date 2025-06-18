import { apiRequest } from "./queryClient";
import type { 
  User, 
  Event, 
  Booking, 
  AuthResponse, 
  ApiResponse, 
  PaginatedResponse,
  AdminStats 
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
};

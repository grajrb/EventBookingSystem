export interface User {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  location: string;
  date: string;
  totalSlots: number;
  availableSlots: number;
  image?: string;
  tags: string[];
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  bookingCount?: number;
  isBooked?: boolean;
}

export interface Booking {
  id: number;
  userId: number;
  eventId: number;
  status: string;
  createdAt: string;
  event?: Event;
  user?: User;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    token: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  events: T[];
  total: number;
}

export interface AdminStats {
  totalEvents: number;
  totalBookings: number;
  thisMonth: number;
  occupancyRate: number;
}

import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiError, parseErrorResponse } from './errors';

// API base URL configuration
// In production we either:
//  - use VITE_API_URL if provided (allows deploying frontend separate from API)
//  - or default to same-origin (empty string) when API and client are served together
// Previous hard-coded placeholder caused  network errors in production ("Failed to fetch").
const configured = (import.meta as any).env?.VITE_API_URL as string | undefined;
export const API_BASE_URL = (configured && configured.trim()) ? configured.replace(/\/+$/, '') : '';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    throw parseErrorResponse(res.status, text || res.statusText);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem("token");
  
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${url}`, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  } catch (networkErr: any) {
    // Network / CORS error
    throw new ApiError(networkErr.message || 'Network request failed', 'NETWORK_ERROR', 0, undefined, networkErr);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("token");
    
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${queryKey[0]}` as string, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    });
    } catch (e: any) {
      throw new ApiError(e.message || 'Network request failed', 'NETWORK_ERROR', 0, undefined, e);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

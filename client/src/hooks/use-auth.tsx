import { useState, useEffect, createContext, useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authAPI } from "../lib/api";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      if (!token) return null;
      const response = await authAPI.me();
      return response.data;
    },
    enabled: !!token,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authAPI.login(email, password),
    onSuccess: (data) => {
      const { token: newToken } = data.data;
      setToken(newToken);
      localStorage.setItem("token", newToken);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      authAPI.register(email, password, name),
    onSuccess: (data) => {
      const { token: newToken } = data.data;
      setToken(newToken);
      localStorage.setItem("token", newToken);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (email: string, password: string, name: string) => {
    await registerMutation.mutateAsync({ email, password, name });
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("token");
    queryClient.clear();
  };

  // Add token to API requests
  useEffect(() => {
    if (token) {
      // This will be used by the queryClient for authenticated requests
      localStorage.setItem("token", token);
    }
  }, [token]);

  const value = {
    user: user || null,
    isLoading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

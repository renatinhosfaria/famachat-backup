import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import { User } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: User | null;
  user: User | null; // Alias para compatibilidade
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

// Interface para resposta da API de login
interface LoginResponse {
  success: boolean;
  message: string;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
}

// Criando o contexto de autenticação
export const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  user: null,
  isLoading: false,
  error: null,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('access_token')
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    localStorage.getItem('refresh_token')
  );
  const { toast } = useToast();

  // Verificar se o usuário está autenticado ao carregar a aplicação
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      if (!accessToken) return null;
      
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        // Token expirado, tentar refresh
        if (response.status === 401 && refreshToken) {
          const refreshResponse = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });
          
          if (refreshResponse.ok) {
            const refreshData: LoginResponse = await refreshResponse.json();
            if (refreshData.success && refreshData.accessToken) {
              setAccessToken(refreshData.accessToken);
              setRefreshToken(refreshData.refreshToken || refreshToken);
              localStorage.setItem('access_token', refreshData.accessToken);
              if (refreshData.refreshToken) {
                localStorage.setItem('refresh_token', refreshData.refreshToken);
              }
              return refreshData.user || null;
            }
          }
        }
        
        // Se não conseguiu renovar, limpar tokens
        setAccessToken(null);
        setRefreshToken(null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        return null;
      }
      
      const data = await response.json();
      return data.success ? data.user : null;
    },
    enabled: !!accessToken,
    retry: false,
  });

  // Atualizar usuário atual quando dados mudarem
  useEffect(() => {
    setCurrentUser(userData || null);
  }, [userData]);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (params: { email: string, password: string }): Promise<LoginResponse> => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      
      const data: LoginResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Erro ao fazer login');
      }
      
      return data;
    },
    onSuccess: (data) => {
      if (data.success && data.user && data.accessToken) {
        setCurrentUser(data.user);
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken || null);
        
        // Salvar tokens no localStorage
        localStorage.setItem('access_token', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro de login",
        description: error.message,
      });
    }
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (accessToken) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });
        } catch (error) {
          // Ignora erros de logout, pois o importante é limpar o estado local
          console.warn('Erro ao fazer logout no servidor:', error);
        }
      }
    },
    onSettled: () => {
      // Limpar estado local sempre, independente do resultado da API
      setCurrentUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      
      toast({
        title: "Logout realizado com sucesso",
        description: "Você foi desconectado",
      });
    }
  });

  // Funções de login e logout
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      return result.success;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  const isLoading = loginMutation.isPending || logoutMutation.isPending || userLoading;
  const isAuthenticated = !!currentUser && !!accessToken;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        user: currentUser,
        isLoading,
        error: null,
        login,
        logout,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
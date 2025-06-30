import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

/**
 * Interface para os dados de metas
 */
export interface MetasData {
  id?: number;
  userId: number;
  periodo?: string;
  ano: number;
  mes: number;
  agendamentos?: number;
  visitas?: number;
  vendas?: number;
  // Campo conversaoClientes foi removido do banco
  // Atualmente apenas os campos abaixo existem no banco:
  conversaoAgendamentos?: number; // % de conversão de agendamentos em visitas
  conversaoVisitas?: number;      // % de conversão de visitas em vendas
  conversaoVendas?: number;       // % de conversão de vendas
}

/**
 * Hook para gerenciar as metas dos usuários
 */
export const useMetas = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Busca metas de um usuário específico
   */
  const useMetasUsuario = (userId: number, ano?: number, mes?: number) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    return useQuery({
      queryKey: ['metas', 'usuario', userId, ano || currentYear, mes || currentMonth],
      queryFn: async () => {
        const response = await apiRequest(
          `/api/metas/usuario/${userId}?ano=${ano || currentYear}&mes=${mes || currentMonth}`
        );
        return response;
      },
      staleTime: 1000 * 60 * 5, // 5 minutos
    });
  };

  /**
   * Busca todas as metas para o período selecionado
   */
  const useTodasMetas = (ano?: number, mes?: number) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    return useQuery({
      queryKey: ['metas', 'todas', ano || currentYear, mes || currentMonth],
      queryFn: async () => {
        console.log('Buscando todas as metas...');
        const timestamp = new Date().getTime(); // Adiciona timestamp para evitar cache
        const response = await fetch(
          `/api/metas/todas?ano=${ano || currentYear}&mes=${mes || currentMonth}&_t=${timestamp}`,
          {
            credentials: 'include',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );
        
        if (!response.ok) {
          throw new Error('Falha ao buscar metas');
        }
        
        const data = await response.json();
        console.log('Dados recebidos do servidor:', data);
        return data;
      },
      staleTime: 0, // Sem staleTime para sempre buscar dados frescos
      gcTime: 0, // Sem cache (gcTime substitui cacheTime na v5 do React Query)
      refetchOnMount: true, // Refetch sempre que o componente for montado
      refetchOnWindowFocus: true // Refetch quando a janela ganhar foco
    });
  };

  /**
   * Busca metas específicas de consultor
   */
  const useMetasConsultor = (userId: number, ano?: number, mes?: number) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    return useQuery({
      queryKey: ['metas', 'consultor', userId, ano || currentYear, mes || currentMonth],
      queryFn: async () => {
        const response = await apiRequest(
          `/api/metas/consultor/${userId}?ano=${ano || currentYear}&mes=${mes || currentMonth}`
        );
        return response;
      },
      staleTime: 1000 * 60 * 5, // 5 minutos
    });
  };

  /**
   * Busca metas específicas de corretor
   */
  const useMetasCorretor = (userId: number, ano?: number, mes?: number) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    return useQuery({
      queryKey: ['metas', 'corretor', userId, ano || currentYear, mes || currentMonth],
      queryFn: async () => {
        const response = await apiRequest(
          `/api/metas/corretor/${userId}?ano=${ano || currentYear}&mes=${mes || currentMonth}`
        );
        return response;
      },
      staleTime: 1000 * 60 * 5, // 5 minutos
    });
  };

  /**
   * Mutation para salvar metas
   */
  const useSalvarMetas = () => {
    return useMutation({
      mutationFn: async (data: MetasData) => {
        console.log('Enviando dados para salvar meta:', data);
        return await fetch('/api/metas/salvar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include',
        }).then(async (res) => {
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Erro ao salvar metas');
          }
          return res.json();
        });
      },
      onSuccess: () => {
        // Invalidar explicitamente todas as queries relacionadas
        console.log('Meta salva com sucesso, atualizando dados...');
        queryClient.invalidateQueries({ queryKey: ['metas', 'todas'] });
        queryClient.invalidateQueries({ queryKey: ['metas', 'consultor'] });
        queryClient.invalidateQueries({ queryKey: ['metas', 'corretor'] });
        queryClient.invalidateQueries({ queryKey: ['metas', 'usuario'] });
        
        toast({
          title: 'Metas salvas',
          description: 'As metas foram salvas com sucesso.',
          variant: 'default',
        });
      },
      onError: (error: any) => {
        console.error('Erro ao salvar metas:', error);
        toast({
          title: 'Erro ao salvar metas',
          description: error.message || 'Houve um erro ao salvar as metas. Tente novamente.',
          variant: 'destructive',
        });
      },
    });
  };

  /**
   * Mutation para atualizar metas
   */
  const useAtualizarMetas = () => {
    return useMutation({
      mutationFn: async ({ id, data }: { id: number; data: Partial<MetasData> }) => {
        return await fetch(`/api/metas/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
          credentials: 'include',
        }).then(async (res) => {
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Erro ao atualizar metas');
          }
          return res.json();
        });
      },
      onSuccess: () => {
        // Invalidar queries relacionadas
        queryClient.invalidateQueries({ queryKey: ['metas'] });
        toast({
          title: 'Metas atualizadas',
          description: 'As metas foram atualizadas com sucesso.',
          variant: 'default',
        });
      },
      onError: (error: any) => {
        console.error('Erro ao atualizar metas:', error);
        toast({
          title: 'Erro ao atualizar metas',
          description: error.message || 'Houve um erro ao atualizar as metas. Tente novamente.',
          variant: 'destructive',
        });
      },
    });
  };

  /**
   * Mutation para excluir metas
   */
  const useExcluirMeta = () => {
    return useMutation({
      mutationFn: async (id: number) => {
        return await fetch(`/api/metas/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        }).then(async (res) => {
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Erro ao excluir meta');
          }
          return true; // Retorna true para indicar sucesso
        });
      },
      onSuccess: () => {
        // Invalidar queries relacionadas
        queryClient.invalidateQueries({ queryKey: ['metas'] });
        toast({
          title: 'Meta excluída',
          description: 'A meta foi excluída com sucesso.',
          variant: 'default',
        });
      },
      onError: (error: any) => {
        console.error('Erro ao excluir meta:', error);
        toast({
          title: 'Erro ao excluir meta',
          description: error.message || 'Houve um erro ao excluir a meta. Tente novamente.',
          variant: 'destructive',
        });
      },
    });
  };

  return {
    useMetasUsuario,
    useTodasMetas,
    useMetasConsultor,
    useMetasCorretor,
    useSalvarMetas,
    useAtualizarMetas,
    useExcluirMeta,
  };
};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Tipos dos proprietários
export interface ProprietarioPF {
  id: number;
  tipo: 'Pessoa Física';
  nome: string;
  celular: string;
  email: string | null;
  cpf: string | null;
}

export interface Construtora {
  id: number;
  tipo: 'Construtora';
  nome?: string;
  nomeConstrutora?: string;
  cpfCnpj: string | null;
  razaoSocial: string | null;
  contatoNome?: string | null;
  contatoCelular?: string | null;
  contatoEmail?: string | null;
  contatos: ContatoConstrutora[];
}

export type Proprietario = ProprietarioPF | Construtora;

export interface ContatoConstrutora {
  id: number;
  nome: string;
  telefone: string | null;
  email: string | null;
}

export function useProprietarios() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: proprietarios, isLoading, isError } = useQuery<Proprietario[]>({
    queryKey: ['proprietarios'],
    queryFn: async () => {
      try {
        const response = await apiRequest({ url: '/api/proprietarios', method: 'GET' });
        return response || []; // Garantir que sempre retorna array, mesmo vazio
      } catch (error) {
        
        throw error; // Rejeitar a promise para que isError seja true
      }
    }
  });

  const createProprietario = useMutation({
    mutationFn: async (data: Omit<Proprietario, 'id'>) => {
      const response = await apiRequest({ 
        url: '/api/proprietarios', 
        method: 'POST',
        body: data
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proprietarios'] });
      toast({
        title: 'Sucesso',
        description: 'Proprietário criado com sucesso',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Erro ao criar proprietário',
        variant: 'destructive',
      });
    }
  });

  const updateProprietario = useMutation({
    mutationFn: async ({ id, ...data }: Proprietario) => {
      const response = await apiRequest({ 
        url: `/api/proprietarios/${id}`, 
        method: 'PUT',
        body: data
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proprietarios'] });
      toast({
        title: 'Sucesso',
        description: 'Proprietário atualizado com sucesso',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar proprietário',
        variant: 'destructive',
      });
    }
  });

  const deleteProprietario = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest({ 
        url: `/api/proprietarios/${id}`, 
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proprietarios'] });
      toast({
        title: 'Sucesso',
        description: 'Proprietário excluído com sucesso',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: 'Erro ao excluir proprietário',
        variant: 'destructive',
      });
    }
  });

  return {
    proprietarios,
    isLoading,
    isError,
    createProprietario,
    updateProprietario,
    deleteProprietario
  };
}

// Hook para criar proprietário pessoa física
export function useCreateProprietarioPF() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: { 
      nome: string; 
      cpf?: string; 
      email?: string; 
      telefone?: string 
    }) => {
      // Garantir que telefone nunca seja nulo
      const payloadData = {
        ...data,
        telefone: data.telefone || '' // Valor vazio como fallback se telefone for undefined
      };
      
      // Usar formato de objeto para a configuração da API
      return await apiRequest({
        url: '/api/proprietarios/pessoa-fisica',
        method: 'POST',
        body: payloadData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proprietarios'] });
      toast({
        title: 'Proprietário criado',
        description: 'O proprietário foi cadastrado com sucesso',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: `Erro ao criar proprietário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    },
  });
}

// Hook para criar construtora
export function useCreateConstrutora() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: { 
      nomeConstrutora: string; 
      razaoSocial?: string; 
      cpfCnpj?: string;
      contatos?: Array<{
        nome: string;
        telefone?: string;
        email?: string;
      }>;
      contatoNome?: string;
      contatoCelular?: string;
      contatoEmail?: string;
    }) => {
      // Garantir que não temos valores nulos
      const payloadData = {
        ...data,
        razaoSocial: data.razaoSocial || '',
        cpfCnpj: data.cpfCnpj || ''
      };
      
      // Garantir que contatos seja um array válido
      if (!payloadData.contatos) {
        payloadData.contatos = [];
      }
      
      // Usar formato de objeto para a configuração da API
      return await apiRequest({
        url: '/api/proprietarios/construtora', 
        method: 'POST',
        body: payloadData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proprietarios'] });
      toast({
        title: 'Construtora criada',
        description: 'A construtora foi cadastrada com sucesso',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: `Erro ao criar construtora: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    },
  });
}

// Hook para atualizar proprietário pessoa física
export function useUpdateProprietarioPF() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, data }: { 
      id: string; 
      data: {
        nome: string;
        cpf?: string;
        email?: string;
        telefone?: string;
      } 
    }) => {
      // Garantir que telefone nunca seja nulo
      const payloadData = {
        ...data,
        telefone: data.telefone || '' // Valor vazio como fallback se telefone for undefined
      };
      
      // Usar formato de objeto para a configuração da API
      return await apiRequest({
        url: `/api/proprietarios/pessoa-fisica/${id}`,
        method: 'PUT',
        body: payloadData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proprietarios'] });
      toast({
        title: 'Proprietário atualizado',
        description: 'Os dados do proprietário foram atualizados com sucesso',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: `Erro ao atualizar proprietário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    },
  });
}

// Hook para atualizar construtora
export function useUpdateConstrutora() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, data }: { 
      id: string; 
      data: {
        nomeConstrutora: string;
        razaoSocial?: string;
        cpfCnpj?: string;
        contato?: {
          id?: string;
          nome: string;
          telefone?: string;
          email?: string;
        }
      } 
    }) => {
      // Garantir que não temos valores nulos
      const payloadData = {
        ...data,
        razaoSocial: data.razaoSocial || '',
        cpfCnpj: data.cpfCnpj || ''
      };
      
      // Se tiver contato, garantir que não temos valores nulos
      if (payloadData.contato) {
        payloadData.contato = {
          ...payloadData.contato,
          id: payloadData.contato.id || undefined,
          telefone: payloadData.contato.telefone || '',
          email: payloadData.contato.email || ''
        };
      }
      
      // Usar formato de objeto para a configuração da API
      return await apiRequest({
        url: `/api/proprietarios/construtora/${id}`,
        method: 'PUT',
        body: payloadData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proprietarios'] });
      toast({
        title: 'Construtora atualizada',
        description: 'Os dados da construtora foram atualizados com sucesso',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: `Erro ao atualizar construtora: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    },
  });
}

// Hook para excluir proprietário
export function useDeleteProprietario() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ tipo, id }: { tipo: 'pessoa-fisica' | 'construtora'; id: string }) => {
      // Usar o formato correto da API (objeto de configuração)
      return await apiRequest({
        url: `/api/proprietarios/${tipo}/${id}`,
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/proprietarios'] });
      toast({
        title: 'Proprietário excluído',
        description: 'O proprietário foi excluído com sucesso',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: `Erro ao excluir proprietário: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    },
  });
}
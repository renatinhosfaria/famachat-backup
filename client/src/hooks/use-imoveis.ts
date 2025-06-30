import { useQuery } from '@tanstack/react-query';

export interface Imovel {
  id: number;
  endereco: string;
  // Adicione outros campos conforme necessário
}

async function fetchImoveis(): Promise<Imovel[]> {
  const response = await fetch('/api/imoveis');
  if (!response.ok) {
    throw new Error('Erro ao buscar imóveis');
  }
  return response.json();
}

export function useImoveis() {
  return useQuery<Imovel[]>({
    queryKey: ['imoveis'],
    queryFn: fetchImoveis,
  });
} 
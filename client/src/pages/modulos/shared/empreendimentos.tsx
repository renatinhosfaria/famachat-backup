import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus, ArrowLeft } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

// Componente modal para o formulário de cadastro
import { NovoEmpreendimentoForm } from '@/components/NovoEmpreendimentoForm';

interface Empreendimento {
  id: string;
  nome: string;
  proprietario: string;
  endereco: string;
}

export default function EmpreendimentosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalAberto, setModalAberto] = useState(false);
  const [empreendimentoParaEditar, setEmpreendimentoParaEditar] = useState<string | null>(null);
  const [location, navigate] = useLocation();
  const [proprietarioIdParam, setProprietarioIdParam] = useState<string | null>(null);
  
  // Verificar parâmetros da URL para abrir modal automaticamente
  useEffect(() => {
    // Extrair parâmetros da URL
    const params = new URLSearchParams(window.location.search);
    const novoParam = params.get('novo');
    
    // Se tiver o parâmetro 'novo=true', abrir o modal automaticamente
    if (novoParam === 'true') {
      abrirModal();
      // Limpar a URL para não manter o parâmetro
      navigate('/empreendimentos', { replace: true });
    }
  }, [location]);

  // Buscar lista de empreendimentos
  const { data: empreendimentos, isLoading, error } = useQuery({
    queryKey: ['empreendimentos'],
    queryFn: async () => {
      const response = await axios.get('/api/empreendimentos-page');
      return response.data as Empreendimento[];
    }
  });

  // Função para abrir o modal de cadastro
  const abrirModal = (id?: string) => {
    if (id) {
      setEmpreendimentoParaEditar(id);
    } else {
      setEmpreendimentoParaEditar(null);
    }
    setModalAberto(true);
  };

  // Função para fechar o modal de cadastro
  const fecharModal = () => {
    setModalAberto(false);
    setEmpreendimentoParaEditar(null);
    setProprietarioIdParam(null);
  };
  
  // Efeito para verificar se há um proprietarioId na URL e abrir o modal
  useEffect(() => {
    if (location) {
      const url = new URL(window.location.href);
      const proprietarioId = url.searchParams.get('proprietarioId');
      
      if (proprietarioId) {
        setProprietarioIdParam(proprietarioId);
        setModalAberto(true);
      }
    }
  }, [location]);

  // Função para excluir um empreendimento
  const excluirEmpreendimento = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este empreendimento?')) {
      return;
    }

    try {
      await axios.delete(`/api/empreendimentos-page/${id}`);
      
      toast({
        title: 'Empreendimento excluído',
        description: 'O empreendimento foi excluído com sucesso.',
        variant: 'default',
      });
      
      // Atualizar a lista após excluir
      queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
    } catch (error) {
      
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o empreendimento.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto px-2 xxs:px-3 xs:px-4 sm:px-6 py-4 xxs:py-6 xs:py-8">
      <div className="flex items-center mb-3 xxs:mb-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/imoveis')}
          className="flex items-center gap-1 text-xs xxs:text-sm px-2 xxs:px-3 py-1 xxs:py-2"
        >
          <ArrowLeft className="h-3 w-3 xxs:h-4 xxs:w-4" /> 
          <span className="hidden xxs:inline">Voltar</span>
        </Button>
      </div>
      
      <div className="flex flex-col xxs:flex-row xxs:justify-between xxs:items-center mb-4 xxs:mb-5 xs:mb-6 gap-3 xxs:gap-4">
        <h1 className="text-lg xxs:text-xl xs:text-2xl sm:text-3xl font-bold">Empreendimentos</h1>
        <button
          className="flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white px-3 xxs:px-3 xs:px-3 sm:px-3 md:px-4 py-2 xxs:py-2 xs:py-2 sm:py-2 md:py-2.5 rounded text-xs xxs:text-sm xs:text-base self-start xxs:self-auto"
          onClick={() => abrirModal()}
        >
          <Plus className="md:mr-2" size={14} />
          <span className="hidden md:inline">Novo Empreendimento</span>
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-6 xxs:py-8 text-xs xxs:text-sm xs:text-base">
          Carregando empreendimentos...
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 xxs:px-4 py-2 xxs:py-3 rounded mb-3 xxs:mb-4 text-xs xxs:text-sm">
          Erro ao carregar empreendimentos. Por favor, tente novamente.
        </div>
      )}

      {empreendimentos && empreendimentos.length === 0 && (
        <div className="text-center py-6 xxs:py-8 xs:py-10 text-gray-500 text-xs xxs:text-sm xs:text-base">
          <div className="bg-gray-50 rounded-lg p-4 xxs:p-5 xs:p-6">
            <p className="font-medium mb-1">Nenhum empreendimento cadastrado ainda</p>
            <p className="text-xs xxs:text-xs xs:text-sm opacity-75">Clique em "Novo Empreendimento" para começar</p>
          </div>
        </div>
      )}

      {empreendimentos && empreendimentos.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tabela desktop (xs e acima) */}
          <div className="hidden xs:block overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2 xs:py-3 px-3 xs:px-4 sm:px-6 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="py-2 xs:py-3 px-3 xs:px-4 sm:px-6 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proprietário</th>
                  <th className="py-2 xs:py-3 px-3 xs:px-4 sm:px-6 border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endereço</th>
                  <th className="py-2 xs:py-3 px-3 xs:px-4 sm:px-6 border-b text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {empreendimentos.map((empreendimento) => (
                  <tr key={empreendimento.id} className="hover:bg-gray-50">
                    <td className="py-2 xs:py-3 px-3 xs:px-4 sm:px-6 border-b">
                      <Link 
                        to={`/empreendimento/${empreendimento.id}`}
                        className="text-blue-500 hover:text-blue-700 font-medium text-xs xs:text-sm truncate max-w-[120px] xs:max-w-[180px] block"
                      >
                        {empreendimento.nome}
                      </Link>
                    </td>
                    <td className="py-2 xs:py-3 px-3 xs:px-4 sm:px-6 border-b text-xs xs:text-sm text-gray-900 truncate max-w-[100px] xs:max-w-[150px]">
                      {empreendimento.proprietario}
                    </td>
                    <td className="py-2 xs:py-3 px-3 xs:px-4 sm:px-6 border-b text-xs xs:text-sm text-gray-900 truncate max-w-[120px] xs:max-w-[200px]">
                      {empreendimento.endereco}
                    </td>
                    <td className="py-2 xs:py-3 px-3 xs:px-4 sm:px-6 border-b text-center">
                      <div className="flex justify-center space-x-1 xs:space-x-2">
                        <button
                          onClick={() => navigate(`/imoveis/${empreendimento.id}/apartamento`)}
                          className="text-green-500 hover:text-green-700 p-1 xs:p-1.5"
                          title="Adicionar apartamento"
                        >
                          <Plus size={14} className="xs:w-4 xs:h-4" />
                        </button>
                        <button
                          onClick={() => abrirModal(empreendimento.id)}
                          className="text-blue-500 hover:text-blue-700 p-1 xs:p-1.5"
                          title="Editar empreendimento"
                        >
                          <Pencil size={14} className="xs:w-4 xs:h-4" />
                        </button>
                        <button
                          onClick={() => excluirEmpreendimento(empreendimento.id)}
                          className="text-red-500 hover:text-red-700 p-1 xs:p-1.5"
                          title="Excluir empreendimento"
                        >
                          <Trash2 size={14} className="xs:w-4 xs:h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Cards mobile (até xs) */}
          <div className="xs:hidden">
            <div className="divide-y divide-gray-200">
              {empreendimentos.map((empreendimento) => (
                <div key={empreendimento.id} className="p-3 xxs:p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <Link 
                          to={`/empreendimento/${empreendimento.id}`}
                          className="text-blue-500 hover:text-blue-700 font-medium text-sm xxs:text-base block truncate"
                        >
                          {empreendimento.nome}
                        </Link>
                      </div>
                      
                      <div className="space-y-1 xxs:space-y-1.5">
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500 w-20 xxs:w-24 flex-shrink-0">Proprietário:</span>
                          <span className="text-xs xxs:text-sm text-gray-900 truncate">{empreendimento.proprietario}</span>
                        </div>
                        
                        <div className="flex items-start">
                          <span className="text-xs text-gray-500 w-20 xxs:w-24 flex-shrink-0">Endereço:</span>
                          <span className="text-xs xxs:text-sm text-gray-900 break-words">{empreendimento.endereco}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 xxs:gap-1.5 ml-3">
                      <button
                        onClick={() => navigate(`/imoveis/${empreendimento.id}/apartamento`)}
                        className="text-green-500 hover:text-green-700 p-1.5 h-7 w-7 flex items-center justify-center"
                        title="Adicionar apartamento"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => abrirModal(empreendimento.id)}
                        className="text-blue-500 hover:text-blue-700 p-1.5 h-7 w-7 flex items-center justify-center"
                        title="Editar empreendimento"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => excluirEmpreendimento(empreendimento.id)}
                        className="text-red-500 hover:text-red-700 p-1.5 h-7 w-7 flex items-center justify-center"
                        title="Excluir empreendimento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de cadastro/edição */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xxs:p-4">
          <div className="bg-white rounded-lg p-3 xxs:p-4 xs:p-6 w-full max-w-sm xxs:max-w-md xs:max-w-2xl sm:max-w-4xl max-h-screen overflow-y-auto">
            <NovoEmpreendimentoForm
              empreendimentoId={empreendimentoParaEditar}
              proprietarioId={proprietarioIdParam}
              onClose={fecharModal}
              onSuccess={() => {
                fecharModal();
                queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
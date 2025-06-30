import React, { useState, useEffect } from 'react';
import { useProprietarios, Proprietario, ProprietarioPF, Construtora } from '@/hooks/use-proprietarios';
import { Button } from '@/components/ui/button';
import { Loader2, Pencil, Trash2, Building2, User, Building, PlusSquare, Search, Filter, ArrowLeft } from 'lucide-react';
import { NovoProprietarioModal } from '@/components/NovoProprietarioModal';
import { ConfirmarExclusaoModal } from '@/components/ConfirmarExclusaoModal';
import { DetalhesConstrutoraModal } from '@/components/DetalhesConstrutoraModal';
import { useLocation } from 'wouter';
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Proprietarios: React.FC = () => {
  const { proprietarios, isLoading, isError, createProprietario, updateProprietario, deleteProprietario } = useProprietarios();
  const [openNovo, setOpenNovo] = useState(false);
  const [editData, setEditData] = useState<Proprietario | null>(null);
  const [excluirId, setExcluirId] = useState<number | null>(null);
  const [detalhesConstrutora, setDetalhesConstrutora] = useState<Construtora | null>(null);
  const [, navigate] = useLocation();
  
  // Estados para busca e filtro
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'Pessoa Física' | 'Construtora'>('todos');
  const [proprietariosFiltrados, setProprietariosFiltrados] = useState<Proprietario[]>([]);

  // Efeito para verificar se deve abrir o modal automaticamente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const abrirModal = params.get('abrirModal');
    if (abrirModal === 'true') {
      setOpenNovo(true);
      // Limpar o parâmetro da URL sem recarregar a página
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const handleSave = async (data: Omit<Proprietario, 'id'>) => {
    if (editData) {
      if (data.tipo === 'Pessoa Física') {
        const updatedData: ProprietarioPF = {
          ...data,
          id: editData.id,
          tipo: 'Pessoa Física',
          nome: data.nome || '',
          celular: (data as ProprietarioPF).celular,
          email: (data as ProprietarioPF).email,
          cpf: (data as ProprietarioPF).cpf
        };
        await updateProprietario.mutateAsync(updatedData);
      } else {
        const updatedData: Construtora = {
          ...data,
          id: editData.id,
          tipo: 'Construtora',
          nome: data.nome || '',
          cpfCnpj: (data as Construtora).cpfCnpj,
          razaoSocial: (data as Construtora).razaoSocial,
          contatos: (data as Construtora).contatos
        };
        await updateProprietario.mutateAsync(updatedData);
      }
    } else {
      await createProprietario.mutateAsync(data);
    }
    setOpenNovo(false);
    setEditData(null);
  };

  const handleExcluir = async () => {
    if (excluirId) {
      await deleteProprietario.mutateAsync(excluirId);
      setExcluirId(null);
    }
  };
  
  // Efeito para filtrar proprietários quando a busca ou filtro mudar
  useEffect(() => {
    if (!proprietarios) {
      setProprietariosFiltrados([]);
      return;
    }
    
    let resultado = [...proprietarios];
    
    // Filtrar por tipo
    if (tipoFiltro !== 'todos') {
      resultado = resultado.filter(p => p.tipo === tipoFiltro);
    }
    
    // Filtrar pela busca
    if (busca.trim()) {
      const termoBusca = busca.toLowerCase().trim();
      resultado = resultado.filter(p => {
        const nome = p.tipo === 'Construtora' 
          ? ((p as Construtora).nomeConstrutora || p.nome || '').toLowerCase() 
          : (p.nome || '').toLowerCase();
        
        return nome.includes(termoBusca);
      });
    }
    
    setProprietariosFiltrados(resultado);
  }, [proprietarios, busca, tipoFiltro]);
  
  // Função para normalizar texto para comparação (remover acentos e converter para minúsculas)
  const normalizar = (texto: string) => {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
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
        <h1 className="text-lg xxs:text-xl xs:text-2xl sm:text-3xl font-bold">Proprietários</h1>
        <Button 
          variant="default" 
          onClick={() => setOpenNovo(true)}
          className="flex items-center justify-center text-xs xxs:text-sm xs:text-base px-3 xxs:px-3 xs:px-3 sm:px-3 md:px-4 py-2 xxs:py-2 xs:py-2 sm:py-2 md:py-2.5 self-start xxs:self-auto"
        >
          <PlusSquare className="md:mr-2 h-4 w-4" />
          <span className="hidden md:inline">Novo Proprietário</span>
        </Button>
      </div>
      
      {/* Área de busca e filtros */}
      <div className="mb-4 xxs:mb-5 xs:mb-6 bg-white p-3 xxs:p-4 xs:p-5 rounded-lg shadow">
        <div className="flex flex-col space-y-3 xxs:space-y-3 xs:flex-row xs:space-y-0 xs:gap-4 xs:items-center">
          {/* Campo de busca */}
          <div className="flex-1 relative w-full">
            <div className="absolute inset-y-0 left-0 pl-2 xxs:pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 xxs:h-5 xxs:w-5 text-gray-400" />
            </div>
            <Input 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar proprietário..."
              className="pl-8 xxs:pl-10 w-full text-xs xxs:text-sm xs:text-base h-8 xxs:h-9 xs:h-10"
            />
          </div>
          
          {/* Botão de Filtro */}
          <div className="flex justify-start xs:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-1 xxs:gap-2 text-xs xxs:text-sm px-2 xxs:px-3 py-1 xxs:py-2 h-8 xxs:h-9 xs:h-10"
                >
                  <Filter className="h-3 w-3 xxs:h-4 xxs:w-4" />
                  <span className="hidden xxs:inline">
                    {tipoFiltro === 'todos' ? 'Todos' : tipoFiltro}
                  </span>
                  <span className="xxs:hidden">Filtro</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs xxs:text-sm">
                <DropdownMenuItem onClick={() => setTipoFiltro('todos')}>
                  Todos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTipoFiltro('Pessoa Física')}>
                  Pessoa Física
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTipoFiltro('Construtora')}>
                  Construtora
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <NovoProprietarioModal open={openNovo || !!editData} onOpenChange={v => { setOpenNovo(false); if (!v) setEditData(null); }} onSave={handleSave} initialData={editData} />
      <ConfirmarExclusaoModal open={!!excluirId} onConfirm={handleExcluir} onCancel={() => setExcluirId(null)} />
      {detalhesConstrutora && (
        <DetalhesConstrutoraModal
          open={!!detalhesConstrutora}
          onClose={() => setDetalhesConstrutora(null)}
          cnpj={detalhesConstrutora.cpfCnpj || ''}
          razaoSocial={detalhesConstrutora.razaoSocial || ''}
          nome={detalhesConstrutora.nome || ''}
        />
      )}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="flex justify-center items-center p-8 xxs:p-10 xs:p-12">
            <Loader2 className="h-6 w-6 xxs:h-7 xxs:w-7 xs:h-8 xs:w-8 animate-spin text-primary" />
            <span className="ml-2 text-xs xxs:text-sm xs:text-base">Carregando proprietários...</span>
          </div>
        ) : isError ? (
          <div className="flex justify-center items-center p-8 xxs:p-10 xs:p-12 text-red-500 text-xs xxs:text-sm xs:text-base">
            Erro ao carregar dados. Por favor, tente novamente mais tarde.
          </div>
        ) : proprietarios && proprietariosFiltrados.length > 0 ? (
          <div className="hidden xs:block">
            {/* Tabela desktop (xs e acima) */}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 xs:px-4 sm:px-6 py-2 xs:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-3 xs:px-4 sm:px-6 py-2 xs:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-3 xs:px-4 sm:px-6 py-2 xs:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                  <th className="px-3 xs:px-4 sm:px-6 py-2 xs:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Celular</th>
                  <th className="px-3 xs:px-4 sm:px-6 py-2 xs:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-3 xs:px-4 sm:px-6 py-2 xs:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proprietariosFiltrados.map((proprietario) => (
                  <tr key={proprietario.id} className="hover:bg-gray-50">
                    <td className="px-3 xs:px-4 sm:px-6 py-3 xs:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {proprietario.tipo === 'Construtora' ? (
                          <Building2 className="h-4 w-4 xs:h-5 xs:w-5 text-gray-400 mr-2" />
                        ) : (
                          <User className="h-4 w-4 xs:h-5 xs:w-5 text-gray-400 mr-2" />
                        )}
                        <div className="text-xs xs:text-sm font-medium text-gray-900 truncate max-w-[120px] xs:max-w-[180px]">
                          {proprietario.tipo === 'Construtora' ? (proprietario as any).nomeConstrutora || proprietario.nome : proprietario.nome}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 xs:px-4 sm:px-6 py-3 xs:py-4 whitespace-nowrap">
                      <div className="text-xs xs:text-sm text-gray-900">{proprietario.tipo}</div>
                    </td>
                    <td className="px-3 xs:px-4 sm:px-6 py-3 xs:py-4 whitespace-nowrap">
                      <div className="text-xs xs:text-sm text-gray-900">
                        {proprietario.tipo === 'Construtora' ? proprietario.contatoNome || '-' : '-'}
                      </div>
                    </td>
                    <td className="px-3 xs:px-4 sm:px-6 py-3 xs:py-4 whitespace-nowrap">
                      <div className="text-xs xs:text-sm text-gray-900">
                        {proprietario.tipo === 'Construtora' 
                          ? proprietario.contatoCelular || '-'
                          : proprietario.celular || '-'}
                      </div>
                    </td>
                    <td className="px-3 xs:px-4 sm:px-6 py-3 xs:py-4 whitespace-nowrap">
                      <div className="text-xs xs:text-sm text-gray-900 truncate max-w-[120px] xs:max-w-[180px]">
                        {proprietario.tipo === 'Construtora'
                          ? proprietario.contatoEmail || '-'
                          : proprietario.email || '-'}
                      </div>
                    </td>
                    <td className="px-3 xs:px-4 sm:px-6 py-3 xs:py-4 whitespace-nowrap text-right text-xs xs:text-sm font-medium">
                      <div className="flex justify-end gap-1 xs:gap-2">
                        {proprietario.tipo === 'Construtora' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetalhesConstrutora(proprietario)}
                            className="text-xs px-2 py-1"
                          >
                            Detalhes
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditData(proprietario)}
                          className="p-1 xs:p-2"
                        >
                          <Pencil className="h-3 w-3 xs:h-4 xs:w-4" />
                        </Button>
                        {proprietario.tipo === 'Construtora' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/empreendimentos?proprietarioId=' + proprietario.id)}
                            title="Novo Empreendimento"
                            className="p-1 xs:p-2"
                          >
                            <Building className="h-3 w-3 xs:h-4 xs:w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExcluirId(proprietario.id)}
                          className="p-1 xs:p-2"
                        >
                          <Trash2 className="h-3 w-3 xs:h-4 xs:w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex justify-center items-center p-8 xxs:p-10 xs:p-12 text-gray-500 text-xs xxs:text-sm xs:text-base">
            {proprietarios && proprietarios.length > 0 ? 'Nenhum proprietário encontrado com os filtros atuais' : 'Nenhum proprietário cadastrado'}
          </div>
        )}
        
        {/* Cards mobile (até xs) */}
        {proprietarios && proprietariosFiltrados.length > 0 && (
          <div className="xs:hidden">
            <div className="divide-y divide-gray-200">
              {proprietariosFiltrados.map((proprietario) => (
                <div key={proprietario.id} className="p-3 xxs:p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center mb-2">
                        {proprietario.tipo === 'Construtora' ? (
                          <Building2 className="h-4 w-4 xxs:h-5 xxs:w-5 text-gray-400 mr-2 flex-shrink-0" />
                        ) : (
                          <User className="h-4 w-4 xxs:h-5 xxs:w-5 text-gray-400 mr-2 flex-shrink-0" />
                        )}
                        <h3 className="text-sm xxs:text-base font-medium text-gray-900 truncate">
                          {proprietario.tipo === 'Construtora' ? (proprietario as any).nomeConstrutora || proprietario.nome : proprietario.nome}
                        </h3>
                      </div>
                      
                      <div className="space-y-1 xxs:space-y-1.5">
                        <div className="flex items-center">
                          <span className="text-xs text-gray-500 w-16 xxs:w-20 flex-shrink-0">Tipo:</span>
                          <span className="text-xs xxs:text-sm text-gray-900">{proprietario.tipo}</span>
                        </div>
                        
                        {proprietario.tipo === 'Construtora' && proprietario.contatoNome && (
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 w-16 xxs:w-20 flex-shrink-0">Contato:</span>
                            <span className="text-xs xxs:text-sm text-gray-900 truncate">{proprietario.contatoNome}</span>
                          </div>
                        )}
                        
                        {(proprietario.tipo === 'Construtora' ? proprietario.contatoCelular : proprietario.celular) && (
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 w-16 xxs:w-20 flex-shrink-0">Celular:</span>
                            <span className="text-xs xxs:text-sm text-gray-900">
                              {proprietario.tipo === 'Construtora' 
                                ? proprietario.contatoCelular
                                : proprietario.celular}
                            </span>
                          </div>
                        )}
                        
                        {(proprietario.tipo === 'Construtora' ? proprietario.contatoEmail : proprietario.email) && (
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 w-16 xxs:w-20 flex-shrink-0">Email:</span>
                            <span className="text-xs xxs:text-sm text-gray-900 truncate">
                              {proprietario.tipo === 'Construtora'
                                ? proprietario.contatoEmail
                                : proprietario.email}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 xxs:gap-1.5 ml-3">
                      {proprietario.tipo === 'Construtora' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetalhesConstrutora(proprietario)}
                          className="text-xs px-2 py-1 h-7"
                        >
                          Detalhes
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditData(proprietario)}
                        className="p-1.5 h-7 w-7"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {proprietario.tipo === 'Construtora' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/empreendimentos?proprietarioId=' + proprietario.id)}
                          title="Novo Empreendimento"
                          className="p-1.5 h-7 w-7"
                        >
                          <Building className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExcluirId(proprietario.id)}
                        className="p-1.5 h-7 w-7"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Proprietarios;
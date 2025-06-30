import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, MapPin, Bed, Bath, Ruler, Plus, Home, Building, Car, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { v4 as uuidv4 } from 'uuid';
import { useLocation, useRoute } from 'wouter';
import { NovoImovelModal } from '@/components/NovoImovelModal';
import { NovoEmpreendimentoForm } from '@/components/NovoEmpreendimentoForm';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { atualizarZonasImoveisEmLote } from '@/services/geocoding';

// Interface para apartamentos vindos da API
interface Apartamento {
  id_apartamento: number;
  id_empreendimento: number;
  titulo_descritivo_apartamento?: string;
  descricao_apartamento?: string;
  valor_venda_apartamento: number;
  quartos_apartamento: number;
  suites_apartamento: number;
  banheiros_apartamento: number;
  vagas_garagem_apartamento: number;
  area_privativa_apartamento: number;
  sacada_varanda_apartamento: boolean;
  tipo_garagem_apartamento?: string;
  zona_empreendimento?: string;
  bairro_empreendimento?: string;
  cidade_empreendimento?: string;
  url_foto_capa_empreendimento?: string;
  nome_empreendimento?: string;
  prazo_entrega_empreendimento?: string;
}

// Interface para o componente de cards de imóveis
interface Imovel {
  id: number;
  tipo: string;
  titulo: string;
  preco: number;
  localizacao: string;
  zona: string;
  imagem: string;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  areaPrivativa: number;
  sacada: boolean;
  descricao: string;
  empreendimentoId: number;
  tipoGaragem: string;
  status: string;
  prazoEntrega: string;
}

const Imoveis: React.FC = () => {
  const { toast } = useToast();
  const [filtros, setFiltros] = useState({
    tipo: '',
    localizacao: '',
    zona: '',
    status: '',
    prazoEntregaMes: '',
    prazoEntregaAno: '',
    precoMin: '',
    precoMax: '',
    areaPrivativaMin: '',
    areaPrivativaMax: '',
    quartos: '',
    suites: '',
    banheiros: '',
    vagas: '',
    sacada: false
  });

  const [openNovoImovel, setOpenNovoImovel] = useState(false);
  const [tipoNovoImovel, setTipoNovoImovel] = useState<string | null>(null);
  const [empreendimentoId, setEmpreendimentoId] = useState<string | undefined>(undefined);
  const [apartamentoId, setApartamentoId] = useState<number | null>(null);
  const [openEditarApartamento, setOpenEditarApartamento] = useState(false);
  
  // Estados para modais de edição
  const [modalEditarOpen, setModalEditarOpen] = useState(false);
  const [imovelSelecionado, setImovelSelecionado] = useState<Imovel | null>(null);
  const [editarEmpreendimentoOpen, setEditarEmpreendimentoOpen] = useState(false);
  const [editarApartamentoModalOpen, setEditarApartamentoModalOpen] = useState(false);
  // Estado dos filtros com inicialização responsiva
  const [filtroExpandido, setFiltroExpandido] = useState(() => {
    if (typeof window !== 'undefined') {
      // Aberto por padrão em tablet e desktop
      return window.innerWidth >= 768;
    }
    return false;
  });

  // Função simples e direta para toggle
  const toggleFiltros = () => {
    setFiltroExpandido(prev => !prev);
  };

  // Função para abrir filtros
  const abrirFiltros = () => {
    setFiltroExpandido(true);
  };

  // Função para fechar filtros  
  const fecharFiltros = () => {
    setFiltroExpandido(false);
  };

  const [openConfirmarExclusao, setOpenConfirmarExclusao] = useState(false);
  const [, navigate] = useLocation();
  
  // Nova rota formatada para capturar tanto o empreendimentoId quanto o tipoImovel
  const [matchDetalhado, paramsDetalhado] = useRoute('/imoveis/:empreendimentoId/:tipoImovel');
  
  // Estado para armazenar os apartamentos
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  
  // Função para buscar os apartamentos do banco de dados
  const buscarApartamentos = async () => {
    setCarregando(true);
    setErro(null);
    
    try {
      const [respostaApartamentos, respostaEmpreendimentos] = await Promise.all([
        axios.get('/api/apartamentos'),
        axios.get('/api/empreendimentos-page')
      ]);
      
      // Atualizar as zonas dos imóveis usando o mapeamento local
      const apartamentosComZonas = atualizarZonasImoveisEmLote(respostaApartamentos.data);
      setApartamentos(apartamentosComZonas);
      setEmpreendimentos(respostaEmpreendimentos.data);
    } catch (error) {
      
      setErro('Falha ao carregar os apartamentos. Por favor, tente novamente.');
    } finally {
      setCarregando(false);
    }
  };
  
  // Efeito para buscar os apartamentos quando o componente for montado
  useEffect(() => {
    buscarApartamentos();
  }, []);

  // Função para excluir apartamento
  const excluirApartamento = async (apartamentoId: number) => {
    try {
      await axios.delete(`/api/apartamentos/${apartamentoId}`);
      toast({
        title: "Apartamento excluído com sucesso",
        variant: "default",
      });
      // Recarregar a lista de apartamentos
      buscarApartamentos();
    } catch (error) {
      console.error('Erro ao excluir apartamento:', error);
      toast({
        title: "Erro ao excluir apartamento",
        description: "Ocorreu um erro ao tentar excluir o apartamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  // Efeito para recolher filtro automaticamente após aplicar filtros em mobile
  useEffect(() => {
    // Verificar se há algum filtro aplicado
    const temFiltroAplicado = Object.entries(filtros).some(([key, value]) => {
      if (key === 'sacada') return value === true;
      return value !== '' && value !== false;
    });
    
    // Se há filtro aplicado e estamos em mobile e o filtro está expandido, recolher após um delay
    if (temFiltroAplicado && filtroExpandido && window.innerWidth < 768) {
      const timer = setTimeout(() => {
        fecharFiltros();
      }, 1500); // Recolhe após 1.5 segundos
      
      return () => clearTimeout(timer);
    }
  }, [filtros, filtroExpandido]); // Removido fecharFiltros da dependência
  
  // Efeito para definir estado inicial baseado no tamanho da tela
  useEffect(() => {
    const handleInitialState = () => {
      if (window.innerWidth >= 768) {
        abrirFiltros();
      }
    };
    
    // Configurar estado inicial apenas uma vez
    handleInitialState();
    
    // Removido o listener de resize para permitir controle manual
  }, []); // Sem dependências para executar apenas uma vez
  
  // Função para limpar todos os filtros
  const limparFiltros = () => {
    setFiltros({
      tipo: '',
      localizacao: '',
      zona: '',
      status: '',
      prazoEntregaMes: '',
      prazoEntregaAno: '',
      precoMin: '',
      precoMax: '',
      areaPrivativaMin: '',
      areaPrivativaMax: '',
      quartos: '',
      suites: '',
      banheiros: '',
      vagas: '',
      sacada: false
    });
  };

  // Verificar se há filtros aplicados
  const temFiltrosAplicados = Object.entries(filtros).some(([key, value]) => {
    if (key === 'sacada') return value === true;
    return value !== '' && value !== false;
  });
  
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const converterParaImoveis = (apartamentos: Apartamento[]): Imovel[] => {
    return apartamentos.map((apt) => {
      // Buscar o empreendimento correspondente para obter o status
      const empreendimento = empreendimentos.find(emp => emp.id === apt.id_empreendimento);
      
      return {
        id: apt.id_apartamento,
        tipo: 'Apartamento',
        titulo: apt.titulo_descritivo_apartamento || 
          `Apartamento ${apt.quartos_apartamento} quartos no ${apt.bairro_empreendimento || ''}`,
        preco: apt.valor_venda_apartamento || 0,
        localizacao: [
          apt.bairro_empreendimento, 
          apt.cidade_empreendimento
        ].filter(Boolean).join(', '),
        // Utiliza o valor da zona do banco de dados
        zona: apt.zona_empreendimento || '',
        imagem: apt.url_foto_capa_empreendimento || '/assets/img/apartamento-placeholder.jpg',
        quartos: apt.quartos_apartamento || 0,
        suites: apt.suites_apartamento || 0,
        banheiros: apt.banheiros_apartamento || 0,
        vagas: apt.vagas_garagem_apartamento || 0,
        areaPrivativa: apt.area_privativa_apartamento || 0,
        sacada: apt.sacada_varanda_apartamento || false,
        descricao: apt.descricao_apartamento || '',
        empreendimentoId: apt.id_empreendimento || 0,
        tipoGaragem: apt.tipo_garagem_apartamento || 'Não informado',
        status: empreendimento?.status || 'Não informado',
        prazoEntrega: apt.prazo_entrega_empreendimento || 'Não informado'
      };
    });
  };
  
  // Filtra os imóveis com base nos filtros aplicados
  const imoveis: Imovel[] = converterParaImoveis(apartamentos);
  
  const imoveisFiltrados = imoveis.filter((imovel: Imovel) => {
    // Filtrar por tipo de imóvel
    if (filtros.tipo && imovel.tipo !== filtros.tipo) {
      return false;
    }
    
    // Filtrar por zona
    if (filtros.zona && imovel.zona !== filtros.zona) {
      return false;
    }
    
    // Filtrar por status
    if (filtros.status && imovel.status !== filtros.status) {
      return false;
    }
    
    // Filtrar por prazo de entrega (até a data selecionada)
    if (filtros.prazoEntregaMes && filtros.prazoEntregaMes !== 'todos' && filtros.prazoEntregaAno) {
      // Extrair mês e ano do prazo de entrega do imóvel
      const prazoEntregaText = imovel.prazoEntrega.toLowerCase();
      
      // Mapeamento de meses para números
      const mesesMap: { [key: string]: number } = {
        'jan': 1, 'janeiro': 1,
        'fev': 2, 'fevereiro': 2,
        'mar': 3, 'março': 3,
        'abr': 4, 'abril': 4,
        'mai': 5, 'maio': 5,
        'jun': 6, 'junho': 6,
        'jul': 7, 'julho': 7,
        'ago': 8, 'agosto': 8,
        'set': 9, 'setembro': 9,
        'out': 10, 'outubro': 10,
        'nov': 11, 'novembro': 11,
        'dez': 12, 'dezembro': 12
      };
      
      // Encontrar mês no texto
      let mesImovel = 0;
      for (const [nomeMs, numeroMs] of Object.entries(mesesMap)) {
        if (prazoEntregaText.includes(nomeMs)) {
          mesImovel = numeroMs;
          break;
        }
      }
      
      // Encontrar ano no texto
      const anoMatch = prazoEntregaText.match(/20\d{2}/);
      const anoImovel = anoMatch ? parseInt(anoMatch[0]) : 0;
      
      // Se conseguiu extrair mês e ano, fazer a comparação
      if (mesImovel > 0 && anoImovel > 0) {
        const mesFilter = mesesMap[filtros.prazoEntregaMes];
        const anoFilter = parseInt(filtros.prazoEntregaAno);
        
        // Comparar ano primeiro, depois mês
        if (anoImovel > anoFilter || (anoImovel === anoFilter && mesImovel > mesFilter)) {
          return false; // Filtrar imóvel que entrega após a data limite
        }
      }
    }
    
    // Filtrar apenas por ano se apenas o ano estiver selecionado
    if ((!filtros.prazoEntregaMes || filtros.prazoEntregaMes === 'todos') && filtros.prazoEntregaAno) {
      const anoFilterNumber = parseInt(filtros.prazoEntregaAno);
      const prazoEntregaText = imovel.prazoEntrega.toLowerCase();
      
      // Identificar o ano no texto
      const anoMatch = prazoEntregaText.match(/20\d{2}/);
      if (anoMatch) {
        const anoImovel = parseInt(anoMatch[0]);
        
        // Mostrar apenas imóveis que entregam até o ano selecionado
        if (anoImovel > anoFilterNumber) {
          return false;
        }
      }
    }
    
    // Filtrar por preço mínimo
    if (filtros.precoMin && imovel.preco < Number(filtros.precoMin)) {
      return false;
    }
    
    // Filtrar por preço máximo
    if (filtros.precoMax && imovel.preco > Number(filtros.precoMax)) {
      return false;
    }
    
    // Filtrar por área privativa mínima
    if (filtros.areaPrivativaMin && imovel.areaPrivativa < Number(filtros.areaPrivativaMin)) {
      return false;
    }
    
    // Filtrar por área privativa máxima
    if (filtros.areaPrivativaMax && imovel.areaPrivativa > Number(filtros.areaPrivativaMax)) {
      return false;
    }
    
    // Filtrar por localização
    if (filtros.localizacao && !imovel.localizacao.toLowerCase().includes(filtros.localizacao.toLowerCase())) {
      return false;
    }
    
    // Filtrar por número de quartos
    if (filtros.quartos) {
      if (filtros.quartos === '4+' && imovel.quartos < 4) {
        return false;
      } else if (Number(filtros.quartos) !== imovel.quartos) {
        return false;
      }
    }
    
    // Filtrar por número de suítes
    if (filtros.suites) {
      if (filtros.suites === '4+' && imovel.suites < 4) {
        return false;
      } else if (Number(filtros.suites) !== imovel.suites) {
        return false;
      }
    }
    

    
    // Filtrar por número de vagas
    if (filtros.vagas) {
      if (filtros.vagas === '4+' && imovel.vagas < 4) {
        return false;
      } else if (Number(filtros.vagas) !== imovel.vagas) {
        return false;
      }
    }
    
    // Filtrar por sacada/varanda
    if (filtros.sacada && !imovel.sacada) {
      return false;
    }
    
    return true;
  });
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const empreendimentoIdParam = urlParams.get('empreendimentoId');
    
    if (empreendimentoIdParam) {
      setEmpreendimentoId(empreendimentoIdParam);
      setOpenNovoImovel(true);
      return;
    }
  }, []);
  
  // Verificar nova rota com parâmetros na URL
  useEffect(() => {
    
    // Verifica a nova rota estruturada
    if (matchDetalhado && paramsDetalhado?.empreendimentoId && paramsDetalhado?.tipoImovel) {
      
      setEmpreendimentoId(paramsDetalhado.empreendimentoId);
      setTipoNovoImovel(paramsDetalhado.tipoImovel);
      setOpenNovoImovel(true);
    }
  }, [matchDetalhado, paramsDetalhado]);

  const tiposImovel = [
    { label: 'Apartamentos', value: 'apartamento' },
    { label: 'Casas', value: 'casa' },
    { label: 'Casas em Condomínio', value: 'casa-condominio' },
    { label: 'Lotes', value: 'lote' },
  ];

  const statusImovel = {
    apartamento: ['Lançamento', 'Em construção', 'Novo', 'Usado'],
    casa: ['Lançamento', 'Em construção', 'Nova', 'Usada'],
    'casa-condominio': ['Lançamento', 'Em construção', 'Nova', 'Usada'],
    lote: ['Lançamento', 'Em construção', 'Novo'],
  };

  // Modal de seleção de edição
  const ModalEditar = () => (
    <Dialog open={modalEditarOpen} onOpenChange={setModalEditarOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Imóvel</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <Button onClick={() => { 
            setEditarEmpreendimentoOpen(true); 
            setModalEditarOpen(false); 
          }}>
            Editar Empreendimento
          </Button>
          <Button onClick={() => { 
            setEditarApartamentoModalOpen(true); 
            setModalEditarOpen(false); 
          }}>
            Editar Apartamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {/* Modal de edição principal */}
      <ModalEditar />
      
      {/* Modal para editar empreendimento usando NovoEmpreendimentoForm */}
      {editarEmpreendimentoOpen && imovelSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xxs:p-4">
          <div className="bg-white rounded-lg p-3 xxs:p-4 xs:p-6 w-full max-w-sm xxs:max-w-md xs:max-w-2xl sm:max-w-4xl max-h-screen overflow-y-auto">
            <NovoEmpreendimentoForm
              empreendimentoId={imovelSelecionado.empreendimentoId.toString()}
              onClose={() => setEditarEmpreendimentoOpen(false)}
              onSuccess={() => {
                setEditarEmpreendimentoOpen(false);
                buscarApartamentos();
              }}
            />
          </div>
        </div>
      )}
      
      {/* Modal para editar apartamento usando NovoImovelModal */}
      {editarApartamentoModalOpen && imovelSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 xxs:p-4">
          <div className="bg-white rounded-lg p-3 xxs:p-4 xs:p-6 w-full max-w-sm xxs:max-w-md xs:max-w-2xl sm:max-w-4xl max-h-screen overflow-y-auto">
            <NovoImovelModal
              empreendimentoId={imovelSelecionado.empreendimentoId.toString()}
              apartamentoId={imovelSelecionado.id}
              modo="editar"
              onClose={() => setEditarApartamentoModalOpen(false)}
              onSaveComplete={() => {
                setEditarApartamentoModalOpen(false);
                buscarApartamentos();
              }}
            />
          </div>
        </div>
      )}
    
    <div className="container mx-auto px-2 xxs:px-3 xs:px-4 xl:px-0 2xl:px-0 py-4 xxs:py-6 xs:py-8">
      <div className="flex justify-end items-center mb-4 xxs:mb-6 xs:mb-8">
        {/* Layout horizontal alinhado à direita */}
        <div className="flex flex-wrap items-center gap-2 xxs:gap-3">
          {/* Barra de busca */}
          <div className="relative">
            <Search className="absolute left-2 xxs:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 xxs:h-4 xxs:w-4" />
            <Input
              type="text"
              placeholder="Buscar imóveis..."
              className="pl-8 xxs:pl-10 text-xs xxs:text-sm h-8 xxs:h-9 sm:h-10 w-48 xxs:w-56 sm:w-64"
            />
          </div>
          
          {/* Botões */}
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-1 xxs:gap-2 px-2 xxs:px-3 py-1 xxs:py-2 text-xs xxs:text-sm h-8 xxs:h-9 sm:h-10"
            onClick={() => navigate('/proprietarios')}
          >
            <span className="hidden sm:inline">Proprietários</span>
            <span className="sm:hidden">Prop.</span>
          </Button>
          
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-1 xxs:gap-2 px-2 xxs:px-3 py-1 xxs:py-2 text-xs xxs:text-sm h-8 xxs:h-9 sm:h-10"
            onClick={() => navigate('/empreendimentos')}
          >
            <span className="hidden sm:inline">Empreendimentos</span>
            <span className="sm:hidden">Empr.</span>
          </Button>
          
          <Dialog open={openNovoImovel} onOpenChange={setOpenNovoImovel}>
            <DialogTrigger asChild>
              <Button className="flex items-center justify-center gap-1 xxs:gap-2 bg-primary text-white px-2 xxs:px-3 py-1 xxs:py-2 text-xs xxs:text-sm h-8 xxs:h-9 sm:h-10" onClick={() => setTipoNovoImovel(null)}>
                <Plus className="h-3 w-3 xxs:h-4 xxs:w-4" />
                <span className="hidden xs:inline">Novo Imóvel</span>
                <span className="xs:hidden">Novo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-full mx-2 xxs:mx-4">
              <DialogHeader>
                <DialogTitle className="text-base xxs:text-lg">Novo Imóvel</DialogTitle>
              </DialogHeader>
              <NovoImovelModal 
                empreendimentoId={empreendimentoId} 
                tipoImovel={tipoNovoImovel || undefined}
                onClose={() => setOpenNovoImovel(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Modal de Edição de Apartamento */}
      <Dialog open={openEditarApartamento} onOpenChange={setOpenEditarApartamento}>
            <DialogContent className="max-w-lg w-full mx-2 xxs:mx-4">
              <DialogHeader>
                <DialogTitle className="text-base xxs:text-lg">Editar Apartamento</DialogTitle>
              </DialogHeader>
              {apartamentoId && (
                <NovoImovelModal 
                  empreendimentoId={imoveis.find(i => i.id === apartamentoId)?.empreendimentoId?.toString()}
                  tipoImovel="apartamento" 
                  modo="editar"
                  apartamentoId={apartamentoId}
                  onClose={() => setOpenEditarApartamento(false)}
                  onSaveComplete={() => {
                    setOpenEditarApartamento(false);
                    buscarApartamentos();
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
          
          {/* Modal de Confirmação de Exclusão */}
          <AlertDialog open={openConfirmarExclusao} onOpenChange={setOpenConfirmarExclusao}>
            <AlertDialogContent className="mx-2 xxs:mx-4">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base xxs:text-lg">Excluir Apartamento</AlertDialogTitle>
                <AlertDialogDescription className="text-sm xxs:text-base">
                  Tem certeza que deseja excluir este apartamento? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="text-xs xxs:text-sm">Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-red-600 hover:bg-red-700 text-xs xxs:text-sm"
                  onClick={async () => {
                    if (apartamentoId) {
                      try {
                        await axios.delete(`/api/apartamentos/${apartamentoId}`);
                        toast({
                          title: "Apartamento excluído com sucesso",
                          variant: "default",
                        });
                        buscarApartamentos();
                      } catch (error) {
                        
                        toast({
                          title: "Erro ao excluir apartamento",
                          description: "Ocorreu um erro ao tentar excluir o apartamento. Tente novamente.",
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        
      <div className="flex flex-col lg:flex-row gap-4 xxs:gap-6 xs:gap-8">
        {/* Menu Lateral de Filtros */}
        <div className={`
          bg-white rounded-lg shadow-md overflow-hidden
          w-full lg:w-1/4
          transition-all duration-300 ease-in-out
        `}>
          {/* Cabeçalho do filtro */}
          <div 
            className="flex justify-between items-center p-3 xxs:p-4 xs:p-6 cursor-pointer"
            onClick={toggleFiltros}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-base xxs:text-lg xs:text-xl font-semibold">Filtros</h2>
              {/* Indicador de filtros aplicados */}
              {temFiltrosAplicados && (
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="h-4 w-4 xxs:h-5 xxs:w-5 p-0 flex items-center justify-center">
                    <span className="text-xs">{Object.values(filtros).filter(v => v !== '' && v !== false).length}</span>
                  </Badge>
                  {/* Botão limpar filtros */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-500 hover:text-gray-700 p-1 h-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      limparFiltros();
                    }}
                    title="Limpar filtros"
                  >
                    Limpar
                  </Button>
                </div>
              )}
            </div>
            
            {/* Ícone de expansão */}
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-6 w-6 xxs:h-8 xxs:w-8"
              onClick={toggleFiltros}
            >
              {filtroExpandido ? (
                <ChevronUp className="h-3 w-3 xxs:h-4 xxs:w-4" />
              ) : (
                <ChevronDown className="h-3 w-3 xxs:h-4 xxs:w-4" />
              )}
            </Button>
          </div>
          
          {/* Conteúdo do filtro */}
          <div className={`
            px-3 xxs:px-4 xs:px-6
            pb-3 xxs:pb-4 xs:pb-6
            overflow-hidden transition-all duration-300 ease-in-out
            ${filtroExpandido 
              ? 'max-h-screen opacity-100' 
              : 'max-h-0 opacity-0'
            }
          `}>
            <div className="space-y-3 xxs:space-y-4 xs:space-y-6">
            {/* Localização */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Localização
              </label>
              <div className="relative">
                <MapPin className="absolute left-2 xxs:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-3 w-3 xxs:h-4 xxs:w-4" />
                <Input
                  type="text"
                  placeholder="Bairro, cidade..."
                  className="pl-8 xxs:pl-10 text-xs xxs:text-sm h-8 xxs:h-9 sm:h-10"
                  value={filtros.localizacao}
                  onChange={(e) => setFiltros({ ...filtros, localizacao: e.target.value })}
                />
              </div>
            </div>

            {/* Zona da Cidade */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Zona da Cidade
              </label>
              <Select
                value={filtros.zona}
                onValueChange={(value) => setFiltros({ ...filtros, zona: value })}
              >
                <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                  <SelectValue placeholder="Selecione a zona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="norte">Zona Norte</SelectItem>
                  <SelectItem value="sul">Zona Sul</SelectItem>
                  <SelectItem value="leste">Zona Leste</SelectItem>
                  <SelectItem value="oeste">Zona Oeste</SelectItem>
                  <SelectItem value="centro">Centro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Imóvel */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Tipo de Imóvel
              </label>
              <Select
                value={filtros.tipo}
                onValueChange={(value) => setFiltros({ ...filtros, tipo: value })}
              >
                <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposImovel.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Status
              </label>
              <Select
                value={filtros.status}
                onValueChange={(value) => setFiltros({ ...filtros, status: value })}
              >
                <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pronto">Pronto</SelectItem>
                  <SelectItem value="Lançamento">Lançamento</SelectItem>
                  <SelectItem value="Em Construção">Em Construção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prazo de Entrega */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Prazo de Entrega
              </label>
              <div className="flex gap-2">
                <Select
                  value={filtros.prazoEntregaMes}
                  onValueChange={(value) => setFiltros({ ...filtros, prazoEntregaMes: value })}
                >
                  <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="janeiro">Janeiro</SelectItem>
                    <SelectItem value="fevereiro">Fevereiro</SelectItem>
                    <SelectItem value="março">Março</SelectItem>
                    <SelectItem value="abril">Abril</SelectItem>
                    <SelectItem value="maio">Maio</SelectItem>
                    <SelectItem value="junho">Junho</SelectItem>
                    <SelectItem value="julho">Julho</SelectItem>
                    <SelectItem value="agosto">Agosto</SelectItem>
                    <SelectItem value="setembro">Setembro</SelectItem>
                    <SelectItem value="outubro">Outubro</SelectItem>
                    <SelectItem value="novembro">Novembro</SelectItem>
                    <SelectItem value="dezembro">Dezembro</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filtros.prazoEntregaAno}
                  onValueChange={(value) => setFiltros({ ...filtros, prazoEntregaAno: value })}
                >
                  <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                    <SelectItem value="2028">2028</SelectItem>
                    <SelectItem value="2029">2029</SelectItem>
                    <SelectItem value="2030">2030</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Faixa de Preço */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Faixa de Preço
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Mínimo"
                  className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm"
                  value={filtros.precoMin}
                  onChange={(e) => setFiltros({ ...filtros, precoMin: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Máximo"
                  className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm"
                  value={filtros.precoMax}
                  onChange={(e) => setFiltros({ ...filtros, precoMax: e.target.value })}
                />
              </div>
            </div>

            {/* Área Privativa */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Área Privativa (m²)
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Mínimo"
                  className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm"
                  value={filtros.areaPrivativaMin}
                  onChange={(e) => setFiltros({ ...filtros, areaPrivativaMin: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="Máximo"
                  className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm"
                  value={filtros.areaPrivativaMax}
                  onChange={(e) => setFiltros({ ...filtros, areaPrivativaMax: e.target.value })}
                />
              </div>
            </div>

            {/* Quartos e Suítes */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Quartos e Suítes
              </label>
              <div className="flex gap-2">
                <Select
                  value={filtros.quartos}
                  onValueChange={(value) => setFiltros({ ...filtros, quartos: value })}
                >
                  <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                    <SelectValue placeholder="Quartos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 quarto</SelectItem>
                    <SelectItem value="2">2 quartos</SelectItem>
                    <SelectItem value="3">3 quartos</SelectItem>
                    <SelectItem value="4">4 quartos</SelectItem>
                    <SelectItem value="5+">5+ quartos</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filtros.suites}
                  onValueChange={(value) => setFiltros({ ...filtros, suites: value })}
                >
                  <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                    <SelectValue placeholder="Suítes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 suíte</SelectItem>
                    <SelectItem value="2">2 suítes</SelectItem>
                    <SelectItem value="3">3 suítes</SelectItem>
                    <SelectItem value="4+">4+ suítes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vagas de Garagem */}
            <div>
              <label className="block text-xs xxs:text-sm font-medium text-gray-700 mb-1 xxs:mb-2">
                Vagas de Garagem
              </label>
              <Select
                value={filtros.vagas}
                onValueChange={(value) => setFiltros({ ...filtros, vagas: value })}
              >
                <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                  <SelectValue placeholder="Número de vagas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 vaga</SelectItem>
                  <SelectItem value="2">2 vagas</SelectItem>
                  <SelectItem value="3">3 vagas</SelectItem>
                  <SelectItem value="4+">4+ vagas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sacada/Varanda */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sacada"
                checked={filtros.sacada}
                onCheckedChange={(checked) => setFiltros({ ...filtros, sacada: checked as boolean })}
                className="h-3 w-3 xxs:h-4 xxs:w-4"
              />
              <label
                htmlFor="sacada"
                className="text-xs xxs:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Sacada/Varanda
              </label>
            </div>
            </div>
          </div>
        </div>

        {/* Lista de Imóveis */}
        <div className="w-full lg:w-3/4">
          {carregando ? (
            <div className="flex justify-center items-center h-40">
              <p className="text-sm xxs:text-base">Carregando imóveis...</p>
            </div>
          ) : erro ? (
            <div className="bg-red-50 p-3 xxs:p-4 rounded-lg border border-red-200">
              <p className="text-red-600 text-sm xxs:text-base">{erro}</p>
              <Button variant="outline" className="mt-2 text-xs xxs:text-sm" onClick={buscarApartamentos}>
                Tentar novamente
              </Button>
            </div>
          ) : imoveisFiltrados.length === 0 ? (
            <div className="bg-gray-50 p-4 xxs:p-6 rounded-lg text-center">
              <Building className="h-8 w-8 xxs:h-10 xxs:w-10 xs:h-12 xs:w-12 mx-auto text-gray-400 mb-2 xxs:mb-4" />
              <h3 className="text-base xxs:text-lg font-medium mb-1 xxs:mb-2">Nenhum imóvel encontrado</h3>
              <p className="text-gray-500 text-sm xxs:text-base">Não foram encontrados imóveis com os critérios selecionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 xxs:gap-4 xs:gap-6">
              {imoveisFiltrados.map((imovel: Imovel) => (
                <Card 
                  key={imovel.id} 
                  className="overflow-hidden group hover:shadow-lg transition-all duration-300 border border-gray-100 cursor-pointer"
                  onClick={() => navigate(`/empreendimento/${imovel.empreendimentoId}`)}
                >
                  <div className="relative">
                    <img
                      src={imovel.imagem}
                      alt={imovel.titulo}
                      className="w-full h-32 xxs:h-36 xs:h-40 sm:h-48 object-cover"
                    />
                    <div className="absolute top-1 xxs:top-2 right-1 xxs:right-2 bg-white px-1 xxs:px-2 py-0.5 xxs:py-1 rounded text-xs xxs:text-sm font-medium">
                      {imovel.tipo}
                    </div>
                  </div>
                  <CardContent className="p-2 xxs:p-3 xs:p-4">
                    <h3 className="text-sm xxs:text-base xs:text-lg font-semibold mb-1 xxs:mb-2 line-clamp-2">{imovel.titulo}</h3>
                    <p className="text-gray-600 mb-2 xxs:mb-3 xs:mb-4 flex items-center gap-1">
                      <MapPin className="h-3 w-3 xxs:h-4 xxs:w-4" />
                      <span className="text-xs xxs:text-sm">{imovel.localizacao}</span>
                      {imovel.zona && <span className="text-xs text-gray-500">({imovel.zona})</span>}
                    </p>
                    <div className="flex flex-wrap gap-2 xxs:gap-3 xs:gap-4 mb-2 xxs:mb-3 xs:mb-4">
                      <div className="flex items-center gap-1" title="Quartos">
                        <Bed className="h-3 w-3 xxs:h-4 xxs:w-4 text-gray-500" />
                        <span className="text-xs xxs:text-sm">{imovel.quartos} quarto{imovel.quartos > 1 ? 's' : ''}</span>
                      </div>
                      {imovel.suites > 0 && (
                        <div className="flex items-center gap-1" title="Suítes">
                          <Bath className="h-3 w-3 xxs:h-4 xxs:w-4 text-gray-500" />
                          <span className="text-xs xxs:text-sm">{imovel.suites} suíte{imovel.suites > 1 ? 's' : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1" title="Banheiros">
                        <Bath className="h-3 w-3 xxs:h-4 xxs:w-4 text-gray-500" />
                        <span className="text-xs xxs:text-sm">{imovel.banheiros} banh.</span>
                      </div>
                      {imovel.vagas > 0 && (
                        <div className="flex items-center gap-1" title="Vagas">
                          <Car className="h-3 w-3 xxs:h-4 xxs:w-4 text-gray-500" />
                          <span className="text-xs xxs:text-sm">{imovel.vagas} vaga{imovel.vagas > 1 ? 's' : ''}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1" title="Área Privativa">
                        <Ruler className="h-3 w-3 xxs:h-4 xxs:w-4 text-gray-500" />
                        <span className="text-xs xxs:text-sm">{imovel.areaPrivativa}m²</span>
                      </div>
                      {imovel.sacada && (
                        <div className="flex items-center gap-1" title="Sacada/Varanda">
                          <Home className="h-3 w-3 xxs:h-4 xxs:w-4 text-gray-500" />
                          <span className="text-xs xxs:text-sm">Sacada</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-bold text-primary">
                        {formatarMoeda(imovel.preco)}
                      </div>
                      <div className="flex items-center gap-1 xxs:gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-1 xxs:p-2 h-auto w-auto"
                          onClick={e => {
                            e.stopPropagation();
                            setImovelSelecionado(imovel);
                            setModalEditarOpen(true);
                          }}
                          title="Editar imóvel"
                        >
                          <Pencil className="h-3 w-3 xxs:h-4 xxs:w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="p-1 xxs:p-2 h-auto w-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={e => {
                            e.stopPropagation();
                            excluirApartamento(imovel.id);
                          }}
                          title="Excluir apartamento"
                        >
                          <Trash2 className="h-3 w-3 xxs:h-4 xxs:w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
};

export default Imoveis; 
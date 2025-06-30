import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, MapPin, Bed, Bath, Ruler, Plus, Home, Building, Car, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
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
  
  // Estado para controlar qual tipo de novo imóvel será criado
  const [tipoNovoImovel, setTipoNovoImovel] = useState<string | null>(null);
  const empreendimentoId = paramsDetalhado?.empreendimentoId;

  // Função para buscar apartamentos
  const buscarApartamentos = async () => {
    try {
      setCarregando(true);
      setErro(null);
      
      const response = await axios.get('/api/imoveis-page/apartamentos');
      
      if (response.data && Array.isArray(response.data)) {
        setApartamentos(response.data);
      } else {
        setApartamentos([]);
      }
    } catch (error) {
      console.error('Erro ao buscar apartamentos:', error);
      setErro('Erro ao carregar imóveis. Tente novamente.');
      setApartamentos([]);
    } finally {
      setCarregando(false);
    }
  };

  // Função para buscar empreendimentos
  const buscarEmpreendimentos = async () => {
    try {
      const response = await axios.get('/api/empreendimentos-page');
      
      if (response.data && Array.isArray(response.data)) {
        setEmpreendimentos(response.data);
      } else {
        setEmpreendimentos([]);
      }
    } catch (error) {
      console.error('Erro ao buscar empreendimentos:', error);
      setEmpreendimentos([]);
    }
  };

  // Carregar dados ao inicializar o componente
  useEffect(() => {
    buscarApartamentos();
    buscarEmpreendimentos();
  }, []);

  // Efeito para verificar se há um tipo específico na URL e abrir o modal
  useEffect(() => {
    if (matchDetalhado && paramsDetalhado?.tipoImovel) {
      setTipoNovoImovel(paramsDetalhado.tipoImovel);
    }
  }, [matchDetalhado, paramsDetalhado]);

  // Função para converter apartamentos em imóveis para exibição
  const converterParaImoveis = (apartamentos: Apartamento[]): Imovel[] => {
    return apartamentos.map(apt => ({
      id: apt.id_apartamento,
      tipo: 'Apartamento',
      titulo: apt.titulo_descritivo_apartamento || `Apartamento ${apt.quartos_apartamento} quartos`,
      preco: apt.valor_venda_apartamento,
      localizacao: `${apt.bairro_empreendimento || ''}, ${apt.cidade_empreendimento || ''}`.replace(/^, |, $/, ''),
      zona: apt.zona_empreendimento || '',
      imagem: apt.url_foto_capa_empreendimento || '/placeholder-user.png',
      quartos: apt.quartos_apartamento,
      suites: apt.suites_apartamento,
      banheiros: apt.banheiros_apartamento,
      vagas: apt.vagas_garagem_apartamento,
      areaPrivativa: apt.area_privativa_apartamento,
      sacada: apt.sacada_varanda_apartamento,
      descricao: apt.descricao_apartamento || '',
      empreendimentoId: apt.id_empreendimento,
      tipoGaragem: apt.tipo_garagem_apartamento || '',
      status: 'Disponível',
      prazoEntrega: apt.prazo_entrega_empreendimento || ''
    }));
  };

  // Aplicar filtros aos imóveis
  const imoveis: Imovel[] = converterParaImoveis(apartamentos);
  
  const imoveisFiltrados = imoveis.filter((imovel: Imovel) => {
    // Filtro por tipo
    if (filtros.tipo && filtros.tipo !== 'todos' && filtros.tipo !== imovel.tipo) {
      return false;
    }

    // Filtro por localização (busca em zona, bairro ou cidade)
    if (filtros.localizacao) {
      const localizacaoBusca = filtros.localizacao.toLowerCase();
      const localizacaoImovel = imovel.localizacao.toLowerCase();
      const zonaImovel = imovel.zona.toLowerCase();
      
      if (!localizacaoImovel.includes(localizacaoBusca) && !zonaImovel.includes(localizacaoBusca)) {
        return false;
      }
    }

    // Filtro por zona específica
    if (filtros.zona && filtros.zona !== 'todas' && filtros.zona !== imovel.zona) {
      return false;
    }

    // Filtro por status
    if (filtros.status && filtros.status !== 'todos' && filtros.status !== imovel.status) {
      return false;
    }

    // Filtro por preço
    if (filtros.precoMin && imovel.preco < parseFloat(filtros.precoMin)) {
      return false;
    }
    if (filtros.precoMax && imovel.preco > parseFloat(filtros.precoMax)) {
      return false;
    }

    // Filtro por área privativa
    if (filtros.areaPrivativaMin && imovel.areaPrivativa < parseFloat(filtros.areaPrivativaMin)) {
      return false;
    }
    if (filtros.areaPrivativaMax && imovel.areaPrivativa > parseFloat(filtros.areaPrivativaMax)) {
      return false;
    }

    // Filtros por quantidade de cômodos
    if (filtros.quartos && imovel.quartos !== parseInt(filtros.quartos)) {
      return false;
    }
    if (filtros.suites && imovel.suites !== parseInt(filtros.suites)) {
      return false;
    }
    if (filtros.banheiros && imovel.banheiros !== parseInt(filtros.banheiros)) {
      return false;
    }
    if (filtros.vagas && imovel.vagas !== parseInt(filtros.vagas)) {
      return false;
    }

    // Filtro por sacada
    if (filtros.sacada && !imovel.sacada) {
      return false;
    }

    return true;
  });

  // Função para resetar filtros
  const resetarFiltros = () => {
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

  // Modal para escolher tipo de edição
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
              empreendimentoId={imovelSelecionado.empreendimentoId}
              apartamentoId={imovelSelecionado.id}
              modo="editar"
              onClose={() => setEditarApartamentoModalOpen(false)}
              onSuccess={() => {
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
            <Home className="h-3 w-3 xxs:h-4 xxs:w-4" />
            <span className="hidden xs:inline">Proprietários</span>
          </Button>
          
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-1 xxs:gap-2 px-2 xxs:px-3 py-1 xxs:py-2 text-xs xxs:text-sm h-8 xxs:h-9 sm:h-10"
            onClick={() => navigate('/empreendimentos')}
          >
            <Building className="h-3 w-3 xxs:h-4 xxs:w-4" />
            <span className="hidden xs:inline">Empreendimentos</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex items-center justify-center gap-1 xxs:gap-2 px-2 xxs:px-3 py-1 xxs:py-2 text-xs xxs:text-sm h-8 xxs:h-9 sm:h-10"
            onClick={toggleFiltros}
          >
            <SlidersHorizontal className="h-3 w-3 xxs:h-4 xxs:w-4" />
            <span className="hidden sm:inline">Filtros</span>
            {filtroExpandido ? (
              <ChevronUp className="h-3 w-3 xxs:h-4 xxs:w-4 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 xxs:h-4 xxs:w-4 ml-1" />
            )}
          </Button>
        </div>
      </div>

      {/* Painel de Filtros Responsivo */}
      {filtroExpandido && (
        <Card className="mb-4 xxs:mb-6 xs:mb-8">
          <CardContent className="p-3 xxs:p-4 xs:p-6">
            <div className="space-y-3 xxs:space-y-4">
              {/* Primeira linha - Filtros básicos */}
              <div className="grid grid-cols-1 xxs:grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 xxs:gap-4">
                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Tipo</label>
                  <Select value={filtros.tipo} onValueChange={(value) => setFiltros({...filtros, tipo: value})}>
                    <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Apartamento">Apartamento</SelectItem>
                      <SelectItem value="Casa">Casa</SelectItem>
                      <SelectItem value="Sobrado">Sobrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Zona</label>
                  <Select value={filtros.zona} onValueChange={(value) => setFiltros({...filtros, zona: value})}>
                    <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="Zona Sul">Zona Sul</SelectItem>
                      <SelectItem value="Zona Norte">Zona Norte</SelectItem>
                      <SelectItem value="Zona Leste">Zona Leste</SelectItem>
                      <SelectItem value="Zona Oeste">Zona Oeste</SelectItem>
                      <SelectItem value="Centro">Centro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Status</label>
                  <Select value={filtros.status} onValueChange={(value) => setFiltros({...filtros, status: value})}>
                    <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="Disponível">Disponível</SelectItem>
                      <SelectItem value="Reservado">Reservado</SelectItem>
                      <SelectItem value="Vendido">Vendido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Quartos</label>
                  <Select value={filtros.quartos} onValueChange={(value) => setFiltros({...filtros, quartos: value})}>
                    <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Vagas</label>
                  <Select value={filtros.vagas} onValueChange={(value) => setFiltros({...filtros, vagas: value})}>
                    <SelectTrigger className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Segunda linha - Filtros de valores */}
              <div className="grid grid-cols-1 xxs:grid-cols-2 sm:grid-cols-4 gap-3 xxs:gap-4">
                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Preço mín</label>
                  <Input
                    type="number"
                    placeholder="R$ 0"
                    value={filtros.precoMin}
                    onChange={(e) => setFiltros({...filtros, precoMin: e.target.value})}
                    className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Preço máx</label>
                  <Input
                    type="number"
                    placeholder="R$ 999999"
                    value={filtros.precoMax}
                    onChange={(e) => setFiltros({...filtros, precoMax: e.target.value})}
                    className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Área mín (m²)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filtros.areaPrivativaMin}
                    onChange={(e) => setFiltros({...filtros, areaPrivativaMin: e.target.value})}
                    className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs xxs:text-sm font-medium mb-1 xxs:mb-2">Área máx (m²)</label>
                  <Input
                    type="number"
                    placeholder="999"
                    value={filtros.areaPrivativaMax}
                    onChange={(e) => setFiltros({...filtros, areaPrivativaMax: e.target.value})}
                    className="h-8 xxs:h-9 sm:h-10 text-xs xxs:text-sm"
                  />
                </div>
              </div>

              {/* Terceira linha - Filtros adicionais */}
              <div className="flex flex-wrap items-center gap-3 xxs:gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sacada"
                    checked={filtros.sacada}
                    onCheckedChange={(checked) => setFiltros({...filtros, sacada: checked as boolean})}
                  />
                  <label
                    htmlFor="sacada"
                    className="text-xs xxs:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Com sacada/varanda
                  </label>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex justify-end gap-2 xxs:gap-3 pt-2 xxs:pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetarFiltros}
                  className="text-xs xxs:text-sm h-8 xxs:h-9"
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={fecharFiltros}
                  className="text-xs xxs:text-sm h-8 xxs:h-9"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid de Imóveis */}
      <div className="space-y-4 xxs:space-y-6">
        {/* Cabeçalho com quantidade */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg xxs:text-xl xs:text-2xl font-bold">
            Imóveis ({imoveisFiltrados.length})
          </h2>
        </div>

        {/* Estados de carregamento e erro */}
        {carregando && (
          <div className="text-center py-8 xxs:py-12">
            <p className="text-gray-500 text-sm xxs:text-base">Carregando imóveis...</p>
          </div>
        )}

        {erro && (
          <div className="text-center py-8 xxs:py-12">
            <p className="text-red-500 text-sm xxs:text-base">{erro}</p>
            <Button 
              onClick={buscarApartamentos} 
              className="mt-4 text-xs xxs:text-sm"
              variant="outline"
            >
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Lista de imóveis */}
        {!carregando && !erro && (
          <>
            {imoveisFiltrados.length === 0 ? (
              <div className="text-center py-8 xxs:py-12">
                <p className="text-gray-500 text-sm xxs:text-base mb-4">
                  Nenhum imóvel encontrado com os filtros aplicados.
                </p>
                <Button 
                  onClick={resetarFiltros} 
                  variant="outline"
                  className="text-xs xxs:text-sm"
                >
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xxs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 xxs:gap-4 xs:gap-6">
                {imoveisFiltrados.map((imovel) => (
                  <Card key={imovel.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="relative">
                      <img
                        src={imovel.imagem}
                        alt={imovel.titulo}
                        className="w-full h-32 xxs:h-40 xs:h-48 object-cover"
                      />
                      <Badge 
                        className="absolute top-2 left-2 text-xs"
                        variant={imovel.status === 'Disponível' ? 'default' : 'secondary'}
                      >
                        {imovel.status}
                      </Badge>
                      <Badge className="absolute top-2 right-2 text-xs">
                        {imovel.tipo}
                      </Badge>
                    </div>
                    <CardContent className="p-3 xxs:p-4">
                      <div className="space-y-2 xxs:space-y-3">
                        <h3 className="font-semibold text-sm xxs:text-base line-clamp-2">
                          {imovel.titulo}
                        </h3>
                        
                        <div className="flex items-center gap-1 text-gray-600">
                          <MapPin className="h-3 w-3 xxs:h-4 xxs:w-4" />
                          <span className="text-xs xxs:text-sm truncate">{imovel.localizacao}</span>
                        </div>

                        <div className="text-lg xxs:text-xl font-bold text-blue-600">
                          R$ {imovel.preco.toLocaleString('pt-BR')}
                        </div>

                        <div className="grid grid-cols-4 gap-1 xxs:gap-2 text-xs xxs:text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Bed className="h-3 w-3 xxs:h-4 xxs:w-4" />
                            <span>{imovel.quartos}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Bath className="h-3 w-3 xxs:h-4 xxs:w-4" />
                            <span>{imovel.banheiros}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Car className="h-3 w-3 xxs:h-4 xxs:w-4" />
                            <span>{imovel.vagas}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Ruler className="h-3 w-3 xxs:h-4 xxs:w-4" />
                            <span>{imovel.areaPrivativa}m²</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                          <div className="text-xs text-gray-500">
                            {imovel.zona && <span>{imovel.zona}</span>}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs px-2 py-1 h-auto"
                            onClick={e => {
                              e.stopPropagation();
                              setImovelSelecionado(imovel);
                              setModalEditarOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal para adicionar novo apartamento (apenas se estiver na rota específica) */}
      {matchDetalhado && empreendimentoId && tipoNovoImovel && (
        <Dialog open={true} onOpenChange={() => navigate('/imoveis')}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base xxs:text-lg">Novo {tipoNovoImovel}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <NovoImovelModal empreendimentoId={empreendimentoId} tipoImovel={tipoNovoImovel || undefined} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal existente para editar apartamento específico */}
      <Dialog open={openEditarApartamento} onOpenChange={setOpenEditarApartamento}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base xxs:text-lg">Editar Apartamento</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <NovoImovelModal 
              empreendimentoId={empreendimentoId || 0}
              apartamentoId={apartamentoId}
              modo="editar"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};

export default Imoveis;

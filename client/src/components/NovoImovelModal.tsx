import React, { useState, useEffect, ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useLocation } from 'wouter';

// Interface para o tipo de Empreendimento
interface Empreendimento {
  id_empreendimento: number;
  nome_empreendimento: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  blocos: string;
  andares: string;
  aptos_por_andar: string;
  valor_condominio: string;
  nome_proprietario: string;
  razao_social: string;
  cpf_cnpj: string;
  email: string;
  telefone: string;
}

// Interface para o formulário de empreendimento
interface FormEmpreendimento {
  nomeEmpreendimento: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  blocos: string;
  andares: string;
  aptosPorAndar: string;
  valorCondominio: string;
  nomeProprietario: string;
  razaoSocial: string;
  cpfCnpj: string;
  emailProprietario: string;
  telefoneProprietario: string;
}

// Interface para os dados do imóvel
interface DadosImovel {
  tipoImovel: string | null;
  id_empreendimento?: number;
  nomeEmpreendimento?: string;
  endereco?: {
    rua: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
  detalhesEmpreendimento?: {
    blocos: string;
    andares: string;
    aptosPorAndar: string;
    valorCondominio: string;
    servicos: string[];
    lazer: string[];
  };
  dadosProprietario?: {
    nome: string;
    razaoSocial: string;
    cpfCnpj: string;
    email: string;
    telefone: string;
  };
  apartamentos?: Array<{
    status: string;
    areaPrivativa: number;
    quartos: number;
    suites: number;
    banheiros: number;
    vagas: number;
    tipoVaga: string;
    sacada: string;
    caracteristicas: string[];
  }>;
  informacoesComerciais: {
    valorVenda: string;
    titulo: string;
    descricao: string;
    statusPublicacao: string;
  };
}

// Tipo para eventos de input para evitar erros de tipo 'any'
type InputChangeEvent = ChangeEvent<HTMLInputElement>;
type SelectChangeEvent = ChangeEvent<HTMLSelectElement>;

const tiposImovel = [
  'Apartamento',
  'Casa',
  'Casa Condomínio',
  'Lote',
];

// Função para buscar endereço pelo Google Maps Geocoding API
async function buscarEnderecoPorRuaNumero(rua: string, numero: string) {
  const apiKey = 'AIzaSyCGpudo_9LvuY9f7P4P3Ub61aIHGcck5d0';
  const endereco = encodeURIComponent(`${rua}, ${numero}`);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${endereco}&region=br&key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.status === 'OK') {
    const result = data.results[0];
    const components = result.address_components;
    const getComp = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || '';
    const getCompShort = (type: string) => components.find((c: any) => c.types.includes(type))?.short_name || '';
    // Forçar a sigla da UF para o campo estado
    const uf = getCompShort('administrative_area_level_1');
    return {
      bairro: getComp('sublocality') || getComp('political'),
      cidade: getComp('administrative_area_level_2'),
      estado: uf.length === 2 ? uf : '',
      cep: getComp('postal_code'),
    };
  }
  return null;
}

// Função utilitária para formatar moeda brasileira
function formatarMoedaBR(valor: string) {
  const numero = Number(valor.replace(/\D/g, '')) / 100;
  if (isNaN(numero)) return '';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface NovoImovelModalProps {
  empreendimentoId?: string;
  tipoImovel?: string;
  modo?: 'criar' | 'editar';
  apartamentoId?: number;
  onSaveComplete?: () => void;
  onClose?: () => void;
}

export function NovoImovelModal({ 
  empreendimentoId, 
  tipoImovel: tipoImovelProp, 
  modo = 'criar', 
  apartamentoId,
  onSaveComplete,
  onClose
}: NovoImovelModalProps) {
  
  const [etapa, setEtapa] = useState(1);
  // Normaliza o tipo de imóvel para formato capitalizado
  const normalizarTipoImovel = (tipo?: string): string | null => {
    if (!tipo) return 'Apartamento'; // Default é Apartamento
    
    // Converter para formato capitalizado "Apartamento"
    if (tipo.toLowerCase() === 'apartamento') return 'Apartamento';
    // Outros tipos se necessário
    return 'Apartamento'; // Por enquanto só permitimos Apartamento
  };
  
  const [tipoImovel, setTipoImovel] = useState<string | null>(normalizarTipoImovel(tipoImovelProp));
  
  // Estados para busca de empreendimentos
  const [termoBusca, setTermoBusca] = useState('');
  const [empreendimentosEncontrados, setEmpreendimentosEncontrados] = useState<Empreendimento[]>([]);
  const [empreendimentoSelecionado, setEmpreendimentoSelecionado] = useState<Empreendimento | null>(null);
  const [mostrarListaEmpreendimentos, setMostrarListaEmpreendimentos] = useState(false);

  // Função para buscar empreendimentos
  const buscarEmpreendimentos = async (termo: string) => {
    if (termo.length >= 3) {
      try {
        const response = await axios.get(`/api/empreendimentos/buscar`, { 
          params: { termo }
        });
        // Mapear os dados retornados para o formato da interface Empreendimento
        const empreendimentosMapeados = response.data.map((emp: any) => ({
          id_empreendimento: emp.id,
          nome_empreendimento: emp.nomeEmpreendimento,
          rua: emp.ruaAvenidaEmpreendimento,
          numero: emp.numeroEmpreendimento,
          complemento: emp.complementoEmpreendimento,
          bairro: emp.bairroEmpreendimento,
          cidade: emp.cidadeEmpreendimento,
          estado: emp.estadoEmpreendimento,
          cep: emp.cepEmpreendimento,
          blocos: emp.blocoTorresEmpreendimento,
          andares: emp.andaresEmpreendimento,
          aptos_por_andar: emp.aptoAndarEmpreendimento,
          valor_condominio: emp.valorCondominioEmpreendimento,
          nome_proprietario: emp.nomeProprietario,
          razao_social: emp.razaoSocial || "", // Pode não existir
          cpf_cnpj: emp.cpfCnpj || "", // Pode não existir
          email: emp.contatoProprietario,
          telefone: emp.telefoneProprietario,
        }));
        setEmpreendimentosEncontrados(empreendimentosMapeados);
        setMostrarListaEmpreendimentos(true);
      } catch (error) {
        
        setEmpreendimentosEncontrados([]);
      }
    } else {
      setEmpreendimentosEncontrados([]);
      setMostrarListaEmpreendimentos(false);
    }
  };

  // Função para selecionar um empreendimento
  const selecionarEmpreendimento = (empreendimento: Empreendimento) => {
    setEmpreendimentoSelecionado(empreendimento);
    setFormEmpreendimento({
      nomeEmpreendimento: empreendimento.nome_empreendimento,
      rua: empreendimento.rua,
      numero: empreendimento.numero,
      complemento: empreendimento.complemento,
      bairro: empreendimento.bairro,
      cidade: empreendimento.cidade,
      estado: empreendimento.estado,
      cep: empreendimento.cep,
      blocos: empreendimento.blocos,
      andares: empreendimento.andares,
      aptosPorAndar: empreendimento.aptos_por_andar,
      valorCondominio: empreendimento.valor_condominio,
      nomeProprietario: empreendimento.nome_proprietario,
      razaoSocial: empreendimento.razao_social,
      cpfCnpj: empreendimento.cpf_cnpj,
      emailProprietario: empreendimento.email,
      telefoneProprietario: empreendimento.telefone,
    });
    setMostrarListaEmpreendimentos(false);
  };

  // Efeito para debounce na busca
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (termoBusca) {
        buscarEmpreendimentos(termoBusca);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [termoBusca]);

  // Efeito para carregar empreendimento automaticamente quando tiver um ID
  useEffect(() => {
    async function carregarEmpreendimentoPorId() {
      if (empreendimentoId) {
        try {
          const response = await axios.get(`/api/empreendimentos/${empreendimentoId}`);
          const emp = response.data;
          
          // Criar objeto no formato da interface Empreendimento
          const empreendimentoCarregado: Empreendimento = {
            id_empreendimento: emp.id,
            nome_empreendimento: emp.nomeEmpreendimento,
            rua: emp.ruaAvenidaEmpreendimento,
            numero: emp.numeroEmpreendimento,
            complemento: emp.complementoEmpreendimento,
            bairro: emp.bairroEmpreendimento,
            cidade: emp.cidadeEmpreendimento,
            estado: emp.estadoEmpreendimento,
            cep: emp.cepEmpreendimento || '',
            blocos: emp.blocoTorresEmpreendimento,
            andares: emp.andaresEmpreendimento,
            aptos_por_andar: emp.aptoAndarEmpreendimento,
            valor_condominio: emp.valorCondominioEmpreendimento,
            nome_proprietario: emp.nomeProprietario || '',
            razao_social: emp.razaoSocial || '',
            cpf_cnpj: emp.cpfCnpj || '',
            email: emp.contatoProprietario || '',
            telefone: emp.telefoneProprietario || '',
          };
          
          // Selecionar o empreendimento automaticamente
          selecionarEmpreendimento(empreendimentoCarregado);
          
          // Avançar para a etapa 3 (dados do apartamento)
          setEtapa(3);
        } catch (error) {
          
        }
      }
    }
    
    carregarEmpreendimentoPorId();
  }, [empreendimentoId]);

  const [formEmpreendimento, setFormEmpreendimento] = useState<FormEmpreendimento>({
    nomeEmpreendimento: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    blocos: '',
    andares: '',
    aptosPorAndar: '',
    valorCondominio: '',
    nomeProprietario: '',
    razaoSocial: '',
    cpfCnpj: '',
    emailProprietario: '',
    telefoneProprietario: '',
  });
  
  const [, navigate] = useLocation();

  const servicosOpcoes = [
    'Portaria 24h',
    'Câmeras de Segurança / CFTV',
    'Elevadores',
    'Energia Solar',
    'Wi-Fi',
    'Coworking / Espaço Office',
    'Lavanderia compartilhada',
    'Car Wash',
    'Market 24h',
    'Vaga de Visitantes',
    'Bicicletário',
  ];
  const lazerOpcoes = [
    'Piscina',
    'Churrasqueira',
    'Salão de Festas',
    'Academia / Espaço Fitness',
    'Playground',
    'Quadra poliesportiva',
    'Espaço Pet / Pet Place',
    'Sala de Jogos',
    'Cinema',
    'Espaço Gourmet',
    'Brinquedoteca',
    'Redário/Espaço Zen',
    'Pista de caminhada/corrida',
    'Praça de convivência',
    'Quadra de tênis',
    'Beach Tennis',
    'Sauna',
    'SPA',
  ];
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);
  const [lazerSelecionados, setLazerSelecionados] = useState<string[]>([]);

  const statusOpcoes = ['Lançamento', 'Em construção', 'Novo', 'Usado'];
  const tipoVagaOpcoes = ['Descoberta', 'Coberta'];
  const sacadaOpcoes = ['Sim', 'Sim com Churrasqueira', 'Não'];
  const caracteristicasApartamentoOpcoes = [
    'Escritório',
    'Lavabo',
    'Closet',
  ];
  
  // Estado único para dados do apartamento
  const [formApartamento, setFormApartamento] = useState({
    status: '',
    areaPrivativa: '',
    quartos: '',
    suites: '',
    banheiros: '',
    vagas: '',
    tipoVaga: '',
    sacada: '',
    caracteristicas: [] as string[],
  });

  // Estado para múltiplos apartamentos
  const [apartamentos, setApartamentos] = useState<typeof formApartamento[]>([]);

  // Estado para fotos
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotoCapaIdx, setFotoCapaIdx] = useState<number | null>(null);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [visualizarIdx, setVisualizarIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Otimização: memorizar URLs das imagens
  const fotoUrls = React.useMemo(() => {
    const urls = fotos.map(f => URL.createObjectURL(f));
    return urls;
  }, [fotos]);

  // Limpar URLs antigos ao mudar as fotos
  React.useEffect(() => {
    return () => {
      fotoUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [fotoUrls]);
  
  // Carregar dados do apartamento para edição
  useEffect(() => {
    async function carregarApartamentoParaEdicao() {
      if (modo === 'editar' && apartamentoId) {
        try {
          const response = await axios.get(`/api/apartamentos/${apartamentoId}`);
          const apt = response.data;
          
          
          // Converter características para array se estiver em formato JSON
          let caracteristicas: string[] = [];
          if (apt.caracteristicas_apartamento) {
            try {
              caracteristicas = JSON.parse(apt.caracteristicas_apartamento);
            } catch (e) {
              
            }
          }
          
          // Converter valor booleano de sacada para string
          let sacadaValor = 'Não';
          if (apt.sacada_varanda_apartamento === true) {
            sacadaValor = 'Sim';
          }
          
          // Preencher o formulário com os dados do apartamento
          setFormApartamento({
            status: apt.status_apartamento || '',
            areaPrivativa: apt.area_privativa_apartamento?.toString() || '',
            quartos: apt.quartos_apartamento?.toString() || '',
            suites: apt.suites_apartamento?.toString() || '',
            banheiros: apt.banheiros_apartamento?.toString() || '',
            vagas: apt.vagas_garagem_apartamento?.toString() || '',
            tipoVaga: apt.tipo_garagem_apartamento || '',
            sacada: sacadaValor,
            caracteristicas: caracteristicas,
          });
          
          // Carregar informações comerciais
          if (apt.valor_venda_apartamento) {
            // Convertendo o valor em centavos para o formato de moeda
            const valorVendaNumerico = Number(apt.valor_venda_apartamento) / 100;
            const valorFormatado = valorVendaNumerico.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            });
            setValorVenda(valorFormatado);
          }
          
          if (apt.titulo_descritivo_apartamento) {
            setTituloDescritivo(apt.titulo_descritivo_apartamento);
          }
          
          if (apt.descricao_apartamento) {
            setDescricaoCompleta(apt.descricao_apartamento);
          }
          
          if (apt.status_publicacao_apartamento) {
            setStatusPublicacao(apt.status_publicacao_apartamento as any);
          }
          
          // Buscar dados do empreendimento para preencher o formulário
          if (apt.id_empreendimento) {
            try {
              const respEmpreendimento = await axios.get(`/api/empreendimentos/${apt.id_empreendimento}`);
              const empreendimento = respEmpreendimento.data;
              
              // Atualizar o estado do empreendimento selecionado
              if (empreendimento) {
                const empreendimentoFormatado: Empreendimento = {
                  id_empreendimento: empreendimento.id_empreendimento,
                  nome_empreendimento: empreendimento.nome_empreendimento,
                  rua: empreendimento.rua_empreendimento || '',
                  numero: empreendimento.numero_empreendimento || '',
                  complemento: empreendimento.complemento_empreendimento || '',
                  bairro: empreendimento.bairro_empreendimento || '',
                  cidade: empreendimento.cidade_empreendimento || '',
                  estado: empreendimento.estado_empreendimento || '',
                  cep: empreendimento.cep_empreendimento || '',
                  blocos: empreendimento.blocos_empreendimento || '',
                  andares: empreendimento.andares_empreendimento || '',
                  aptos_por_andar: empreendimento.aptos_por_andar_empreendimento || '',
                  valor_condominio: empreendimento.valor_condominio_empreendimento || '',
                  nome_proprietario: empreendimento.nome_proprietario || '',
                  razao_social: empreendimento.razao_social_proprietario || '',
                  cpf_cnpj: empreendimento.cpf_cnpj_proprietario || '',
                  email: empreendimento.email_proprietario || '',
                  telefone: empreendimento.telefone_proprietario || '',
                };
                
                setEmpreendimentoSelecionado(empreendimentoFormatado);
              }
            } catch (error) {
              
            }
          }
          
          // Avançar diretamente para a etapa de dados do apartamento
          setEtapa(3);
        } catch (error) {
          
        }
      }
    }
    
    carregarApartamentoParaEdicao();
  }, [modo, apartamentoId]);

  // Função para adicionar apartamento
  // Função para adicionar apartamento e avançar para a próxima etapa
  function adicionarApartamentoEAvancar() {
    // Adicionar o apartamento à lista sem enviá-lo para o servidor
    if (formApartamento.status && formApartamento.areaPrivativa && formApartamento.quartos) {
      // Adicionar à lista de apartamentos para exibição
      setApartamentos(prev => [...prev, { ...formApartamento }]);
      
      // Limpar o formulário para permitir adicionar outro apartamento na próxima vez
      setFormApartamento({
        status: '',
        areaPrivativa: '',
        quartos: '',
        suites: '',
        banheiros: '',
        vagas: '',
        tipoVaga: '',
        sacada: '',
        caracteristicas: []
      });
    }
    
    // Avançar para a etapa 6
    setEtapa(6);
  }
  
  async function adicionarApartamento() {
    // Validação simples: não adicionar se campos obrigatórios estiverem vazios
    if (!formApartamento.status || !formApartamento.areaPrivativa || !formApartamento.quartos) {
      alert('Preencha ao menos Status, Área Privativa e Quartos!');
      return;
    }
    
    // Verifica se um empreendimento foi selecionado
    if (!empreendimentoSelecionado || !empreendimentoSelecionado.id_empreendimento) {
      alert('Selecione um empreendimento antes de adicionar apartamentos');
      return;
    }
    
    try {
      // Preparar os dados do apartamento para envio ao backend
      const apartamentoData = {
        id_empreendimento: empreendimentoSelecionado.id_empreendimento,
        status_apartamento: formApartamento.status,
        area_privativa_apartamento: Number(formApartamento.areaPrivativa) || 0,
        quartos_apartamento: Number(formApartamento.quartos) || 0,
        suites_apartamento: formApartamento.suites ? Number(formApartamento.suites) : null,
        banheiros_apartamento: formApartamento.banheiros ? Number(formApartamento.banheiros) : null,
        vagas_garagem_apartamento: formApartamento.vagas ? Number(formApartamento.vagas) : null,
        tipo_garagem_apartamento: formApartamento.tipoVaga || '',
        sacada_varanda_apartamento: formApartamento.sacada === 'Sim' || formApartamento.sacada === 'Sim com Churrasqueira',
        caracteristicas_apartamento: formApartamento.caracteristicas.length > 0 
          ? JSON.stringify(formApartamento.caracteristicas) 
          : '',
        valor_venda_apartamento: null,
        titulo_descritivo_apartamento: '',
        descricao_apartamento: '',
        status_publicacao_apartamento: 'Não publicado'
      };
      
      // Enviar dados para o servidor usando axios para evitar problemas de parsing JSON
      const response = await axios.post('/api/apartamentos', apartamentoData);
      
      // Simples verificador de resposta para facilitar debugging
      
      
      // Com axios, os erros de status não-200 já são tratados como exceções
      // e capturados no bloco catch
      
      // Obtém os dados do apartamento salvo da resposta do axios
      const novoApartamento = response.data;
      
      // Adicionar à lista de apartamentos já salvos
      setApartamentos(prev => [...prev, { 
        ...formApartamento,
        id: novoApartamento.id_apartamento 
      }]);
      
      // Mostrar mensagem de sucesso
      alert('Apartamento salvo com sucesso!');
      
      // Limpar o formulário para permitir adicionar outro apartamento
      setFormApartamento({
        status: '',
        areaPrivativa: '',
        quartos: '',
        suites: '',
        banheiros: '',
        vagas: '',
        tipoVaga: '',
        sacada: '',
        caracteristicas: []
      });
    } catch (error) {
      
      alert(error instanceof Error ? error.message : 'Erro ao salvar apartamento');
    }
  }

  // Função para remover apartamento
  function removerApartamento(idx: number) {
    setApartamentos(prev => prev.filter((_, i) => i !== idx));
  }

  // Função para adicionar fotos
  function onFotosChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErroFoto(null);
    const files = e.target.files ? Array.from(e.target.files) : [];
    const validFiles = files.filter(f => {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(f.type)) {
        setErroFoto('Apenas imagens JPG, JPEG, PNG ou WEBP são permitidas.');
        return false;
      }
      if (f.size > 100 * 1024 * 1024) {
        setErroFoto('Cada imagem deve ter no máximo 100MB.');
        return false;
      }
      return true;
    });
    if (validFiles.length) {
      setFotos(prev => [...prev, ...validFiles]);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  // Função para remover foto
  function removerFoto(idx: number) {
    setFotos(prev => prev.filter((_, i) => i !== idx));
    if (fotoCapaIdx === idx) setFotoCapaIdx(null);
    else if (fotoCapaIdx && fotoCapaIdx > idx) setFotoCapaIdx(fotoCapaIdx - 1);
  }

  // Função para definir foto de capa
  function definirCapa(idx: number) {
    setFotoCapaIdx(idx);
  }

  // Drag and drop para ordenar fotos
  function onDragStart(idx: number) { setDraggedIdx(idx); }
  function onDragOver(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); }
  function onDrop(idx: number) {
    if (draggedIdx === null || draggedIdx === idx) return;
    const novas = [...fotos];
    const [removida] = novas.splice(draggedIdx, 1);
    novas.splice(idx, 0, removida);
    setFotos(novas);
    if (fotoCapaIdx === draggedIdx) setFotoCapaIdx(idx);
    else if (fotoCapaIdx !== null) {
      // Ajusta índice da capa se necessário
      if (draggedIdx < fotoCapaIdx && idx >= fotoCapaIdx) setFotoCapaIdx(fotoCapaIdx - 1);
      if (draggedIdx > fotoCapaIdx && idx <= fotoCapaIdx) setFotoCapaIdx(fotoCapaIdx + 1);
    }
    setDraggedIdx(null);
  }

  // Visualização em tela cheia
  function abrirVisualizacao(idx: number) { setVisualizarIdx(idx); }
  function fecharVisualizacao() { setVisualizarIdx(null); }

  // Estado para vídeos
  const [videos, setVideos] = useState<File[]>([]);
  const [draggedVideoIdx, setDraggedVideoIdx] = useState<number | null>(null);
  const [dragOverVideoIdx, setDragOverVideoIdx] = useState<number | null>(null);
  const [erroVideo, setErroVideo] = useState<string | null>(null);
  const videoInputRef = React.useRef<HTMLInputElement>(null);
  const [visualizarVideoIdx, setVisualizarVideoIdx] = useState<number | null>(null);

  // Otimização: memorizar URLs dos vídeos
  const videoUrls = React.useMemo(() => {
    const urls = videos.map(f => URL.createObjectURL(f));
    return urls;
  }, [videos]);
  React.useEffect(() => {
    return () => { videoUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, [videoUrls]);

  // Função para adicionar vídeos
  function onVideosChange(e: React.ChangeEvent<HTMLInputElement>) {
    setErroVideo(null);
    const files = e.target.files ? Array.from(e.target.files) : [];
    const validFiles = files.filter(f => {
      if (!['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'].includes(f.type)) {
        setErroVideo('Apenas vídeos MP4, WEBM, MOV ou AVI são permitidos.');
        return false;
      }
      if (f.size > 2 * 1024 * 1024 * 1024) {
        setErroVideo('Cada vídeo deve ter no máximo 2GB.');
        return false;
      }
      return true;
    });
    if (validFiles.length) {
      setVideos(prev => [...prev, ...validFiles]);
    }
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  // Função para remover vídeo
  function removerVideo(idx: number) {
    setVideos(prev => prev.filter((_, i) => i !== idx));
  }

  // Drag and drop para ordenar vídeos
  function onDragStartVideo(idx: number) { setDraggedVideoIdx(idx); }
  function onDragOverVideo(e: React.DragEvent<HTMLDivElement>) { e.preventDefault(); }
  function onDropVideo(idx: number) {
    if (draggedVideoIdx === null || draggedVideoIdx === idx) return;
    const novas = [...videos];
    const [removido] = novas.splice(draggedVideoIdx, 1);
    novas.splice(idx, 0, removido);
    setVideos(novas);
    setDraggedVideoIdx(null);
  }

  // Visualização em tela cheia
  function abrirVisualizacaoVideo(idx: number) { setVisualizarVideoIdx(idx); }
  function fecharVisualizacaoVideo() { setVisualizarVideoIdx(null); }

  // Estado para informações comerciais (etapa 6)
  const [valorVenda, setValorVenda] = useState('');
  const [tituloDescritivo, setTituloDescritivo] = useState('');
  const [descricaoCompleta, setDescricaoCompleta] = useState('');
  const [statusPublicacao, setStatusPublicacao] = useState<'Ativo' | 'Pausado' | 'Desativado'>('Ativo');

  // Preencher endereço automaticamente ao digitar rua e número
  useEffect(() => {
    async function preencherEndereco() {
      if (formEmpreendimento.rua && formEmpreendimento.numero) {
        const resultado = await buscarEnderecoPorRuaNumero(formEmpreendimento.rua, formEmpreendimento.numero);
        if (resultado) {
          setFormEmpreendimento(f => ({
            ...f,
            bairro: resultado.bairro || '',
            cidade: resultado.cidade || '',
            estado: resultado.estado || '',
            cep: resultado.cep || '',
          }));
        }
      }
    }
    preencherEndereco();
  }, [formEmpreendimento.rua, formEmpreendimento.numero]);

  const queryClient = useQueryClient();

  // Estados para gerenciar erros e carregamento do envio do formulário
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Função para verificar se o formulário está vazio
  const formEmpreendimentoVazio = () => {
    return Object.values(formEmpreendimento).some(value => !value);
  };

  // Função para cadastrar imóvel
  async function cadastrarImovel() {
    try {
      setIsSaving(true);
      setErrorMessage(null);
      
      // Verificar se estamos em modo de edição
      if (modo === 'editar' && apartamentoId) {
        try {
          // Preparar os dados do apartamento para atualização
          const apartamentoData = {
            id_empreendimento: empreendimentoSelecionado?.id_empreendimento,
            status_apartamento: formApartamento.status,
            area_privativa_apartamento: Number(formApartamento.areaPrivativa) || 0,
            quartos_apartamento: Number(formApartamento.quartos) || 0,
            suites_apartamento: formApartamento.suites ? Number(formApartamento.suites) : null,
            banheiros_apartamento: formApartamento.banheiros ? Number(formApartamento.banheiros) : null,
            vagas_garagem_apartamento: formApartamento.vagas ? Number(formApartamento.vagas) : null,
            tipo_garagem_apartamento: formApartamento.tipoVaga || '',
            sacada_varanda_apartamento: formApartamento.sacada === 'Sim' || formApartamento.sacada === 'Sim com Churrasqueira',
            caracteristicas_apartamento: formApartamento.caracteristicas.length > 0 
              ? JSON.stringify(formApartamento.caracteristicas) 
              : '',
            valor_venda_apartamento: valorVenda ? Number(valorVenda.replace(/[^\d]/g, '')) / 100 : null,
            titulo_descritivo_apartamento: tituloDescritivo || '',
            descricao_apartamento: descricaoCompleta || '',
            status_publicacao_apartamento: statusPublicacao || 'Não publicado'
          };
          
          // Enviar os dados atualizados para o servidor
          await axios.put(`/api/apartamentos/${apartamentoId}`, apartamentoData);
          
          // Invalida o cache para atualizar os dados
          queryClient.invalidateQueries({ queryKey: ['apartamentos'] });
          queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
          
          // Exibe uma mensagem de sucesso
          alert('Apartamento atualizado com sucesso!');
          
          // Chamar a função de conclusão se fornecida
          if (onSaveComplete) {
            onSaveComplete();
          } else {
            // Redirecionar para a página do empreendimento
            navigate(`/empreendimento/${empreendimentoSelecionado?.id_empreendimento}`);
          }
          
          return; // Encerra a função após a edição
        } catch (error) {
          
          throw new Error("Falha ao atualizar apartamento");
        }
      }
      
      // Se não estamos em modo de edição, continuamos com o fluxo de cadastro normal
      // Removida a lógica de upload de fotos e vídeos
      const formData = new FormData();
      
      // Adicione os dados do imóvel
      const dadosImovel: DadosImovel = {
        tipoImovel,
        
        ...(tipoImovel === 'Apartamento' && {
          ...(empreendimentoSelecionado ? {
            id_empreendimento: empreendimentoSelecionado.id_empreendimento
          } : {
          nomeEmpreendimento: formEmpreendimento.nomeEmpreendimento,
          endereco: {
            rua: formEmpreendimento.rua,
            numero: formEmpreendimento.numero,
            complemento: formEmpreendimento.complemento,
            bairro: formEmpreendimento.bairro,
            cidade: formEmpreendimento.cidade,
            estado: formEmpreendimento.estado,
            cep: formEmpreendimento.cep,
          },
          detalhesEmpreendimento: {
            blocos: formEmpreendimento.blocos,
            andares: formEmpreendimento.andares,
            aptosPorAndar: formEmpreendimento.aptosPorAndar,
            valorCondominio: formEmpreendimento.valorCondominio.replace(/[^\d]/g, ''),
            servicos: servicosSelecionados,
            lazer: lazerSelecionados,
          },
          dadosProprietario: {
            nome: formEmpreendimento.nomeProprietario,
            razaoSocial: formEmpreendimento.razaoSocial,
            cpfCnpj: formEmpreendimento.cpfCnpj,
            email: formEmpreendimento.emailProprietario,
            telefone: formEmpreendimento.telefoneProprietario,
          }
          })
        }),
        
        // Dados dos apartamentos do empreendimento
        ...(tipoImovel === 'Apartamento' && {
          apartamentos: apartamentos.map(apto => ({
            status: apto.status,
            areaPrivativa: Number(apto.areaPrivativa),
            quartos: Number(apto.quartos),
            suites: Number(apto.suites),
            banheiros: Number(apto.banheiros),
            vagas: Number(apto.vagas),
            tipoVaga: apto.tipoVaga,
            sacada: apto.sacada,
            caracteristicas: apto.caracteristicas,
          })),
        }),
        
        // Informações comerciais
        informacoesComerciais: {
          valorVenda: valorVenda.replace(/[^\d]/g, ''),
          titulo: tituloDescritivo,
          descricao: descricaoCompleta,
          statusPublicacao,
        },
      };
      
      // Enviar os dados do empreendimento para o servidor
      let empreendimentoId;
      
      if (empreendimentoSelecionado) {
        // Se já existe um empreendimento selecionado, usamos o ID existente
        empreendimentoId = empreendimentoSelecionado.id_empreendimento;
      } else {
        // Caso contrário, enviamos os dados para criar um novo empreendimento
        try {
          const empreendimentoResponse = await axios.post('/api/empreendimentos', {
            tipo_proprietario: 'Construtora',
            id_proprietario: formEmpreendimento.cpfCnpj ? 1 : null, // ID padrão ou null se não tiver proprietário
            nome_empreendimento: formEmpreendimento.nomeEmpreendimento,
            rua_empreendimento: formEmpreendimento.rua,
            numero_empreendimento: formEmpreendimento.numero,
            complemento_empreendimento: formEmpreendimento.complemento,
            bairro_empreendimento: formEmpreendimento.bairro,
            cidade_empreendimento: formEmpreendimento.cidade,
            estado_empreendimento: formEmpreendimento.estado,
            cep_empreendimento: formEmpreendimento.cep,
            blocos_empreendimento: formEmpreendimento.blocos,
            andares_empreendimento: formEmpreendimento.andares,
            aptos_por_andar_empreendimento: formEmpreendimento.aptosPorAndar,
            valor_condominio_empreendimento: formEmpreendimento.valorCondominio.replace(/[^\d]/g, ''),
            nome_proprietario: formEmpreendimento.nomeProprietario,
            razao_social_proprietario: formEmpreendimento.razaoSocial,
            cpf_cnpj_proprietario: formEmpreendimento.cpfCnpj,
            email_proprietario: formEmpreendimento.emailProprietario,
            telefone_proprietario: formEmpreendimento.telefoneProprietario,
            servicos_empreendimento: JSON.stringify(servicosSelecionados),
            lazer_empreendimento: JSON.stringify(lazerSelecionados)
          });
          
          empreendimentoId = empreendimentoResponse.data.id;
          
        } catch (error) {
          
          throw new Error("Falha ao criar empreendimento");
        }
      }
      
      // Agora enviamos os dados do apartamento usando o ID do empreendimento
      if (apartamentos.length > 0 && empreendimentoId) {
        try {
          const apartamento = apartamentos[0]; // Pegamos apenas o primeiro apartamento
          
          const apartamentoData = {
            id_empreendimento: empreendimentoId,
            status_apartamento: apartamento.status,
            area_privativa_apartamento: Number(apartamento.areaPrivativa) || 0,
            quartos_apartamento: Number(apartamento.quartos) || 0,
            suites_apartamento: apartamento.suites ? Number(apartamento.suites) : null,
            banheiros_apartamento: apartamento.banheiros ? Number(apartamento.banheiros) : null,
            vagas_garagem_apartamento: apartamento.vagas ? Number(apartamento.vagas) : null,
            tipo_garagem_apartamento: apartamento.tipoVaga || '',
            sacada_varanda_apartamento: apartamento.sacada === 'Sim' || apartamento.sacada === 'Sim com Churrasqueira',
            caracteristicas_apartamento: apartamento.caracteristicas.length > 0 
              ? JSON.stringify(apartamento.caracteristicas) 
              : '',
            valor_venda_apartamento: valorVenda ? Number(valorVenda.replace(/[^\d]/g, '')) / 100 : null,
            titulo_descritivo_apartamento: tituloDescritivo,
            descricao_apartamento: descricaoCompleta,
            status_publicacao_apartamento: statusPublicacao
          };
          
          const apartamentoResponse = await axios.post('/api/apartamentos', apartamentoData);
          
        } catch (error) {
          
          throw new Error("Falha ao criar apartamento");
        }
      }
      
      // Limpar o cache de consultas para forçar o recarregamento de dados
      queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
      queryClient.invalidateQueries({ queryKey: ['apartamentos'] });
      
      // Redirecionar para a página de detalhes do imóvel criado
      navigate(`/empreendimento/${empreendimentoId}`);
      
    } catch (error: any) {
      
      
      let mensagem = 'Ocorreu um erro ao cadastrar o imóvel. Tente novamente.';
      
      if (error.response) {
        // O servidor respondeu com um status de erro
        if (error.response.data && error.response.data.mensagem) {
          mensagem = error.response.data.mensagem;
        }
      } else if (error.request) {
        // A requisição foi feita mas não houve resposta
        mensagem = 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.';
      }
      
      setErrorMessage(mensagem);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto', width: '100%', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', boxSizing: 'border-box', background: '#fff', borderRadius: 12 }}>
      {/* Etapa 1: Selecione o tipo de imóvel */}
      {etapa === 1 && (
        <div>
          <h2 style={{ textAlign: 'center', marginBottom: 32, marginTop: 16, fontSize: 20, fontWeight: 500 }}>Selecione o tipo de imóvel</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '24px 24px',
              justifyContent: 'center',
              marginBottom: 40,
              marginLeft: 'auto',
              marginRight: 'auto',
              width: '100%',
              maxWidth: 500,
            }}
          >
            {tiposImovel.map(tipo => (
              <button
                key={tipo}
                disabled={tipo !== 'Apartamento'}
                style={{
                  width: '100%',
                  maxWidth: 260,
                  minWidth: 120,
                  height: 56,
                  padding: 0,
                  background: tipoImovel === tipo ? '#007bff' : '#f0f0f0',
                  color: tipoImovel === tipo ? '#fff' : (tipo === 'Apartamento' ? '#333' : '#999'),
                  border: tipoImovel === tipo ? '2px solid #007bff' : '1px solid #ccc',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 18,
                  cursor: tipo === 'Apartamento' ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  opacity: tipo === 'Apartamento' ? 1 : 0.7,
                  boxSizing: 'border-box',
                  boxShadow: tipoImovel === tipo ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  display: 'block',
                  margin: '0 auto',
                }}
                onMouseOver={e => (e.currentTarget.style.background = tipoImovel === tipo ? '#0056b3' : '#e0e0e0')}
                onMouseOut={e => (e.currentTarget.style.background = tipoImovel === tipo ? '#007bff' : '#f0f0f0')}
                onClick={() => setTipoImovel(tipo)}
              >
                {tipo}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, maxWidth: 500, margin: '0 auto' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                color: '#666',
                padding: '12px 36px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontWeight: 500,
                fontSize: 16,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => setEtapa(2)}
              disabled={!tipoImovel}
              style={{
                background: tipoImovel ? '#007bff' : '#ccc',
                color: '#fff',
                padding: '12px 36px',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 16,
                cursor: tipoImovel ? 'pointer' : 'not-allowed',
                boxShadow: tipoImovel ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              Avançar
            </button>
          </div>
        </div>
      )}
      
      {/* Etapa 2: Dados do Empreendimento (antigo Etapa 3) */}
      {etapa === 2 && tipoImovel === 'Apartamento' && (
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Dados do Empreendimento</h2>

          {/* Campo de busca de empreendimentos */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                placeholder="Buscar empreendimento..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px',
                  borderRadius: '4px', 
                  border: '1px solid #ccc',
                  marginBottom: '8px',
                  fontSize: '16px'
                }}
              />
              {mostrarListaEmpreendimentos && empreendimentosEncontrados.length > 0 && (
              <div style={{ 
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: '#fff',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  zIndex: 1000,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  {empreendimentosEncontrados.map((emp) => (
                    <div
                      key={emp.id_empreendimento}
                      onClick={() => selecionarEmpreendimento(emp)}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                    >
                      {emp.nome_empreendimento}
                  </div>
                ))}
              </div>
              )}
            </div>
            {!empreendimentoSelecionado && empreendimentosEncontrados.length === 0 && termoBusca.length >= 3 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    // Guarda o termo de busca atual em localStorage para preencher o nome do empreendimento
                    localStorage.setItem('novoEmpreendimentoNome', termoBusca);
                    // Redireciona para a página de empreendimentos com indicação de novo cadastro
                    navigate('/empreendimentos?novo=true');
                  }}
                  style={{
                    background: '#28a745',
                    color: '#fff',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cadastrar Novo Empreendimento
                </button>
                <span style={{ color: '#666', fontSize: '14px', alignSelf: 'center' }}>
                  Nenhum empreendimento encontrado
                </span>
              </div>
            )}
            </div>
            
          {/* Mostrar informações do empreendimento selecionado */}
          {empreendimentoSelecionado && (
              <div style={{ 
              padding: '16px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px', 
              marginBottom: '24px',
              border: '1px solid #e9ecef'
            }}>
              <h3 style={{ marginBottom: '12px', color: '#212529' }}>Empreendimento Selecionado</h3>
              <p style={{ margin: '4px 0', color: '#495057' }}><strong>Nome:</strong> {empreendimentoSelecionado.nome_empreendimento}</p>
              <p style={{ margin: '4px 0', color: '#495057' }}><strong>ID:</strong> {empreendimentoSelecionado.id_empreendimento}</p>
              <button
                onClick={() => {
                  setEmpreendimentoSelecionado(null);
                  setTermoBusca('');
                }}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Remover Seleção
              </button>
                  </div>
          )}
            
          {/* Botões de navegação */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    color: '#666',
                    padding: '10px 24px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => setEtapa(1)} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#007bff', 
                  fontWeight: 500, 
                  cursor: 'pointer'
                }}
                >
                  Voltar
                </button>
              </div>
              <button
                onClick={() => setEtapa(3)}
                style={{
                  background: '#007bff',
                  color: '#fff',
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                fontWeight: 500
                }}
              >
                Avançar
              </button>
            </div>

          {/* Formulário de empreendimento - só mostrar se não houver empreendimento selecionado */}
          {!empreendimentoSelecionado && (
            <form style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
              {/* Os campos abaixo foram removidos conforme solicitado */}
          </form>
          )}
        </div>
      )}
      
      {/* Etapa 3: Dados do Apartamento (antigo Etapa 4) */}
      {etapa === 3 && tipoImovel === 'Apartamento' && (
        <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Dados do Apartamento</h2>
          
          {/* Formulário para adicionar apartamento */}
          <form style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800, margin: '0 auto', width: '100%' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 1fr', 
              gap: '16px', 
              marginTop: '16px',
              width: '100%',
              margin: '16px auto'
            }}>
              {/* Status do apartamento */}
              <div style={{ margin: '8px 0', minWidth: '100px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Status</label>
                <select
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  value={formApartamento.status}
                  onChange={(e: SelectChangeEvent) => setFormApartamento({ ...formApartamento, status: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {statusOpcoes.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              
              {/* Coluna vazia */}
              <div style={{ margin: '8px 0' }}></div>
              
              {/* Área privativa */}
              <div style={{ margin: '8px 0', minWidth: '100px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Área Privativa (m²)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  value={formApartamento.areaPrivativa}
                  onChange={(e: InputChangeEvent) => setFormApartamento({ ...formApartamento, areaPrivativa: e.target.value })}
                />
              </div>
              
              {/* Quartos */}
              <div style={{ margin: '8px 0', minWidth: '100px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Quartos</label>
                <input
                  type="number"
                  min="0"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  value={formApartamento.quartos}
                  onChange={(e: InputChangeEvent) => setFormApartamento({ ...formApartamento, quartos: e.target.value })}
                />
              </div>
              
              {/* Suítes */}
              <div style={{ margin: '8px 0', minWidth: '100px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Suítes</label>
                <input
                  type="number"
                  min="0"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  value={formApartamento.suites}
                  onChange={(e: InputChangeEvent) => setFormApartamento({ ...formApartamento, suites: e.target.value })}
                />
              </div>
              
              {/* Banheiros */}
              <div style={{ margin: '8px 0', minWidth: '100px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Banheiros</label>
                <input
                  type="number"
                  min="0"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  value={formApartamento.banheiros}
                  onChange={(e: InputChangeEvent) => setFormApartamento({ ...formApartamento, banheiros: e.target.value })}
                />
              </div>
              
              {/* Vagas de Garagem */}
              <div style={{ margin: '8px 0', minWidth: '140px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Vagas de Garagem</label>
                <input
                  type="number"
                  min="0"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  value={formApartamento.vagas}
                  onChange={(e: InputChangeEvent) => setFormApartamento({ ...formApartamento, vagas: e.target.value })}
                />
              </div>
              
              {/* Tipo de Vaga */}
              <div style={{ margin: '8px 0', minWidth: '100px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Tipo de Vaga</label>
                <select
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  value={formApartamento.tipoVaga}
                  onChange={(e: SelectChangeEvent) => setFormApartamento({ ...formApartamento, tipoVaga: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {tipoVagaOpcoes.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              {/* Sacada/Varanda */}
              <div style={{ margin: '8px 0', minWidth: '100px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500, whiteSpace: 'nowrap', fontSize: '0.95rem' }}>Sacada/Varanda</label>
                <select
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                  value={formApartamento.sacada}
                  onChange={(e: SelectChangeEvent) => setFormApartamento({ ...formApartamento, sacada: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  {sacadaOpcoes.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Características do Apartamento */}
            <div style={{ margin: '16px 0' }}>
              <h3 style={{ marginBottom: '12px', fontWeight: 500 }}>Características do Apartamento</h3>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap',
                gap: '8px 24px'
              }}>
                {caracteristicasApartamentoOpcoes.map(caracteristica => (
                  <div key={caracteristica} style={{ display: 'flex', alignItems: 'center', minWidth: '120px' }}>
                    <input 
                      type="checkbox"
                      id={`caracteristica-${caracteristica}`}
                      checked={formApartamento.caracteristicas.includes(caracteristica)}
                      onChange={() => {
                        if (formApartamento.caracteristicas.includes(caracteristica)) {
                          setFormApartamento({
                            ...formApartamento,
                            caracteristicas: formApartamento.caracteristicas.filter(c => c !== caracteristica)
                          });
                        } else {
                          setFormApartamento({
                            ...formApartamento,
                            caracteristicas: [...formApartamento.caracteristicas, caracteristica]
                          });
                        }
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    <label htmlFor={`caracteristica-${caracteristica}`}>{caracteristica}</label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Botões de ação */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    color: '#666',
                    padding: '10px 24px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => setEtapa(2)} 
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#007bff', fontWeight: 500, cursor: 'pointer' }}
                >
                  Voltar
                </button>
              </div>
              <button
                onClick={adicionarApartamentoEAvancar}
                style={{
                  background: '#007bff',
                  color: '#fff',
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                type="button"
              >
                Avançar
              </button>
            </div>
          </form>
          
          {/* Lista de apartamentos adicionados */}
          {apartamentos.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3>Detalhes do Apartamento</h3>
              <div style={{ 
                maxHeight: 200, 
                overflowY: 'auto', 
                border: '1px solid #ddd', 
                borderRadius: 4, 
                marginTop: 8,
                padding: 8
              }}>
                {apartamentos.map((apto, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      padding: 8, 
                      margin: '4px 0', 
                      border: '1px solid #eee', 
                      borderRadius: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{apto.status}</strong> - {apto.areaPrivativa}m² • {apto.quartos} quartos 
                      {apto.suites && ` • ${apto.suites} suítes`}
                      {apto.banheiros && ` • ${apto.banheiros} banheiros`}
                      {apto.vagas && ` • ${apto.vagas} vagas`}
                    </div>
                    <button
                      type="button"
                      onClick={() => removerApartamento(idx)}
                      style={{
                        background: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        fontSize: 12
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Exibimos os botões somente quando houver apartamentos adicionados */}
          {apartamentos.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button 
                onClick={() => setEtapa(2)} 
                type="button"
                style={{ background: 'none', border: 'none', color: '#007bff', fontWeight: 500, cursor: 'pointer' }}
              >
                Voltar
              </button>
              <button
                onClick={adicionarApartamentoEAvancar}
                style={{
                  background: '#007bff',
                  color: '#fff',
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
                type="button"
              >
                Avançar
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* As etapas 4 e 5 (Fotos e Vídeos) foram removidas */}
      {false && (
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Fotos do Imóvel</h2>
          
          {/* Uploader de fotos */}
          <div style={{ marginBottom: 24 }}>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              onChange={onFotosChange} 
              ref={inputRef}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                background: '#007bff',
                color: '#fff',
                padding: '12px 24px',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                margin: '0 auto',
                display: 'block',
                fontWeight: 500
              }}
            >
              Selecionar Fotos
            </button>
            {erroFoto && (
              <div style={{ color: '#dc3545', marginTop: 8, textAlign: 'center' }}>
                {erroFoto}
              </div>
            )}
            
            <div style={{ marginTop: 16, textAlign: 'center', color: '#666', fontSize: 14 }}>
              Adicione fotos do imóvel em alta qualidade. A primeira foto será a capa do anúncio.
              <br />Você pode arrastar as fotos para reordenar.
            </div>
          </div>
          
          {/* Preview das fotos com opção de arrastar/soltar */}
          {fotos.length > 0 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Fotos adicionadas ({fotos.length})</h3>
              <p style={{ marginBottom: 16, color: '#666' }}>Arraste para reordenar. Selecione a foto de capa.</p>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
                gap: 16,
                marginBottom: 24
              }}>
                {fotoUrls.map((url, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      position: 'relative',
                      border: '1px solid #ddd', 
                      borderRadius: 4,
                      overflow: 'hidden',
                      backgroundColor: '#f9f9f9',
                      borderColor: fotoCapaIdx === idx ? '#007bff' : '#ddd',
                      borderWidth: fotoCapaIdx === idx ? 3 : 1,
                      opacity: draggedIdx === idx ? 0.5 : 1,
                      cursor: 'grab',
                    }}
                    draggable
                    onDragStart={() => onDragStart(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverIdx(idx);
                    }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={() => {
                      onDrop(idx);
                      setDragOverIdx(null);
                    }}
                    onDragEnd={() => setDragOverIdx(null)}
                  >
                    <img 
                      src={url} 
                      alt={`Foto ${idx + 1}`} 
                      style={{ 
                        width: '100%', 
                        aspectRatio: '4/3',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                      onClick={() => abrirVisualizacao(idx)}
                    />
                    
                    <div style={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      left: 0,
                      right: 0,
                      padding: '4px',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <button
                        type="button"
                        onClick={() => definirCapa(idx)}
                        style={{
                          background: fotoCapaIdx === idx ? '#28a745' : 'rgba(255,255,255,0.8)',
                          color: fotoCapaIdx === idx ? '#fff' : '#333',
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 4px',
                          fontSize: 10,
                          cursor: 'pointer'
                        }}
                      >
                        {fotoCapaIdx === idx ? 'Capa ✓' : 'Definir Capa'}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => removerFoto(idx)}
                        style={{
                          background: 'rgba(255,255,255,0.8)',
                          color: '#dc3545',
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 4px',
                          fontSize: 10,
                          cursor: 'pointer'
                        }}
                      >
                        X
                      </button>
                    </div>
                    
                    {/* Numeração da foto */}
                    <div style={{ 
                      position: 'absolute', 
                      top: 4, 
                      left: 4,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12
                    }}>
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Visualização em tela cheia */}
          {visualizarIdx !== null && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.9)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onClick={fecharVisualizacao}
            >
              <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                <img 
                  src={visualizarIdx !== null && fotoUrls.length > 0 ? fotoUrls[Math.min(visualizarIdx!, fotoUrls.length-1)] : ''} 
                  alt="Foto visualizada" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '80vh',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </div>
              <div style={{ marginTop: 16, color: '#fff' }}>
                {visualizarIdx !== null ? `Foto ${visualizarIdx! + 1} de ${fotos.length}` : ''}
              </div>
              <button
                type="button"
                onClick={fecharVisualizacao}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  fontSize: 24,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                &times;
              </button>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  color: '#666',
                  padding: '10px 24px',
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => setEtapa(3)}
                style={{ background: 'none', border: 'none', color: '#007bff', fontWeight: 500, cursor: 'pointer' }}
              >Voltar</button>
            </div>
            <button
              type="button"
              disabled={fotos.length === 0 || fotoCapaIdx === null}
              style={{
                background: (fotos.length > 0 && fotoCapaIdx !== null) ? '#007bff' : '#ccc',
                color: '#fff',
                padding: '10px 24px',
                border: 'none',
                borderRadius: 4,
                fontWeight: 600,
                cursor: (fotos.length > 0 && fotoCapaIdx !== null) ? 'pointer' : 'not-allowed',
              }}
              onClick={() => setEtapa(5)}
            >Avançar</button>
          </div>
        </div>
      )}
      
      {/* Etapa 5 (Vídeos) removida */}
      {false && (
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Vídeos do Imóvel <span style={{ fontWeight: 400, fontSize: 15, color: '#888' }}>(opcional)</span></h2>
          
          {/* Uploader de vídeos */}
          <div style={{ marginBottom: 24 }}>
            <input 
              type="file" 
              multiple 
              accept="video/*" 
              onChange={onVideosChange} 
              ref={videoInputRef}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              style={{
                background: '#007bff',
                color: '#fff',
                padding: '12px 24px',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                margin: '0 auto',
                display: 'block',
                fontWeight: 500
              }}
            >
              Selecionar Vídeos
            </button>
            {erroVideo && (
              <div style={{ color: '#dc3545', marginTop: 8, textAlign: 'center' }}>
                {erroVideo}
              </div>
            )}
            
            <div style={{ marginTop: 16, textAlign: 'center', color: '#666', fontSize: 14 }}>
              Adicione vídeos do imóvel. Esta etapa é opcional.
              <br />Você pode arrastar os vídeos para reordenar.
            </div>
          </div>
          
          {/* Preview dos vídeos */}
          {videos.length > 0 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>Vídeos adicionados ({videos.length})</h3>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                gap: 16,
                marginBottom: 24
              }}>
                {videoUrls.map((url, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      position: 'relative',
                      border: '1px solid #ddd', 
                      borderRadius: 4,
                      overflow: 'hidden',
                      backgroundColor: '#f9f9f9',
                      opacity: draggedVideoIdx === idx ? 0.5 : 1,
                      cursor: 'grab'
                    }}
                    draggable
                    onDragStart={() => onDragStartVideo(idx)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverVideoIdx(idx);
                    }}
                    onDragLeave={() => setDragOverVideoIdx(null)}
                    onDrop={() => {
                      onDropVideo(idx);
                      setDragOverVideoIdx(null);
                    }}
                    onDragEnd={() => setDragOverVideoIdx(null)}
                  >
                    <video 
                      src={url} 
                      style={{ 
                        width: '100%', 
                        aspectRatio: '16/9',
                        objectFit: 'cover',
                        display: 'block',
                        backgroundColor: '#000'
                      }}
                      onClick={() => abrirVisualizacaoVideo(idx)}
                      controls={false}
                    />
                    
                    <div style={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      left: 0,
                      right: 0,
                      padding: '4px',
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <button
                        type="button"
                        onClick={() => abrirVisualizacaoVideo(idx)}
                        style={{
                          background: 'rgba(255,255,255,0.8)',
                          color: '#333',
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: 10,
                          cursor: 'pointer'
                        }}
                      >
                        Visualizar
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => removerVideo(idx)}
                        style={{
                          background: 'rgba(255,255,255,0.8)',
                          color: '#dc3545',
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 4px',
                          fontSize: 10,
                          cursor: 'pointer'
                        }}
                      >
                        X
                      </button>
                    </div>
                    
                    {/* Numeração do vídeo */}
                    <div style={{ 
                      position: 'absolute', 
                      top: 4, 
                      left: 4,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12
                    }}>
                      {idx + 1}
                    </div>
                    
                    {/* Ícone de play no centro */}
                    <div style={{ 
                      position: 'absolute', 
                      top: '50%', 
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 40,
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      pointerEvents: 'none'
                    }}>
                      ▶
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Visualização em tela cheia */}
          {visualizarVideoIdx !== null && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.9)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onClick={fecharVisualizacaoVideo}
            >
              <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                <video 
                  src={visualizarVideoIdx !== null && videoUrls.length > 0 ? videoUrls[Math.min(visualizarVideoIdx!, videoUrls.length-1)] : ''}
                  controls 
                  autoPlay
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '80vh',
                    display: 'block',
                  }}
                  onClick={e => e.stopPropagation()}
                />
              </div>
              <div style={{ marginTop: 16, color: '#fff' }}>
                {visualizarVideoIdx !== null ? `Vídeo ${visualizarVideoIdx! + 1} de ${videos.length}` : ''}
              </div>
              <button
                type="button"
                onClick={fecharVisualizacaoVideo}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  fontSize: 24,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                &times;
              </button>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  color: '#666',
                  padding: '10px 24px',
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => setEtapa(4)}
                style={{ background: 'none', border: 'none', color: '#007bff', fontWeight: 500, cursor: 'pointer' }}
              >Voltar</button>
            </div>
            <button
              type="button"
              style={{
                background: '#007bff',
                color: '#fff',
                padding: '10px 24px',
                border: 'none',
                borderRadius: 4,
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onClick={() => setEtapa(6)}
            >Avançar</button>
          </div>
        </div>
      )}
      
      {/* Etapa 6: Informações Comerciais (antigo Etapa 7) */}
      {etapa === 6 && tipoImovel === 'Apartamento' && (
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Informações Comerciais</h2>
          
          <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Valor de Venda */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Valor de Venda</label>
              <input
                type="text"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                value={valorVenda}
                onChange={e => {
                  const rawValue = e.target.value.replace(/\D/g, '');
                  const number = parseInt(rawValue, 10) / 100;
                  setValorVenda(isNaN(number) ? '' : number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
                }}
                placeholder="R$ 0,00"
              />
            </div>
            
            {/* Título Descritivo */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Título Descritivo</label>
              <input
                type="text"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                value={tituloDescritivo}
                onChange={e => setTituloDescritivo(e.target.value)}
                placeholder="Ex: Apartamento de 3 quartos com vista para o mar"
                maxLength={100}
              />
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                {tituloDescritivo.length}/100 caracteres
              </div>
            </div>
            
            {/* Descrição Completa */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Descrição Completa</label>
              <textarea
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', minHeight: 120, resize: 'vertical' }}
                value={descricaoCompleta}
                onChange={e => setDescricaoCompleta(e.target.value)}
                placeholder="Descreva detalhadamente o imóvel e seus diferenciais..."
              />
            </div>
            
            {/* Status de Publicação */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>Status de Publicação</label>
              <div style={{ display: 'flex', gap: 16 }}>
                {['Ativo', 'Pausado', 'Desativado'].map(status => (
                  <label key={status} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="statusPublicacao"
                      checked={statusPublicacao === status as any}
                      onChange={() => setStatusPublicacao(status as any)}
                    />
                    {status}
                  </label>
                ))}
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    color: '#666',
                    padding: '10px 24px',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => setEtapa(3)}
                  style={{ background: 'none', border: 'none', color: '#007bff', fontWeight: 500, cursor: 'pointer' }}
                >Voltar</button>
              </div>
              <button
                onClick={() => setEtapa(7)}
                style={{
                  background: '#007bff',
                  color: '#fff',
                  padding: '10px 24px',
                  border: 'none',
                  borderRadius: 4,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                type="button"
              >Avançar</button>
            </div>
          </form>
        </div>
      )}
      
      {/* Etapa 7: Resumo (antigo Etapa 8) */}
      {etapa === 7 && tipoImovel === 'Apartamento' && (
        <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Resumo do Imóvel</h2>
          
          <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, marginBottom: 24 }}>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Informações Gerais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
              <div><strong>Tipo:</strong> {tipoImovel}</div>
              <div><strong>Nome:</strong> {formEmpreendimento.nomeEmpreendimento}</div>
              <div><strong>Endereço:</strong> {formEmpreendimento.rua}, {formEmpreendimento.numero}</div>
              <div><strong>Complemento:</strong> {formEmpreendimento.complemento || '-'}</div>
              <div><strong>Bairro:</strong> {formEmpreendimento.bairro}</div>
              <div><strong>Cidade/UF:</strong> {formEmpreendimento.cidade}/{formEmpreendimento.estado}</div>
              <div><strong>CEP:</strong> {formEmpreendimento.cep}</div>
              <div><strong>Blocos:</strong> {formEmpreendimento.blocos || '-'}</div>
              <div><strong>Andares:</strong> {formEmpreendimento.andares || '-'}</div>
              <div><strong>Aptos por Andar:</strong> {formEmpreendimento.aptosPorAndar || '-'}</div>
              <div><strong>Valor Condomínio:</strong> {formEmpreendimento.valorCondominio || '-'}</div>
            </div>
            
            <h4 style={{ marginTop: 16, borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 8 }}>Dados do Proprietário</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 12 }}>
              <div><strong>Nome:</strong> {formEmpreendimento.nomeProprietario || '-'}</div>
              <div><strong>Razão Social:</strong> {formEmpreendimento.razaoSocial || '-'}</div>
              <div><strong>CPF/CNPJ:</strong> {formEmpreendimento.cpfCnpj || '-'}</div>
              <div><strong>E-mail:</strong> {formEmpreendimento.emailProprietario || '-'}</div>
              <div><strong>Telefone:</strong> {formEmpreendimento.telefoneProprietario || '-'}</div>
            </div>
          </div>
          
          <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, marginBottom: 24 }}>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Dados do Apartamento</h3>
            {apartamentos.map((apto, idx) => (
              <div key={idx} style={{ marginBottom: 12, borderBottom: idx < apartamentos.length - 1 ? '1px solid #eee' : 'none', paddingBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                  <div><strong>Status:</strong> {apto.status}</div>
                  <div><strong>Área Privativa:</strong> {apto.areaPrivativa}m²</div>
                  <div><strong>Quartos:</strong> {apto.quartos}</div>
                  <div><strong>Suítes:</strong> {apto.suites || '-'}</div>
                  <div><strong>Banheiros:</strong> {apto.banheiros || '-'}</div>
                  <div><strong>Vagas:</strong> {apto.vagas || '-'}</div>
                  <div><strong>Tipo de Vaga:</strong> {apto.tipoVaga || '-'}</div>
                  <div><strong>Sacada/Varanda:</strong> {apto.sacada || '-'}</div>
                </div>
                {apto.caracteristicas.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    <strong>Características:</strong> {apto.caracteristicas.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* A seção de Mídia foi removida */}
          
          <div style={{ border: '1px solid #ddd', borderRadius: 4, padding: 16, marginBottom: 24 }}>
            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Informações Comerciais</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 12 }}>
              <div><strong>Valor de Venda:</strong> {valorVenda || '-'}</div>
              <div><strong>Status de Publicação:</strong> {statusPublicacao}</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div><strong>Título:</strong></div>
              <div style={{ fontSize: 14 }}>{tituloDescritivo || '-'}</div>
            </div>
            <div>
              <div><strong>Descrição:</strong></div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{descricaoCompleta || '-'}</div>
            </div>
          </div>
          
          {errorMessage && (
            <div style={{ 
              backgroundColor: '#f8d7da', 
              color: '#721c24', 
              padding: 12, 
              borderRadius: 4, 
              marginBottom: 16,
              border: '1px solid #f5c6cb' 
            }}>
              {errorMessage}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                style={{
                  background: 'transparent',
                  color: '#666',
                  padding: '10px 24px',
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  fontWeight: 500,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => setEtapa(6)}
                disabled={isSaving}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#007bff', 
                  fontWeight: 500, 
                  cursor: 'pointer',
                  opacity: isSaving ? 0.5 : 1 
                }}
              >
                Voltar
              </button>
            </div>
            <button
              onClick={cadastrarImovel}
              disabled={isSaving}
              style={{
                background: '#28a745',
                color: '#fff',
                padding: '12px 32px',
                border: 'none',
                borderRadius: 4,
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {isSaving ? (
                <>
                  <span style={{
                    width: 18,
                    height: 18,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #fff',
                    borderRadius: '50%',
                    display: 'inline-block'
                  }}></span>
                  Processando...
                </>
              ) : (modo === 'editar' ? 'Salvar Alterações' : 'Finalizar Cadastro')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
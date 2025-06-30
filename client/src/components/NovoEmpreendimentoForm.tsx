import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

type ProprietarioResultado = {
  id: string;
  nome: string;
  tipo?: string;
};

type ProprietarioPF = {
  id: string;
  tipo: 'PessoaFisica';
  nome: string;
  cpf?: string;
  email?: string;
  telefone?: string;
};

type ContatoConstrutora = {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
};

type Construtora = {
  id: string;
  tipo: 'Construtora';
  nome: string;
  nomeConstrutora?: string; // Nome vindo do banco de dados
  razaoSocial?: string;
  cpfCnpj?: string;
  contatos?: ContatoConstrutora[];
};

type Proprietario = ProprietarioPF | Construtora;

type FormEmpreendimento = {
  nomeEmpreendimento: string;
  rua: string;
  numero: string;
  complemento: string;
  zona: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  blocos: string;
  andares: string;
  aptosPorAndar: string;
  valorCondominio: string;
  status: string;
  prazoEntrega: string;
};

interface NovoEmpreendimentoFormProps {
  empreendimentoId?: string | null;
  proprietarioId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

// Função para normalizar strings removendo acentos e caracteres especiais
function normalizar(str: string) {
  return str.normalize('NFD').replace(/[^\w\s]/gi, '').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Função utilitária para formatar moeda brasileira
function formatarMoedaBR(valor: string) {
  const somenteNumeros = valor.replace(/\D/g, '');
  const numero = Number(somenteNumeros) / 100;
  if (isNaN(numero)) return '';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Função para validar e formatar o valor do campo customizado
function validarPrazoEntregaCustom(valor: string) {
  const regex = /^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{4}$/i;
  return regex.test(valor.trim());
}

// Função para formatar o valor do mês/ano
function formatarPrazoEntrega(valor: string) {
  if (!valor || !/^\d{4}-\d{2}$/.test(valor)) return '';
  const [ano, mes] = valor.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mesNum = parseInt(mes, 10);
  if (mesNum < 1 || mesNum > 12) return '';
  // Deixar só a primeira letra maiúscula e o resto minúsculo
  const mesFormatado = meses[mesNum - 1].charAt(0).toUpperCase() + meses[mesNum - 1].slice(1).toLowerCase();
  return `${mesFormatado}/${ano}`;
}

export const NovoEmpreendimentoForm: React.FC<NovoEmpreendimentoFormProps> = ({
  empreendimentoId,
  proprietarioId,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState(1);
  const [, navigate] = useLocation();
  
  // Estado para busca e seleção de proprietário
  const [buscaProprietario, setBuscaProprietario] = useState('');
  const [proprietarioSelecionado, setProprietarioSelecionado] = useState<ProprietarioResultado | null>(null);
  const [dadosProprietario, setDadosProprietario] = useState<Proprietario | null>(null);
  const [buscandoDetalhes, setBuscandoDetalhes] = useState(false);
  
  // Estado para formulário de empreendimento
  const [formEmpreendimento, setFormEmpreendimento] = useState<FormEmpreendimento>({
    nomeEmpreendimento: '',
    rua: '',
    numero: '',
    complemento: '',
    zona: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    blocos: '',
    andares: '',
    aptosPorAndar: '',
    valorCondominio: '',
    status: '',
    prazoEntrega: '',
  });
  
  // Verificar se existe um nome de empreendimento armazenado no localStorage (vindo da busca na página de imóveis)
  useEffect(() => {
    // Só recuperar do localStorage se não for um modo de edição
    if (!empreendimentoId) {
      const nomeEmpreendimentoSalvo = localStorage.getItem('novoEmpreendimentoNome');
      if (nomeEmpreendimentoSalvo) {
        // Atualizar o estado do formulário com o nome do empreendimento salvo
        setFormEmpreendimento(prev => ({
          ...prev,
          nomeEmpreendimento: nomeEmpreendimentoSalvo
        }));
        // Limpar o localStorage após uso
        localStorage.removeItem('novoEmpreendimentoNome');
      }
    }
  }, [empreendimentoId]);
  
  // Estados para checkboxes de serviços e lazer
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);
  const [lazerSelecionados, setLazerSelecionados] = useState<string[]>([]);
  
  // Estados para upload de arquivos
  const [fotos, setFotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [fotosPreview, setFotosPreview] = useState<string[]>([]);
  const [videosPreview, setVideosPreview] = useState<string[]>([]);
  const [fotoCapaIndex, setFotoCapaIndex] = useState<number | null>(null);
  
  // Estado para controlar o envio do formulário
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Opções para checkboxes
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

  // Adicionar opções de meses e anos
  const meses = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 10 }, (_, i) => anoAtual + i);

  // Função para atualizar o prazo de entrega com selects
  const handlePrazoEntregaChange = (mes: string, ano: string) => {
    if (mes && ano) {
      setFormEmpreendimento(prev => ({
        ...prev,
        prazoEntrega: `${ano}-${mes}`
      }));
    }
  };

  // Extrair mês e ano do valor salvo
  const mesPrazo = formEmpreendimento.prazoEntrega ? formEmpreendimento.prazoEntrega.split('-')[1] : '';
  const anoPrazo = formEmpreendimento.prazoEntrega ? formEmpreendimento.prazoEntrega.split('-')[0] : '';

  // Consulta para buscar proprietários baseado na busca
  const { data: proprietarios, isLoading } = useQuery({
    queryKey: ['buscar-proprietarios', buscaProprietario],
    queryFn: async () => {
      const response = await axios.get(`/api/proprietarios?search=${encodeURIComponent(buscaProprietario)}`);
      return response.data as ProprietarioResultado[];
    },
    enabled: buscaProprietario.length >= 3,
  });

  // Efeito para carregar proprietário a partir do ID quando o modal for aberto
  useEffect(() => {
    if (proprietarioId) {
      const fetchProprietario = async () => {
        try {
          // Buscar dados do proprietário
          const response = await axios.get(`/api/proprietarios/${proprietarioId}`);
          const proprietario = response.data;
          
          // Selecionar o proprietário automaticamente
          setProprietarioSelecionado({
            id: proprietario.id,
            nome: proprietario.tipo === 'Construtora' 
              ? proprietario.nomeConstrutora || proprietario.nome 
              : proprietario.nome
          });
          
          // Definir os dados do proprietário
          setDadosProprietario(proprietario);
          
          // Atualizar o campo de busca para exibir o nome do proprietário
          setBuscaProprietario(
            proprietario.tipo === 'Construtora' 
              ? proprietario.nomeConstrutora || proprietario.nome 
              : proprietario.nome
          );
          
          // Avançar diretamente para a etapa 2 se o proprietário for selecionado via URL
          setEtapa(2);
        } catch (error) {
          
          toast({
            title: 'Erro',
            description: 'Não foi possível carregar os dados do proprietário.',
            variant: 'destructive',
          });
        }
      };
      
      fetchProprietario();
    }
  }, [proprietarioId, toast]);

  // Buscar dados do empreendimento para edição
  useEffect(() => {
    if (empreendimentoId) {
      const fetchEmpreendimento = async () => {
        try {
          const response = await axios.get(`/api/empreendimentos-page/${empreendimentoId}`);
          const dados = response.data;
          
          // Preencher formulário com dados do empreendimento
          setFormEmpreendimento({
            nomeEmpreendimento: dados.nomeEmpreendimento || '',
            rua: dados.ruaAvenidaEmpreendimento || '',
            numero: dados.numeroEmpreendimento || '',
            complemento: dados.complementoEmpreendimento || '',
            zona: dados.zonaEmpreendimento || '',
            bairro: dados.bairroEmpreendimento || '',
            cidade: dados.cidadeEmpreendimento || '',
            estado: dados.estadoEmpreendimento || '',
            cep: dados.cepEmpreendimento || '',
            blocos: dados.blocoTorresEmpreendimento || '',
            andares: dados.andaresEmpreendimento || '',
            aptosPorAndar: dados.aptoAndarEmpreendimento || '',
            valorCondominio: dados.valorCondominioEmpreendimento || '',
            status: dados.statusEmpreendimento || '',
            prazoEntrega: dados.prazoEntregaEmpreendimento || '',
          });
          
          // Preencher serviços e lazer
          if (dados.itensServicosEmpreendimento) {
            setServicosSelecionados(dados.itensServicosEmpreendimento);
          }
          
          if (dados.itensLazerEmpreendimento) {
            setLazerSelecionados(dados.itensLazerEmpreendimento);
          }
          
          // Setar proprietário selecionado ao editar
          console.log('DADOS DO EMPREENDIMENTO:', dados);
          if (dados.id_construtora && dados.nomeConstrutora) {
            setProprietarioSelecionado({
              id: dados.id_construtora,
              nome: dados.nomeConstrutora,
              tipo: 'Construtora',
            });
            // Preencher também dadosProprietario para o restante do formulário
            setDadosProprietario({
              id: dados.id_construtora,
              tipo: 'Construtora',
              nome: dados.nomeConstrutora,
              nomeConstrutora: dados.nomeConstrutora,
              razaoSocial: dados.razaoSocialConstrutora || '',
              cpfCnpj: dados.cnpjConstrutora || '',
              contatos: dados.contatosConstrutora || [],
            });
          } else if (dados.proprietarioId && dados.nomeProprietario) {
            setProprietarioSelecionado({
              id: dados.proprietarioId,
              nome: dados.nomeProprietario,
              tipo: dados.tipoProprietario || 'Construtora',
            });
          }
          
          // Já ir para a segunda etapa
          setEtapa(2);
        } catch (error) {
          
          toast({
            title: 'Erro',
            description: 'Não foi possível carregar os dados do empreendimento.',
            variant: 'destructive',
          });
        }
      };
      
      fetchEmpreendimento();
    }
  }, [empreendimentoId, toast]);

  // Buscar dados completos do proprietário selecionado
  useEffect(() => {
    if (proprietarioSelecionado && !dadosProprietario) {
      // Evitar fazer a busca se já estamos com os dados carregados pelo proprietarioId
      setBuscandoDetalhes(true);
      axios.get(`/api/proprietarios/${proprietarioSelecionado.id}`)
        .then(response => {
          setDadosProprietario(response.data);
        })
        .catch(error => {
          
          toast({
            title: 'Erro',
            description: 'Não foi possível carregar os detalhes do proprietário.',
            variant: 'destructive',
          });
          setDadosProprietario(null);
        })
        .finally(() => {
          setBuscandoDetalhes(false);
        });
    } else if (!proprietarioSelecionado) {
      setDadosProprietario(null);
    }
  }, [proprietarioSelecionado, dadosProprietario, toast]);

  // Filtrar proprietários pelo nome digitado (case insensitive e sem acentos)
  const proprietariosFiltrados = proprietarios?.filter(p =>
    normalizar(p.nome).includes(normalizar(buscaProprietario))
  ) || [];

  // Verificar o tipo do proprietário para exibir os detalhes corretamente
  const isProprietarioPF = dadosProprietario?.tipo === 'PessoaFisica';
  const isConstrutora = dadosProprietario?.tipo === 'Construtora';
  const proprietarioPF = isProprietarioPF ? dadosProprietario as ProprietarioPF : null;
  const construtora = isConstrutora ? dadosProprietario as Construtora : null;

  // Função para buscar endereço usando a API do Google Maps
  const buscarEndereco = async (rua: string, numero: string) => {
    try {
      if (!rua || !numero) return;

      const endereco = `${rua}, ${numero}, Brasil`;
      const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
        params: {
          address: endereco,
          key: 'AIzaSyCGpudo_9LvuY9f7P4P3Ub61aIHGcck5d0'
        }
      });

      if (response.data.results && response.data.results.length > 0) {
        const resultado = response.data.results[0];
        const enderecoComponents = resultado.address_components;

        // Função auxiliar para encontrar componente do endereço
        const encontrarComponente = (tipo: string) => {
          const componente = enderecoComponents.find((comp: any) => 
            comp.types.includes(tipo)
          );
          return componente ? componente.long_name : '';
        };

        // Tentar obter a zona a partir de diferentes componentes do endereço
        let zonaEncontrada = '';
        // Verificar se existe um componente locality (pode conter dados como "Zona Sul")
        const localityComponent = enderecoComponents.find((comp: any) => 
          comp.types.includes('locality') || comp.types.includes('neighborhood')
        );
        
        if (localityComponent) {
          const localityName = localityComponent.long_name || '';
          // Verificar se o nome da localidade contém "Zona"
          if (localityName.toLowerCase().includes('zona')) {
            zonaEncontrada = localityName;
          }
        }
        
        // Se não encontrou nos dados diretos, tentar inferir baseado em bairros conhecidos
        // ou mapeamentos específicos para determinadas cidades
        if (!zonaEncontrada) {
          const bairro = encontrarComponente('sublocality');
          const cidade = encontrarComponente('administrative_area_level_2');
          
          // Mapeamento específico para bairros de Uberlândia
          if (cidade && cidade.toLowerCase() === 'uberlândia') {
            // Lista de bairros da Zona Leste de Uberlândia (exemplo parcial)
            const bairrosZonaLeste = [
              'alfredo bosi', 'alto umuarama', 'alvorada', 'aclimação', 'custódio pereira', 
              'dom almir', 'granja marileusa', 'integração', 'morumbi', 'nova alvorada', 
              'novo mundo', 'portal das águas', 'residencial pequis', 'segismundo pereira', 
              'shopping park', 'umuarama', 'sucupira'
            ];
            
            // Lista de bairros da Zona Oeste de Uberlândia (exemplo parcial)
            const bairrosZonaOeste = [
              'chácaras tubalina', 'jardim holanda', 'jardim patrícia', 'jardim umuarama', 
              'luizote de freitas', 'mansões aeroporto', 'morada nova', 'nova uberlândia', 
              'são lucas', 'taiaman', 'tubalina', 'planalto'
            ];
            
            // Lista de bairros da Zona Norte de Uberlândia (exemplo parcial)
            const bairrosZonaNorte = [
              'carajás', 'jardim brasília', 'marta helena', 'maravilha', 'nossa senhora das graças', 
              'pacaembu', 'residencial gramado', 'residencial liberdade', 'roosevelt', 
              'santa rosa', 'santo inácio', 'tocantins'
            ];
            
            // Lista de bairros da Zona Sul de Uberlândia (exemplo parcial)
            const bairrosZonaSul = [
              'carajás', 'cidade jardim', 'gávea', 'granada', 'jardim karaíba', 
              'lagoinha', 'laranjeiras', 'morada da colina', 'nova uberlândia', 
              'pampulha', 'patrimônio', 'saraiva', 'vigilato pereira'
            ];
            
            // Lista de bairros do Centro de Uberlândia (exemplo parcial)
            const bairrosCentro = [
              'centro', 'fundinho', 'aparecida', 'martins', 'osvaldo rezende', 
              'bom jesus', 'daniel fonseca', 'lídice'
            ];
            
            // Se temos um bairro, verificar se está em alguma das listas
            if (bairro) {
              const bairroLower = bairro.toLowerCase();
              
              if (bairrosZonaLeste.some(b => bairroLower.includes(b))) {
                zonaEncontrada = 'Zona Leste';
              } else if (bairrosZonaOeste.some(b => bairroLower.includes(b))) {
                zonaEncontrada = 'Zona Oeste';
              } else if (bairrosZonaNorte.some(b => bairroLower.includes(b))) {
                zonaEncontrada = 'Zona Norte';
              } else if (bairrosZonaSul.some(b => bairroLower.includes(b))) {
                zonaEncontrada = 'Zona Sul';
              } else if (bairrosCentro.some(b => bairroLower.includes(b))) {
                zonaEncontrada = 'Centro';
              }
            }
            
            // Se ainda não encontrou por nome do bairro, tentar pelo endereço completo
            if (!zonaEncontrada) {
              const rua = encontrarComponente('route');
              if (rua) {
                const ruaLower = rua.toLowerCase();
                // Lista de ruas da Zona Leste de Uberlândia (exemplo parcial)
                const ruasZonaLeste = ['alfredo bosi'];
                
                if (ruasZonaLeste.some(r => ruaLower.includes(r))) {
                  zonaEncontrada = 'Zona Leste';
                }
              }
            }
          } else {
            // Lógica genérica para outras cidades
            if (bairro) {
              // Essa é uma lógica simplificada para cidades que não têm mapeamento específico
              const bairroLower = bairro.toLowerCase();
              if (bairroLower.includes('norte')) {
                zonaEncontrada = 'Zona Norte';
              } else if (bairroLower.includes('sul')) {
                zonaEncontrada = 'Zona Sul';
              } else if (bairroLower.includes('leste')) {
                zonaEncontrada = 'Zona Leste';
              } else if (bairroLower.includes('oeste')) {
                zonaEncontrada = 'Zona Oeste';
              } else if (bairroLower.includes('central') || bairroLower.includes('centro')) {
                zonaEncontrada = 'Zona Central';
              }
            }
          }
        }
        
        setFormEmpreendimento(prev => ({
          ...prev,
          zona: zonaEncontrada || prev.zona,
          bairro: encontrarComponente('sublocality') || prev.bairro,
          cidade: encontrarComponente('administrative_area_level_2') || prev.cidade,
          estado: encontrarComponente('administrative_area_level_1') || prev.estado,
          cep: encontrarComponente('postal_code') || prev.cep
        }));
      }
    } catch (error) {
      
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar o endereço automaticamente.',
        variant: 'destructive',
      });
    }
  };

  // Função para lidar com mudanças nos inputs do formulário
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'valorCondominio') {
      setFormEmpreendimento(prev => ({
        ...prev,
        [name]: formatarMoedaBR(value)
      }));
      return;
    }
    setFormEmpreendimento(prev => ({
      ...prev,
      [name]: value
    }));

    // Se o campo alterado for rua ou número, buscar endereço
    if (name === 'rua' || name === 'numero') {
      const rua = name === 'rua' ? value : formEmpreendimento.rua;
      const numero = name === 'numero' ? value : formEmpreendimento.numero;
      
      // Aguardar um pouco antes de fazer a busca para evitar muitas requisições
      if (rua && numero) {
        setTimeout(() => {
          buscarEndereco(rua, numero);
        }, 1000);
      }
    }
  };

  // Função para lidar com mudanças nos checkboxes de serviços
  const handleServicoChange = (servico: string) => {
    setServicosSelecionados(prev => {
      if (prev.includes(servico)) {
        return prev.filter(s => s !== servico);
      } else {
        return [...prev, servico];
      }
    });
  };

  // Função para lidar com mudanças nos checkboxes de lazer
  const handleLazerChange = (lazer: string) => {
    setLazerSelecionados(prev => {
      if (prev.includes(lazer)) {
        return prev.filter(l => l !== lazer);
      } else {
        return [...prev, lazer];
      }
    });
  };

  // Função para avançar para a próxima etapa
  const avancarEtapa = () => {
    // Se for novo, exigir proprietário
    if (etapa === 1 && !empreendimentoId && !proprietarioSelecionado) {
      toast({
        title: 'Atenção',
        description: 'Selecione um proprietário para continuar.',
        variant: 'default',
      });
      return;
    }
    setEtapa(prev => prev + 1);
  };

  // Função para voltar para a etapa anterior
  const voltarEtapa = () => {
    setEtapa(prev => prev - 1);
  };

  // Funções para manipular uploads de fotos
  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const novasFotos = Array.from(e.target.files);
      
      // Verificar tamanho máximo de 100MB por arquivo
      const fotosValidas = novasFotos.filter(foto => foto.size <= 100 * 1024 * 1024); // 100MB
      
      if (fotosValidas.length < novasFotos.length) {
        toast({
          title: 'Atenção',
          description: 'Algumas fotos excedem o limite de 100MB e foram ignoradas.',
          variant: 'default',
        });
      }
      
      // Criar previews das fotos
      const novosPreview = fotosValidas.map(foto => URL.createObjectURL(foto));
      
      setFotos(prev => [...prev, ...fotosValidas]);
      setFotosPreview(prev => [...prev, ...novosPreview]);
    }
  };
  
  // Função para manipular uploads de vídeos
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const novosVideos = Array.from(e.target.files);
      
      // Verificar tamanho máximo de 2GB por arquivo
      const videosValidos = novosVideos.filter(video => video.size <= 2 * 1024 * 1024 * 1024); // 2GB
      
      if (videosValidos.length < novosVideos.length) {
        toast({
          title: 'Atenção',
          description: 'Alguns vídeos excedem o limite de 2GB e foram ignorados.',
          variant: 'default',
        });
      }
      
      // Criar previews dos vídeos (nome do arquivo)
      const novosPreview = videosValidos.map(video => URL.createObjectURL(video));
      
      setVideos(prev => [...prev, ...videosValidos]);
      setVideosPreview(prev => [...prev, ...novosPreview]);
    }
  };
  
  // Função para remover foto
  const removerFoto = (index: number) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(fotosPreview[index]); // Liberar memória do preview
    setFotosPreview(prev => prev.filter((_, i) => i !== index));
    
    // Se a foto removida era a capa, resetar a capa
    if (fotoCapaIndex === index) {
      setFotoCapaIndex(null);
    } else if (fotoCapaIndex !== null && fotoCapaIndex > index) {
      // Ajustar o índice da capa se for após a foto removida
      setFotoCapaIndex(fotoCapaIndex - 1);
    }
  };
  
  // Função para remover vídeo
  const removerVideo = (index: number) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(videosPreview[index]); // Liberar memória do preview
    setVideosPreview(prev => prev.filter((_, i) => i !== index));
  };
  
  // Função para definir foto como capa
  const definirFotoCapa = (index: number) => {
    setFotoCapaIndex(index);
  };

  // Função para cadastrar empreendimento
  const cadastrarEmpreendimento = async () => {
    try {
      if (!formEmpreendimento.nomeEmpreendimento) {
        toast({
          title: 'Erro',
          description: 'Nome do empreendimento é obrigatório.',
          variant: 'destructive',
        });
        return;
      }
      
      // Só validar proprietário em cadastro novo, não na edição
      if (!empreendimentoId && !proprietarioSelecionado) {
        toast({
          title: 'Erro',
          description: 'Selecione um proprietário para o empreendimento.',
          variant: 'destructive',
        });
        setEtapa(1);
        return;
      }
      
      setIsSaving(true);
      setErrorMessage(null);
      
      // Criar FormData para enviar arquivos junto com dados
      const formData = new FormData();
      
      // Adicionar fotos ao FormData
      fotos.forEach(foto => {
        formData.append('fotos', foto);
      });
      
      // Adicionar vídeos ao FormData
      videos.forEach(video => {
        formData.append('videos', video);
      });
      
      // Adicionar índice da foto de capa, se existir
      if (fotoCapaIndex !== null) {
        formData.append('fotoCapaIndex', fotoCapaIndex.toString());
      }
      
      // Montar dados do empreendimento
      // Determinar proprietário e contato com base no tipo
      let nomeProprietarioTexto = '';
      let contatoProprietarioTexto = '';
      let telefoneProprietarioTexto = '';
      let tipoProprietarioTexto = 'Construtora';

      // Na edição, quando não temos proprietarioSelecionado, usamos os dados existentes
      if (empreendimentoId && !proprietarioSelecionado) {
        // Manter os dados existentes se estivermos em uma edição
        const response = await axios.get(`/api/empreendimentos-page/${empreendimentoId}`);
        const empreendimentoAtual = response.data;
        
        nomeProprietarioTexto = empreendimentoAtual.nomeProprietario || '';
        contatoProprietarioTexto = empreendimentoAtual.contatoProprietario || '';
        telefoneProprietarioTexto = empreendimentoAtual.telefoneProprietario || '';
        tipoProprietarioTexto = empreendimentoAtual.tipoProprietario || 'Construtora';
      } else if (isConstrutora && construtora) {
        // Se for construtora, usar nome da construtora (não a razão social)
        nomeProprietarioTexto = construtora.nomeConstrutora || construtora.nome || '';
        tipoProprietarioTexto = 'Construtora';
        
        // Usar o nome do primeiro contato da construtora como contato principal
        if (construtora.contatos && construtora.contatos.length > 0) {
          contatoProprietarioTexto = construtora.contatos[0].nome || '';
          telefoneProprietarioTexto = construtora.contatos[0].telefone || '';
        }
      } else if (isProprietarioPF && proprietarioPF) {
        // Se for pessoa física, usar nome e email
        nomeProprietarioTexto = proprietarioPF.nome || '';
        contatoProprietarioTexto = proprietarioPF.email || '';
        telefoneProprietarioTexto = proprietarioPF.telefone || '';
        tipoProprietarioTexto = 'PF';
      }

      const dadosEmpreendimento = {
        // Dados do Proprietário
        tipoProprietario: proprietarioSelecionado ? proprietarioSelecionado.tipo : tipoProprietarioTexto,
        nomeProprietario: nomeProprietarioTexto,
        contatoProprietario: contatoProprietarioTexto,
        telefoneProprietario: telefoneProprietarioTexto,
        
        // Dados do Empreendimento
        nomeEmpreendimento: formEmpreendimento.nomeEmpreendimento,
        ruaAvenidaEmpreendimento: formEmpreendimento.rua,
        numeroEmpreendimento: formEmpreendimento.numero,
        complementoEmpreendimento: formEmpreendimento.complemento,
        zonaEmpreendimento: formEmpreendimento.zona,
        bairroEmpreendimento: formEmpreendimento.bairro,
        cidadeEmpreendimento: formEmpreendimento.cidade,
        estadoEmpreendimento: formEmpreendimento.estado,
        cepEmpreendimento: formEmpreendimento.cep,
        blocoTorresEmpreendimento: formEmpreendimento.blocos,
        andaresEmpreendimento: formEmpreendimento.andares,
        aptoAndarEmpreendimento: formEmpreendimento.aptosPorAndar,
        valorCondominioEmpreendimento: formEmpreendimento.valorCondominio,
        statusEmpreendimento: formEmpreendimento.status,
        prazoEntregaEmpreendimento: formEmpreendimento.prazoEntrega,
        itensServicosEmpreendimento: servicosSelecionados,
        itensLazerEmpreendimento: lazerSelecionados,
        
        // Tipo de Imóvel (fixo como Apartamento por enquanto)
        tipoImovel: 'Apartamento',
      };
      
      // Adicionar os dados do empreendimento como JSON
      formData.append('dadosEmpreendimento', JSON.stringify(dadosEmpreendimento));
      
      if (empreendimentoId) {
        // Atualizar empreendimento existente
        await axios.put(`/api/empreendimentos-page/${empreendimentoId}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        toast({
          title: 'Sucesso',
          description: 'Empreendimento atualizado com sucesso!',
          variant: 'default',
        });
      } else {
        // Cadastrar novo empreendimento
        await axios.post('/api/empreendimentos-page', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        toast({
          title: 'Sucesso',
          description: 'Empreendimento cadastrado com sucesso!',
          variant: 'default',
        });
      }
      
      // Atualizar a lista de empreendimentos
      queryClient.invalidateQueries({ queryKey: ['empreendimentos'] });
      
      // Chamar callback de sucesso
      onSuccess();
    } catch (error: any) {
      
      
      // Extrair mensagem detalhada do erro
      let mensagem = 'Erro ao cadastrar empreendimento.';
      
      if (error.response) {
        // O servidor respondeu com um status diferente de 2xx
        const detalhes = error.response.data?.details || error.response.data?.message || error.response.statusText;
        mensagem = `Erro ao cadastrar empreendimento: ${detalhes}`;
        
      } else if (error.request) {
        // A requisição foi feita mas não houve resposta
        mensagem = 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.';
      } else {
        // Erro na configuração da requisição
        mensagem = `Erro ao enviar dados: ${error.message}`;
      }
      
      setErrorMessage(mensagem);
      toast({
        title: 'Erro',
        description: mensagem,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Renderizar etapa 1: Seleção de proprietário
  const renderEtapa1 = () => (
    <div>
      <h2 className="text-xl font-semibold mb-4">Selecione o proprietário</h2>
      <input
        type="text"
        placeholder="Digite o nome do proprietário..."
        value={buscaProprietario}
        onChange={e => {
          setBuscaProprietario(e.target.value);
          setProprietarioSelecionado(null);
        }}
        className="w-full p-2 border border-gray-300 rounded mb-2"
      />
      
      {buscaProprietario.length >= 3 && (
        <div className="border border-gray-300 rounded max-h-40 overflow-y-auto">
          {isLoading && <div className="p-2">Buscando...</div>}
          {proprietariosFiltrados.length === 0 && !isLoading && (
            <div className="p-2 text-center">
              <p className="text-gray-500 mb-4">Nenhum proprietário encontrado com este termo.</p>
              <button
                onClick={() => navigate('/proprietarios?abrirModal=true')}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              >
                Cadastrar Novo Proprietário
              </button>
            </div>
          )}
          {proprietariosFiltrados.map(p => (
            <div
              key={p.id}
              className={`p-2 cursor-pointer ${proprietarioSelecionado?.id === p.id ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
              onClick={() => setProprietarioSelecionado(p)}
            >
              {p.nome}
            </div>
          ))}
        </div>
      )}
      
      {proprietarioSelecionado && (
        <div className="mt-4">
          <strong>Selecionado:</strong> {proprietarioSelecionado.nome}
          
          {buscandoDetalhes && (
            <div className="mt-2 text-sm text-gray-600">
              Carregando detalhes...
            </div>
          )}
          
          {dadosProprietario && !buscandoDetalhes && (
            <div className="mt-2 p-3 border border-gray-300 rounded bg-gray-50">
              {/* Exibir dados comuns para ambos os tipos */}
              <div className="font-semibold mb-2">
                Tipo: {isProprietarioPF ? 'Pessoa Física' : 'Construtora'}
              </div>
              
              {/* Condicional para pessoa física */}
              {isProprietarioPF && proprietarioPF && (
                <>
                  <div><strong>Nome:</strong> {proprietarioPF.nome}</div>
                  {proprietarioPF.cpf && (
                    <div><strong>CPF:</strong> {proprietarioPF.cpf}</div>
                  )}
                  {proprietarioPF.email && (
                    <div><strong>Email:</strong> {proprietarioPF.email}</div>
                  )}
                  {proprietarioPF.telefone && (
                    <div><strong>Telefone:</strong> {proprietarioPF.telefone}</div>
                  )}
                </>
              )}
              
              {/* Condicional para construtora */}
              {isConstrutora && construtora && (
                <>
                  <div><strong>Nome da Construtora:</strong> {construtora.nomeConstrutora || construtora.nome || ''}</div>
                  {construtora.razaoSocial && (
                    <div><strong>Razão Social:</strong> {construtora.razaoSocial}</div>
                  )}
                  {construtora.cpfCnpj && (
                    <div><strong>CPF/CNPJ:</strong> {construtora.cpfCnpj}</div>
                  )}
                  
                  {/* Exibir contatos da construtora */}
                  {construtora.contatos && construtora.contatos.length > 0 && (
                    <div className="mt-2">
                      <strong>Contato Principal:</strong>
                      <div className="pl-3 mt-1">
                        <div>{construtora.contatos[0].nome}</div>
                        {construtora.contatos[0].telefone && (
                          <div>Tel: {construtora.contatos[0].telefone}</div>
                        )}
                        {construtora.contatos[0].email && (
                          <div>Email: {construtora.contatos[0].email}</div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="mt-6 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded mr-2"
        >
          Cancelar
        </button>
        
        <button
          onClick={avancarEtapa}
          disabled={!empreendimentoId && !proprietarioSelecionado}
          className={`px-4 py-2 rounded ${
            (empreendimentoId || proprietarioSelecionado)
              ? 'bg-blue-500 hover:bg-blue-600 text-white' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Avançar
        </button>
      </div>
    </div>
  );

  // Renderizar etapa 2: Dados do empreendimento
  const renderEtapa2 = () => (
    <div>
      <h2 className="text-xl font-semibold mb-4">Dados do Empreendimento</h2>
      
      <div className="grid grid-cols-1 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Nome do Empreendimento</label>
          <input
            type="text"
            name="nomeEmpreendimento"
            value={formEmpreendimento.nomeEmpreendimento}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
            required
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Rua/Avenida</label>
          <input
            type="text"
            name="rua"
            value={formEmpreendimento.rua}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Número</label>
          <input
            type="text"
            name="numero"
            value={formEmpreendimento.numero}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Complemento</label>
          <input
            type="text"
            name="complemento"
            value={formEmpreendimento.complemento}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Zona</label>
          <input
            type="text"
            name="zona"
            value={formEmpreendimento.zona}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bairro</label>
          <input
            type="text"
            name="bairro"
            value={formEmpreendimento.bairro}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Cidade</label>
          <input
            type="text"
            name="cidade"
            value={formEmpreendimento.cidade}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Estado</label>
          <input
            type="text"
            name="estado"
            value={formEmpreendimento.estado}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">CEP</label>
          <input
            type="text"
            name="cep"
            value={formEmpreendimento.cep}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Blocos/Torres</label>
          <input
            type="text"
            name="blocos"
            value={formEmpreendimento.blocos}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Andares</label>
          <input
            type="text"
            name="andares"
            value={formEmpreendimento.andares}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Aptos por Andar</label>
          <input
            type="text"
            name="aptosPorAndar"
            value={formEmpreendimento.aptosPorAndar}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          />
        </div>
      </div>
      
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Valor do Condomínio</label>
          <input
            type="text"
            name="valorCondominio"
            value={formEmpreendimento.valorCondominio}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="R$ 0,00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            name="status"
            value={formEmpreendimento.status}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded"
          >
            <option value="">Selecione o status</option>
            <option value="Pronto">Pronto</option>
            <option value="Lançamento">Lançamento</option>
            <option value="Em Construção">Em Construção</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Prazo de Entrega</label>
          <input
            type="text"
            name="prazoEntrega"
            value={formEmpreendimento.prazoEntrega}
            onChange={e => {
              const valor = e.target.value;
              // Permitir apenas letras e números, barra e limitar tamanho
              if (valor.length <= 8) {
                setFormEmpreendimento(prev => ({ ...prev, prazoEntrega: valor }));
              }
            }}
            className={`w-full p-2 border ${validarPrazoEntregaCustom(formEmpreendimento.prazoEntrega) || !formEmpreendimento.prazoEntrega ? 'border-gray-300' : 'border-red-500'} rounded`}
            placeholder="Ex: Nov/2025"
            maxLength={8}
            autoComplete="off"
          />
          {!validarPrazoEntregaCustom(formEmpreendimento.prazoEntrega) && formEmpreendimento.prazoEntrega && (
            <div className="mt-1 text-xs text-red-500">Formato inválido. Use MMM/AAAA (ex: Nov/2025)</div>
          )}
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Itens de Serviços</h3>
        <div className="grid grid-cols-3 gap-2">
          {servicosOpcoes.map(servico => (
            <div key={servico} className="flex items-center">
              <input
                type="checkbox"
                id={`servico-${servico}`}
                checked={servicosSelecionados.includes(servico)}
                onChange={() => handleServicoChange(servico)}
                className="mr-2"
              />
              <label htmlFor={`servico-${servico}`} className="text-sm">
                {servico}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Itens de Lazer</h3>
        <div className="grid grid-cols-3 gap-2">
          {lazerOpcoes.map(lazer => (
            <div key={lazer} className="flex items-center">
              <input
                type="checkbox"
                id={`lazer-${lazer}`}
                checked={lazerSelecionados.includes(lazer)}
                onChange={() => handleLazerChange(lazer)}
                className="mr-2"
              />
              <label htmlFor={`lazer-${lazer}`} className="text-sm">
                {lazer}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {errorMessage}
        </div>
      )}
      
      <div className="mt-6 flex justify-between">
        <button
          onClick={voltarEtapa}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
        >
          Voltar
        </button>
        
        <div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded mr-2"
          >
            Cancelar
          </button>
          
          <button
            onClick={avancarEtapa}
            disabled={!formEmpreendimento.nomeEmpreendimento}
            className={`px-4 py-2 rounded ${
              formEmpreendimento.nomeEmpreendimento
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Avançar
          </button>
        </div>
      </div>
    </div>
  );

  // Renderizar etapa 3: Upload de fotos
  const renderEtapa3 = () => (
    <div>
      <h2 className="text-xl font-semibold mb-4">Fotos do Imóvel</h2>
      
      <div className="mb-6">
        <label htmlFor="foto-upload" className="block text-sm font-medium text-gray-700 mb-2">
          <button 
            onClick={() => document.getElementById('foto-upload')?.click()}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition duration-150"
            type="button"
          >
            Adicionar Fotos
          </button>
          <span className="ml-3 text-sm text-gray-500">(JPG, JPEG, PNG, WEBP até 100MB cada)</span>
        </label>
        <input
          type="file"
          id="foto-upload"
          accept="image/*"
          multiple
          onChange={handleFotoUpload}
          className="hidden"
        />
      </div>
      
      {fotosPreview.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {fotosPreview.map((url, idx) => (
            <div key={idx} className="relative rounded-md overflow-hidden border border-gray-300 bg-gray-100">
              <img 
                src={url} 
                alt={`Foto ${idx + 1}`} 
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 right-2">
                <button
                  type="button"
                  onClick={() => removerFoto(idx)}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >
                  &times;
                </button>
              </div>
              <div className="p-2 bg-white">
                <button
                  type="button"
                  onClick={() => definirFotoCapa(idx)}
                  className={`text-sm px-3 py-1 rounded ${fotoCapaIndex === idx 
                    ? 'bg-green-500 text-white' 
                    : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
                >
                  {fotoCapaIndex === idx ? 'Capa' : 'Definir capa'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={voltarEtapa}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={avancarEtapa}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Avançar
        </button>
      </div>
    </div>
  );
  
  // Renderizar etapa 4: Upload de vídeos
  const renderEtapa4 = () => (
    <div>
      <h2 className="text-xl font-semibold mb-4">Vídeos do Imóvel <span className="text-sm font-normal text-gray-500">(opcional)</span></h2>
      
      <div className="mb-6">
        <label htmlFor="video-upload" className="block text-sm font-medium text-gray-700 mb-2">
          <button 
            onClick={() => document.getElementById('video-upload')?.click()}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition duration-150"
            type="button"
          >
            Adicionar Vídeos
          </button>
          <span className="ml-3 text-sm text-gray-500">(MP4, WEBM, MOV, AVI até 2GB cada)</span>
        </label>
        <input
          type="file"
          id="video-upload"
          accept="video/*"
          multiple
          onChange={handleVideoUpload}
          className="hidden"
        />
      </div>
      
      {videosPreview.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {videosPreview.map((url, idx) => (
            <div key={idx} className="relative rounded-md overflow-hidden border border-gray-300 bg-gray-100">
              <video 
                src={url} 
                controls
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-2 right-2">
                <button
                  type="button"
                  onClick={() => removerVideo(idx)}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center"
                >
                  &times;
                </button>
              </div>
              <div className="p-2 bg-white">
                <span className="text-sm text-gray-700 truncate block">
                  {videos[idx].name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={voltarEtapa}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={cadastrarEmpreendimento}
          disabled={isSaving}
          className={`${isSaving 
            ? 'bg-blue-300 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600'} text-white py-2 px-4 rounded`}
        >
          {isSaving ? 'Salvando...' : 'Finalizar Cadastro'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4">
      {etapa === 1 && !empreendimentoId && renderEtapa1()}
      {etapa === 2 && renderEtapa2()}
      {etapa === 3 && renderEtapa3()}
      {etapa === 4 && renderEtapa4()}
    </div>
  );
};
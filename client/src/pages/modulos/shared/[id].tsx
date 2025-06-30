import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import axios from 'axios';
import { useAuth } from '@/hooks/use-auth';
import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css";
import "@/styles/carousel.css";
import { Building2, MapPin, Users, Home, Ruler, Bath, Car, Trees as Tree, Shield, Info, Maximize2, X, Bed, Scissors, Trash, Edit, CheckCircle, Phone, User, Share2, Copy } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Empreendimento {
  id: string;
  nomeEmpreendimento: string;
  tipoImovel: string;
  ruaAvenidaEmpreendimento: string;
  numeroEmpreendimento: string;
  complementoEmpreendimento: string;
  bairroEmpreendimento: string;
  cidadeEmpreendimento: string;
  estadoEmpreendimento: string;
  blocoTorresEmpreendimento: string;
  andaresEmpreendimento: string;
  aptoAndarEmpreendimento: string;
  valorCondominioEmpreendimento: string;
  statusEmpreendimento?: string;
  itensServicosEmpreendimento: string[];
  itensLazerEmpreendimento: string[];
  urlFotoCapaEmpreendimento: string;
  urlFotoEmpreendimento: string[];
  urlVideoEmpreendimento: string | string[]; // Pode ser string ou array de strings
  tituloDescritivoComerciais: string;
  descricaoCompletaComerciais: string;
  valorVendaComerciais: string;
  nomeProprietario?: string;
  prazoEntregaEmpreendimento?: string;
}

interface ContatoConstrutora {
  nome: string;
  telefone: string;
  email?: string;
}

interface Apartamento {
  id_apartamento: number;
  id_empreendimento: number;
  status_apartamento: string;
  area_privativa_apartamento: number;
  quartos_apartamento: number;
  suites_apartamento: number | null;
  banheiros_apartamento: number | null;
  vagas_garagem_apartamento: number | null;
  tipo_garagem_apartamento: string;
  sacada_varanda_apartamento: boolean;
  caracteristicas_apartamento: string;
  valor_venda_apartamento: number | null;
  titulo_descritivo_apartamento: string;
  descricao_apartamento: string;
  status_publicacao_apartamento: string;
}

export default function EmpreendimentoDetalhes() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const isPublicAccess = !currentUser; // Detecta se é acesso público (sem login)
  const [empreendimento, setEmpreendimento] = useState<Empreendimento | null>(null);
  const [apartamentos, setApartamentos] = useState<Apartamento[]>([]);
  const [contatos, setContatos] = useState<ContatoConstrutora[]>([]);
  const [loadingApartamentos, setLoadingApartamentos] = useState(true);
  const [loadingContatos, setLoadingContatos] = useState(true);
  const [errorApartamentos, setErrorApartamentos] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fotoTelaCheia, setFotoTelaCheia] = useState<string | null>(null);
  const [carrosselTelaCheia, setCarrosselTelaCheia] = useState<boolean>(false);
  const [indiceSlideAtual, setIndiceSlideAtual] = useState<number>(0);
  const [videoTelaCheia, setVideoTelaCheia] = useState<string | null>(null);
  const [openConfirmarExclusao, setOpenConfirmarExclusao] = useState(false);
  const [apartamentoParaExcluir, setApartamentoParaExcluir] = useState<number | null>(null);
  const [deletingApartamento, setDeletingApartamento] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [apartamentoEmEdicao, setApartamentoEmEdicao] = useState<Apartamento | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingEmpreendimento, setSharingEmpreendimento] = useState(false);
  const { toast } = useToast();

  // Função para abrir o modal de compartilhamento
  const abrirModalCompartilhamento = () => {
    setShareModalOpen(true);
  };

  // Função para compartilhar empreendimento
  const compartilharEmpreendimento = async () => {
    if (sharingEmpreendimento) return;
    
    try {
      setSharingEmpreendimento(true);
      const publicUrl = `${window.location.origin}/empreendimento/publico/${id}`;
      
      // Tentar usar a API nativa de compartilhamento se disponível
      if (navigator.share) {
        const shareData = {
          title: `${empreendimento?.nomeEmpreendimento || 'Empreendimento'}`,
          text: `Confira este empreendimento: ${empreendimento?.nomeEmpreendimento || 'Empreendimento'}`,
          url: publicUrl
        };
        
        const canShare = navigator.canShare ? navigator.canShare(shareData) : true;
        
        if (canShare) {
          try {
            await navigator.share(shareData);
            toast({
              title: "Link compartilhado",
              description: "O link público do empreendimento foi compartilhado com sucesso!",
            });
            setShareModalOpen(false);
            return;
          } catch (shareError: any) {
            if (shareError.name === 'AbortError') {
              return;
            }
            // Continuar para fallback de clipboard
          }
        }
      }
      
      // Fallback: copiar para clipboard
      try {
        await copyToClipboard(publicUrl);
      } catch (clipboardError) {
        // Último recurso: fallback manual
        await fallbackCopyTextToClipboard(publicUrl);
      }
      
    } catch (error) {
      console.error('Erro ao compartilhar empreendimento:', error);
      toast({
        title: "Erro ao compartilhar",
        description: "Não foi possível compartilhar o link do empreendimento.",
        variant: "destructive",
      });
    } finally {
      setSharingEmpreendimento(false);
    }
  };

  // Função para copiar para clipboard
  const copyToClipboard = async (text: string): Promise<void> => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        toast({
          title: "Link copiado",
          description: "O link público foi copiado para a área de transferência!",
        });
        setShareModalOpen(false);
        return;
      } catch (error) {
        throw error;
      }
    }
    throw new Error('Clipboard API não disponível');
  };

  // Método alternativo para copiar texto
  const fallbackCopyTextToClipboard = (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      textArea.style.pointerEvents = "none";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        if (successful) {
          toast({
            title: "Link copiado",
            description: "O link público foi copiado para a área de transferência!",
          });
          setShareModalOpen(false);
          resolve();
        } else {
          throw new Error('Comando de cópia não suportado');
        }
      } catch (err) {
        reject(err);
      } finally {
        if (document.body.contains(textArea)) {
          document.body.removeChild(textArea);
        }
      }
    });
  };

  // Função para abrir o modal de confirmação de exclusão
  const iniciarExclusao = (apartamentoId: number) => {
    setApartamentoParaExcluir(apartamentoId);
    setOpenConfirmarExclusao(true);
  };

  // Função para abrir o modal de edição
  const iniciarEdicao = (apartamento: Apartamento) => {
    setApartamentoEmEdicao({...apartamento});
    setEditModalOpen(true);
  };

  // Função para salvar as alterações do apartamento
  const salvarEdicaoApartamento = async () => {
    if (!apartamentoEmEdicao) return;
    
    try {
      setSalvandoEdicao(true);
      
      const response = await axios.put(`/api/apartamentos/${apartamentoEmEdicao.id_apartamento}`, apartamentoEmEdicao);
      
      // Atualizar a lista de apartamentos com o item editado
      setApartamentos(prevApartamentos => 
        prevApartamentos.map(apt => 
          apt.id_apartamento === apartamentoEmEdicao.id_apartamento ? response.data : apt
        )
      );
      
      // Fechar o modal e limpar o estado
      setEditModalOpen(false);
      setApartamentoEmEdicao(null);
      
      // Mostrar mensagem de sucesso
      toast({
        title: "Apartamento atualizado com sucesso",
        variant: "default",
      });
    } catch (error) {
      console.error('Erro ao atualizar apartamento:', error);
      
      // Mostrar mensagem de erro
      toast({
        title: "Erro ao atualizar apartamento",
        description: "Ocorreu um erro ao tentar atualizar o apartamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // Função para atualizar campos do apartamento em edição
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    if (!apartamentoEmEdicao) return;
    
    const { name, value } = e.target;
    setApartamentoEmEdicao(prev => ({
      ...prev!,
      [name]: value
    }));
  };

  // Função para atualizar campos booleanos (checkbox/switch)
  const handleBooleanChange = (name: string, checked: boolean) => {
    if (!apartamentoEmEdicao) return;
    
    setApartamentoEmEdicao(prev => ({
      ...prev!,
      [name]: checked
    }));
  };

  // Função para atualizar campos numéricos
  const handleNumberChange = (name: string, value: string) => {
    if (!apartamentoEmEdicao) return;
    
    const numberValue = value === '' ? null : Number(value);
    setApartamentoEmEdicao(prev => ({
      ...prev!,
      [name]: numberValue
    }));
  };

  // Função para excluir o apartamento
  const excluirApartamento = async () => {
    if (!apartamentoParaExcluir) return;
    
    try {
      setDeletingApartamento(true);
      await axios.delete(`/api/apartamentos/${apartamentoParaExcluir}`);
      
      // Atualizar a lista de apartamentos removendo o excluído
      setApartamentos(prevApartamentos => 
        prevApartamentos.filter(apt => apt.id_apartamento !== apartamentoParaExcluir)
      );
      
      // Mostrar mensagem de sucesso
      toast({
        title: "Apartamento excluído com sucesso",
        variant: "default",
      });
    } catch (error) {
      console.error('Erro ao excluir apartamento:', error);
      
      // Mostrar mensagem de erro
      toast({
        title: "Erro ao excluir apartamento",
        description: "Ocorreu um erro ao tentar excluir o apartamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingApartamento(false);
      setOpenConfirmarExclusao(false);
      setApartamentoParaExcluir(null);
    }
  };

  // Função para formatar prazo de entrega (YYYY-MM ou MMM/YYYY)
  function formatarPrazoEntregaExibicao(valor: string) {
    if (!valor) return 'Não informado';
    // Se já estiver no formato MMM/YYYY
    if (/^(Jan|Fev|Mar|Abr|Mai|Jun|Jul|Ago|Set|Out|Nov|Dez)\/\d{4}$/i.test(valor)) return valor;
    // Se estiver no formato YYYY-MM
    if (/^\d{4}-\d{2}$/.test(valor)) {
      const [ano, mes] = valor.split('-');
      const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mesNum = parseInt(mes, 10);
      if (mesNum < 1 || mesNum > 12) return valor;
      return `${meses[mesNum - 1]}/${ano}`;
    }
    return valor;
  }

  useEffect(() => {
    const fetchEmpreendimento = async () => {
      try {
        console.log(`Buscando detalhes do empreendimento ${id}`);
        
        // Usar rota pública se não estiver autenticado
        const apiUrl = isPublicAccess 
          ? `/api/empreendimentos/publico/${id}` 
          : `/api/empreendimentos/${id}`;
        
        console.log(`Usando API: ${apiUrl}`);
        const response = await axios.get(apiUrl);
        
        // Processar os dados recebidos
        const data = response.data;
        console.log('Dados recebidos do empreendimento:', data);
        
        // Log específico para a URL da foto de capa
        console.log('URL da foto de capa (original):', data.urlFotoCapaEmpreendimento, 'Tipo:', typeof data.urlFotoCapaEmpreendimento);
        
        // Processar urlFotoCapaEmpreendimento para garantir que seja uma string limpa
        if (data.urlFotoCapaEmpreendimento) {
          // Exibir o valor exato que está vindo do banco para depuração
          console.log('Valor exato da URL da foto de capa:', JSON.stringify(data.urlFotoCapaEmpreendimento));
          
          // Se for uma string JSON, tentar extrair a URL
          if (typeof data.urlFotoCapaEmpreendimento === 'string') {
            try {
              // Se a string começa e termina com aspas duplas, é uma string JSON
              if (data.urlFotoCapaEmpreendimento.startsWith('"') && data.urlFotoCapaEmpreendimento.endsWith('"')) {
                data.urlFotoCapaEmpreendimento = JSON.parse(data.urlFotoCapaEmpreendimento);
                console.log('URL da foto de capa após parse JSON:', data.urlFotoCapaEmpreendimento);
              }
              
              // Garantir que seja um caminho com o formato correto
              data.urlFotoCapaEmpreendimento = data.urlFotoCapaEmpreendimento.replace(/^\/upload\//, '/uploads/');
            } catch (e) {
              console.log('Erro ao processar URL da foto de capa:', e);
            }
          }
        }
        
        // Processar urlFotoEmpreendimento para garantir que seja um array
        if (data.urlFotoEmpreendimento) {
          console.log('URL Fotos original:', data.urlFotoEmpreendimento, 'Tipo:', typeof data.urlFotoEmpreendimento);
          
          // Se for uma string, tentar fazer parse como JSON
          if (typeof data.urlFotoEmpreendimento === 'string') {
            try {
              let fotos = JSON.parse(data.urlFotoEmpreendimento);
              // Processar cada foto para garantir formato correto
              fotos = fotos.map((foto: string) => {
                // Remover aspas extras se houver
                let fotoCorrigida = foto;
                if (typeof foto === 'string' && foto.startsWith('"') && foto.endsWith('"')) {
                  fotoCorrigida = JSON.parse(foto);
                }
                // Garantir que seja um caminho /uploads/
                fotoCorrigida = fotoCorrigida.replace(/^\/upload\//, '/uploads/');
                return fotoCorrigida;
              });
              data.urlFotoEmpreendimento = fotos;
              console.log('Fotos após processamento:', data.urlFotoEmpreendimento);
            } catch (e) {
              console.log('Processando fotos - formato não é JSON:', e);
              data.urlFotoEmpreendimento = [];
            }
          } else {
            // Tratamento normal para outros empreendimentos
            // Se for uma string, tentar fazer parse como JSON
            if (typeof data.urlFotoEmpreendimento === 'string') {
              try {
                data.urlFotoEmpreendimento = JSON.parse(data.urlFotoEmpreendimento);
                console.log('Fotos após parse JSON:', data.urlFotoEmpreendimento);
              } catch (e) {
                console.log('Processando fotos - formato não é JSON:', e);
                data.urlFotoEmpreendimento = [];
              }
            }
          }
        } else {
          console.log('Nenhuma foto encontrada');
          data.urlFotoEmpreendimento = [];
        }
        
        // Processar urlVideoEmpreendimento
        if (data.urlVideoEmpreendimento) {
          console.log('URL Vídeos original:', data.urlVideoEmpreendimento, 'Tipo:', typeof data.urlVideoEmpreendimento);
          
          // Se for uma string, verificar se é JSON
          if (typeof data.urlVideoEmpreendimento === 'string' && 
              (data.urlVideoEmpreendimento.startsWith('[') || data.urlVideoEmpreendimento.startsWith('['))) {
            try {
              data.urlVideoEmpreendimento = JSON.parse(data.urlVideoEmpreendimento);
              console.log('Vídeos após parse JSON:', data.urlVideoEmpreendimento);
            } catch (e) {
              console.log('Processando vídeos - formato não é JSON:', e);
              // Manter como string se não for um JSON válido
            }
          }
        } else {
          console.log('Nenhum vídeo encontrado');
        }
        
        setEmpreendimento(data);
        console.log('Empreendimento processado e pronto para exibição:', data);
      } catch (err) {
        console.error('Erro ao carregar os dados do empreendimento:', err);
        setError('Erro ao carregar os dados do empreendimento');
      } finally {
        setLoading(false);
      }
    };

    const fetchApartamentos = async () => {
      try {
        setLoadingApartamentos(true);
        
        // Usar rota pública se não estiver autenticado
        const apiUrl = isPublicAccess 
          ? `/api/apartamentos/publico/empreendimento/${id}` 
          : `/api/apartamentos/empreendimento/${id}`;
        
        console.log(`Usando API apartamentos: ${apiUrl}`);
        const response = await axios.get(apiUrl);
        
        // Garantir que sempre temos um array
        let apartamentosData = response.data;
        if (!Array.isArray(apartamentosData)) {
          // Se a resposta tem uma propriedade rows (formato do PostgreSQL)
          if (apartamentosData && apartamentosData.rows && Array.isArray(apartamentosData.rows)) {
            apartamentosData = apartamentosData.rows;
          } else {
            // Se não é um array e não tem rows, criar array vazio
            console.warn('Resposta da API não é um array:', apartamentosData);
            apartamentosData = [];
          }
        }
        
        setApartamentos(apartamentosData);
        setErrorApartamentos(null);
      } catch (err) {
        console.error('Erro ao carregar apartamentos:', err);
        setErrorApartamentos('Não foi possível carregar os apartamentos deste empreendimento');
        setApartamentos([]); // Garantir que apartamentos seja sempre um array
      } finally {
        setLoadingApartamentos(false);
      }
    };

    const fetchContatos = async () => {
      try {
        setLoadingContatos(true);
        const response = await axios.get(`/api/empreendimentos/${id}/contatos`);
        setContatos(response.data || []);
      } catch (err) {
        console.error('Erro ao carregar contatos:', err);
        setContatos([]);
      } finally {
        setLoadingContatos(false);
      }
    };

    fetchEmpreendimento();
    fetchApartamentos();
    fetchContatos();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !empreendimento) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error || 'Empreendimento não encontrado'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modal de foto em tela cheia */}
      {fotoTelaCheia && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <img 
              src={fotoTelaCheia}
              alt="Foto em tela cheia" 
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              className="absolute top-4 right-4 bg-white/20 p-2 rounded-full hover:bg-white/40 transition-colors"
              onClick={() => setFotoTelaCheia(null)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div 
            className="absolute inset-0 cursor-pointer" 
            onClick={() => setFotoTelaCheia(null)}
          ></div>
        </div>
      )}
      
      {/* Modal de carrossel em tela cheia */}
      {carrosselTelaCheia && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col">
          <div className="relative flex-1 flex items-center justify-center">
            <div className="w-full max-w-7xl mx-auto px-4">
              <Carousel
                showArrows={true}
                showStatus={false}
                showThumbs={true}
                infiniteLoop={true}
                autoPlay={false}
                selectedItem={indiceSlideAtual}
                onChange={(index) => setIndiceSlideAtual(index)}
                className="fullscreen-carousel"
                thumbWidth={80}
                renderThumbs={(children) => 
                  empreendimento.urlFotoEmpreendimento?.map((foto, index) => {
                    // Usar o caminho que vem do banco de dados
                    let thumbUrl = foto;
                    // Se precisar ajustes (por exemplo, corrigir upload -> uploads)
                    if (typeof foto === 'string') {
                      // Garantir que o caminho esteja correto
                      thumbUrl = thumbUrl.replace(/^\/upload\//, '/uploads/');
                    }
                    return (
                      <div key={index} className="h-16 flex items-center justify-center">
                        <img 
                          src={thumbUrl} 
                          alt={`Miniatura ${index + 1}`} 
                          className="h-full object-cover" 
                          onError={(e) => {
                            console.error(`Erro ao carregar miniatura ${index}:`, thumbUrl);
                            // Usar uma imagem padrão de ALTA RESOLUÇÃO para o tipo de imóvel
                            if (empreendimento.tipoImovel.toLowerCase().includes('apartamento')) {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=100&w=2000&auto=format&fit=crop';
                            } else if (empreendimento.tipoImovel.toLowerCase().includes('casa')) {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=100&w=2000&auto=format&fit=crop';
                            } else {
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=100&w=2000&auto=format&fit=crop';
                            }
                          }}
                        />
                      </div>
                    );
                  })
                }
              >
                {empreendimento.urlFotoEmpreendimento?.map((foto, index) => {
                  console.log(`Processando foto ${index}:`, foto);
                  
                  // Usar o caminho que vem do banco de dados
                  let fotoUrl = foto;
                  // Se precisar ajustes (por exemplo, corrigir upload -> uploads)
                  if (typeof foto === 'string') {
                    // Garantir que o caminho esteja correto
                    fotoUrl = fotoUrl.replace(/^\/upload\//, '/uploads/');
                  }
                  
                  console.log(`URL da foto após processamento: ${fotoUrl}`);
                  return (
                    <div key={index} className="flex items-center justify-center p-4" style={{height: 'calc(100vh - 150px)'}}>
                      <img
                        src={fotoUrl}
                        alt={`Foto ${index + 1} do ${isPublicAccess ? 'empreendimento' : empreendimento.nomeEmpreendimento}`}
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          console.error(`Erro ao carregar imagem ${index}:`, fotoUrl);
                          // Usar uma imagem padrão de ALTA RESOLUÇÃO para o tipo de imóvel
                          if (empreendimento.tipoImovel.toLowerCase().includes('apartamento')) {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=100&w=2000&auto=format&fit=crop';
                          } else if (empreendimento.tipoImovel.toLowerCase().includes('casa')) {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=100&w=2000&auto=format&fit=crop';
                          } else {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=100&w=2000&auto=format&fit=crop';
                          }
                        }}
                        onLoad={() => console.log(`Imagem ${index} carregada com sucesso:`, fotoUrl)}
                      />
                    </div>
                  );
                })}
              </Carousel>
            </div>
            <button 
              className="absolute top-4 right-4 bg-white/20 p-2 rounded-full hover:bg-white/40 transition-colors z-50"
              onClick={() => setCarrosselTelaCheia(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex justify-center pb-4">
            <div className="flex space-x-1">
              {empreendimento.urlFotoEmpreendimento?.map((_, idx) => (
                <button
                  key={idx}
                  className={`w-2 h-2 rounded-full ${idx === indiceSlideAtual ? 'bg-white' : 'bg-white/40'}`}
                  onClick={() => setIndiceSlideAtual(idx)}
                  aria-label={`Ir para foto ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de vídeo em tela cheia */}
      {videoTelaCheia && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <video 
              src={videoTelaCheia}
              title="Vídeo em tela cheia" 
              className="w-full h-full"
              controls
              preload="metadata"
              onClick={(e) => e.stopPropagation()}
            ></video>
            <button 
              className="absolute top-4 right-4 bg-white/20 p-2 rounded-full hover:bg-white/40 transition-colors"
              onClick={() => setVideoTelaCheia(null)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div 
            className="absolute inset-0 cursor-pointer" 
            onClick={() => setVideoTelaCheia(null)}
          ></div>
        </div>
      )}
      
      {/* Hero Section com Foto de Capa */}
      <div className="w-full h-[200px] xxs:h-[250px] xs:h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] relative">
        <div className="h-full w-full flex items-center justify-center relative">
          {/* Corrigir o caminho da imagem: substituir "/upload/" por "/uploads/" */}
          {empreendimento.urlFotoCapaEmpreendimento && (
            <img
              src={empreendimento.urlFotoCapaEmpreendimento}
              // Adicionando log para debug
              ref={(img) => {
                if (img) {
                  console.log('Caminho completo da foto de capa no DOM:', img.src);
                }
              }}
              alt={`Foto de capa do ${empreendimento.nomeEmpreendimento}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error(`Erro ao carregar foto de capa: ${empreendimento.urlFotoCapaEmpreendimento}`);
                // Usar uma imagem padrão de ALTA RESOLUÇÃO para o tipo de imóvel
                if (empreendimento.tipoImovel.toLowerCase().includes('apartamento')) {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=100&w=2000&auto=format&fit=crop';
                } else if (empreendimento.tipoImovel.toLowerCase().includes('casa')) {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=100&w=2000&auto=format&fit=crop';
                } else {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=100&w=2000&auto=format&fit=crop';
                }
              }}
            />
          )}
          
          {/* Botão compartilhar - canto superior direito em mobile */}
          {!isPublicAccess && (
            <div className="absolute top-3 right-3 xs:top-4 xs:right-4 sm:hidden">
              <Button
                onClick={abrirModalCompartilhamento}
                className="bg-white/25 hover:bg-white/40 text-white border border-white/40 backdrop-blur-sm p-2 shadow-lg transition-all duration-200 rounded-full"
                size="sm"
              >
                <Share2 className="h-4 w-4 flex-shrink-0" />
              </Button>
            </div>
          )}
          
          <div className="absolute inset-0 flex items-center justify-center">
            <button 
              className="bg-blue-600 text-white px-2 xxs:px-2.5 xs:px-3 sm:px-4 py-1 xxs:py-1.5 xs:py-2 rounded-full shadow-lg hover:bg-blue-700 opacity-0 hover:opacity-100 transition-opacity duration-300 text-xs xxs:text-xs xs:text-sm"
              onClick={(e) => {
                e.stopPropagation();
                setIndiceSlideAtual(0);
                setCarrosselTelaCheia(true);
              }}
            >
              <span className="hidden xs:inline">Abrir galeria</span>
              <span className="xs:hidden">Galeria</span>
              <Maximize2 className="h-3 w-3 xxs:h-3.5 xxs:w-3.5 xs:h-4 xs:w-4 inline-block ml-1" />
            </button>
          </div>
        </div>
        
        {/* Overlay com nome do empreendimento */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 xxs:p-3 xs:p-4 sm:p-6 md:p-8">
          <div className="container mx-auto px-1 xxs:px-2 xs:px-3 sm:px-4">
            <div className="flex flex-col gap-2 xxs:gap-2.5 xs:gap-3 sm:gap-4 md:flex-row md:justify-between md:items-end">
              <div className="flex-1 min-w-0">
                <h1 className="text-sm xxs:text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-white mb-1 xxs:mb-1.5 xs:mb-2 leading-tight break-words">
                  {isPublicAccess 
                    ? `Empreendimento ${empreendimento.tipoImovel}` 
                    : `${empreendimento.nomeEmpreendimento} ${empreendimento.nomeProprietario ? `- ${empreendimento.nomeProprietario}` : ''}`
                  }
                </h1>
                <p className="text-xs xxs:text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl text-white/95 flex items-start gap-1 xxs:gap-1.5 xs:gap-2">
                  <MapPin className="h-3 w-3 xxs:h-3.5 xxs:w-3.5 xs:h-4 xs:w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 flex-shrink-0 mt-0.5" />
                  <span className="break-words">
                    {isPublicAccess 
                      ? `${empreendimento.cidadeEmpreendimento}/${empreendimento.estadoEmpreendimento}`
                      : `${empreendimento.ruaAvenidaEmpreendimento}, ${empreendimento.numeroEmpreendimento} - ${empreendimento.bairroEmpreendimento}, ${empreendimento.cidadeEmpreendimento}/${empreendimento.estadoEmpreendimento}`
                    }
                  </span>
                </p>
              </div>
              
              {/* Botão compartilhar - versão desktop (sm e acima) */}
              {!isPublicAccess && (
                <div className="hidden sm:flex justify-end mt-2 md:mt-0">
                  <Button
                    onClick={abrirModalCompartilhamento}
                    className="bg-white/25 hover:bg-white/40 text-white border border-white/40 backdrop-blur-sm text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-2.5 shadow-lg transition-all duration-200"
                    size="sm"
                  >
                    <Share2 className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="whitespace-nowrap">Compartilhar</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 xxs:px-4 xs:px-4 sm:px-6 py-6 xxs:py-8 xs:py-10 sm:py-12">
        {/* Descrição e Contato */}
        <div className={`grid grid-cols-1 ${!isPublicAccess ? 'lg:grid-cols-3' : ''} gap-4 xxs:gap-5 xs:gap-6 sm:gap-8 mb-6 xxs:mb-8 xs:mb-10 sm:mb-12`}>
          <div className={`${!isPublicAccess ? 'lg:col-span-2' : ''} bg-white rounded-lg p-3 xxs:p-4 xs:p-5 sm:p-6 lg:p-8 shadow-sm`}>
            <h2 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-bold mb-2 xxs:mb-3 xs:mb-4">Sobre o Empreendimento</h2>
            <p className="text-gray-600 text-xs xxs:text-sm xs:text-base leading-relaxed whitespace-pre-line">
              {empreendimento.descricaoCompletaComerciais}
            </p>
          </div>
          
          {!isPublicAccess && (
            <div className="bg-white rounded-lg p-3 xxs:p-4 xs:p-5 sm:p-6 lg:p-8 shadow-sm">
              <h2 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-bold mb-2 xxs:mb-3 xs:mb-4 flex items-center gap-2">
                <User className="h-4 w-4 xxs:h-5 xxs:w-5 xs:h-6 xs:w-6 text-blue-500" />
                Contato
              </h2>
              {loadingContatos ? (
                <div className="flex items-center gap-2 text-gray-500 text-xs xxs:text-sm xs:text-base">
                  <div className="animate-spin rounded-full h-3 w-3 xxs:h-4 xxs:w-4 border-2 border-blue-500 border-t-transparent"></div>
                  Carregando contatos...
                </div>
              ) : contatos.length > 0 ? (
                <div className="space-y-3 xxs:space-y-4">
                  {contatos.map((contato, index) => (
                    <div key={index} className="space-y-2 xxs:space-y-3">
                      <div className="flex items-center gap-2">
                        <User className="h-2.5 w-2.5 xxs:h-3 xxs:w-3 xs:h-4 xs:w-4 text-gray-500 flex-shrink-0" />
                        <span className="font-medium text-xs xxs:text-sm xs:text-base">Nome do Contato:</span>
                        <span className="text-gray-700 text-xs xxs:text-sm xs:text-base">{contato.nome}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Phone className="h-2.5 w-2.5 xxs:h-3 xxs:w-3 xs:h-4 xs:w-4 text-gray-500 flex-shrink-0" />
                        <span className="font-medium text-xs xxs:text-sm xs:text-base">Telefone do Contato:</span>
                        <span className="text-gray-700 text-xs xxs:text-sm xs:text-base">{contato.telefone}</span>
                      </div>
                      
                      {index < contatos.length - 1 && (
                        <hr className="my-3 xxs:my-4 border-gray-200" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-xs xxs:text-sm xs:text-base">Nenhum contato disponível</p>
              )}
            </div>
          )}
        </div>

        {/* Grid de Informações Principais */}
        <div className="grid grid-cols-1 xxs:grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 xxs:gap-3 xs:gap-4 mb-6 xxs:mb-8 xs:mb-10 sm:mb-12">
          <div className="bg-white rounded-lg p-2.5 xxs:p-3 xs:p-4 shadow-sm">
            <div className="flex items-center gap-1 xxs:gap-1.5 xs:gap-2 mb-1.5 xxs:mb-2">
              <Building2 className="h-3 w-3 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5 text-blue-500 flex-shrink-0" />
              <h3 className="text-xs xxs:text-sm xs:text-base font-semibold">Estrutura</h3>
            </div>
            <p className="text-xs xxs:text-xs xs:text-sm">{empreendimento.blocoTorresEmpreendimento} torres</p>
            <p className="text-xs xxs:text-xs xs:text-sm">{empreendimento.andaresEmpreendimento} andares</p>
            <p className="text-xs xxs:text-xs xs:text-sm">{empreendimento.aptoAndarEmpreendimento} aptos por andar</p>
          </div>

          <div className="bg-white rounded-lg p-2.5 xxs:p-3 xs:p-4 shadow-sm">
            <div className="flex items-center gap-1 xxs:gap-1.5 xs:gap-2 mb-1.5 xxs:mb-2">
              <Ruler className="h-3 w-3 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5 text-blue-500 flex-shrink-0" />
              <h3 className="text-xs xxs:text-sm xs:text-base font-semibold">Metragens</h3>
            </div>
            {loadingApartamentos ? (
              <p className="text-gray-500 text-xs xxs:text-xs xs:text-sm">Carregando metragens...</p>
            ) : apartamentos.length > 0 ? (
              <div className="mt-1 xxs:mt-2">
                <div className="flex flex-wrap gap-1 xxs:gap-1.5 xs:gap-2">
                  {Array.from(new Set(apartamentos.map(apto => apto.area_privativa_apartamento)))
                    .sort((a, b) => a - b)
                    .map((metragem, index) => (
                      <span key={index} className="bg-gray-100 text-blue-600 px-1.5 xxs:px-2 xs:px-3 py-0.5 xxs:py-1 rounded-full text-xs xxs:text-xs xs:text-sm font-medium">
                        {metragem} m²
                      </span>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-xs xxs:text-xs xs:text-sm">Sem apartamentos cadastrados</p>
            )}
            {empreendimento.valorVendaComerciais && Number(empreendimento.valorVendaComerciais) > 0 && (
              <p className="mt-1.5 xxs:mt-2 text-sm xxs:text-base xs:text-lg sm:text-2xl font-bold text-blue-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(Number(empreendimento.valorVendaComerciais))}
              </p>
            )}
          </div>

          <div className="bg-white rounded-lg p-2.5 xxs:p-3 xs:p-4 shadow-sm">
            <div className="flex items-center gap-1 xxs:gap-1.5 xs:gap-2 mb-1.5 xxs:mb-2">
              <Shield className="h-3 w-3 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5 text-blue-500 flex-shrink-0" />
              <h3 className="text-xs xxs:text-sm xs:text-base font-semibold">Condomínio</h3>
            </div>
            <p className="text-xs xxs:text-xs xs:text-sm">
              {(() => {
                // Verificar se o valor existe
                if (!empreendimento.valorCondominioEmpreendimento) return 'Não informado';
                
                // Remover formatação (R$, pontos e vírgulas) para converter para número
                const valorSemFormatacao = empreendimento.valorCondominioEmpreendimento
                  .replace(/R\$\s?/g, '')
                  .replace(/\./g, '')
                  .replace(/,/g, '.');
                
                // Tentar converter para número
                const valorNumerico = Number(valorSemFormatacao);
                
                // Formatar para moeda brasileira se for um número válido
                return !isNaN(valorNumerico)
                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorNumerico)
                  : empreendimento.valorCondominioEmpreendimento; // Manter o valor original se não for um número
              })()}
            </p>
          </div>

          <div className="bg-white rounded-lg p-2.5 xxs:p-3 xs:p-4 shadow-sm">
            <div className="flex items-center gap-1 xxs:gap-1.5 xs:gap-2 mb-1.5 xxs:mb-2">
              <CheckCircle className="h-3 w-3 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5 text-blue-500 flex-shrink-0" />
              <h3 className="text-xs xxs:text-sm xs:text-base font-semibold">Status</h3>
            </div>
            <p className="text-xs xxs:text-xs xs:text-sm">
              {empreendimento.statusEmpreendimento || 'Não informado'}
            </p>
          </div>

          <div className="bg-white rounded-lg p-2.5 xxs:p-3 xs:p-4 shadow-sm">
            <div className="flex items-center gap-1 xxs:gap-1.5 xs:gap-2 mb-1.5 xxs:mb-2">
              <Info className="h-3 w-3 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5 text-blue-500 flex-shrink-0" />
              <h3 className="text-xs xxs:text-sm xs:text-base font-semibold">Prazo de Entrega</h3>
            </div>
            <p className="text-xs xxs:text-xs xs:text-sm">
              {empreendimento.prazoEntregaEmpreendimento ? 
                (() => {
                  try {
                    // Verificar se o formato é ano-mes
                    if (empreendimento.prazoEntregaEmpreendimento.includes('-')) {
                      const partes = empreendimento.prazoEntregaEmpreendimento.split('-');
                      // Garantir que temos exatamente duas partes (ano e mês)
                      if (partes.length === 2) {
                        const [ano, mes] = partes;
                        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        const mesIndex = parseInt(mes, 10) - 1;
                        // Verificar se o índice é válido para evitar undefined
                        if (mesIndex >= 0 && mesIndex < 12) {
                          return `${meses[mesIndex]}/${ano}`;
                        }
                      }
                    }
                    // Se não conseguir fazer o parse, retornar o valor original
                    return empreendimento.prazoEntregaEmpreendimento;
                  } catch (e) {
                    return empreendimento.prazoEntregaEmpreendimento;
                  }
                })() 
                : 'Não informado'
              }
            </p>
          </div>
        </div>

        {/* Itens e Serviços */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xxs:gap-5 xs:gap-6 sm:gap-8 mb-6 xxs:mb-8 xs:mb-10 sm:mb-12">
          <div className="bg-white rounded-lg p-3 xxs:p-4 xs:p-5 sm:p-6 lg:p-8 shadow-sm">
            <div className="flex items-center gap-1.5 xxs:gap-2 xs:gap-3 mb-3 xxs:mb-4 xs:mb-6">
              <Shield className="h-4 w-4 xxs:h-5 xxs:w-5 xs:h-6 xs:w-6 text-blue-500 flex-shrink-0" />
              <h2 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-bold">Serviços</h2>
            </div>
            <div className="grid grid-cols-1 xxs:grid-cols-2 gap-2 xxs:gap-3 xs:gap-4">
              {empreendimento.itensServicosEmpreendimento?.map((servico, index) => (
                <div key={index} className="flex items-center gap-1.5 xxs:gap-2">
                  <div className="h-1.5 w-1.5 xxs:h-2 xxs:w-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                  <span className="text-xs xxs:text-sm xs:text-base">{servico}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 xxs:p-4 xs:p-5 sm:p-6 lg:p-8 shadow-sm">
            <div className="flex items-center gap-1.5 xxs:gap-2 xs:gap-3 mb-3 xxs:mb-4 xs:mb-6">
              <Tree className="h-4 w-4 xxs:h-5 xxs:w-5 xs:h-6 xs:w-6 text-blue-500 flex-shrink-0" />
              <h2 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-bold">Lazer</h2>
            </div>
            <div className="grid grid-cols-1 xxs:grid-cols-2 gap-2 xxs:gap-3 xs:gap-4">
              {empreendimento.itensLazerEmpreendimento?.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 xxs:gap-2">
                  <div className="h-1.5 w-1.5 xxs:h-2 xxs:w-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                  <span className="text-xs xxs:text-sm xs:text-base">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sobre os Apartamentos */}
        <div className="bg-white rounded-lg p-3 xxs:p-4 xs:p-5 sm:p-6 lg:p-8 shadow-sm mb-6 xxs:mb-8 xs:mb-10 sm:mb-12">
          <h2 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-bold mb-2 xxs:mb-3 xs:mb-4">Sobre os Apartamentos</h2>
          
          {loadingApartamentos ? (
            <div className="flex justify-center py-8 xxs:py-10">
              <div className="animate-spin rounded-full h-8 w-8 xxs:h-10 xxs:w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : errorApartamentos ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 xxs:px-4 py-2 xxs:py-3 rounded text-xs xxs:text-sm">
              {errorApartamentos}
            </div>
          ) : apartamentos.length === 0 ? (
            <div className="text-center py-8 xxs:py-10 text-gray-500 text-xs xxs:text-sm xs:text-base">
              Não há apartamentos cadastrados para este empreendimento.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 xxs:gap-4 xs:gap-6 mt-4 xxs:mt-6">
              {apartamentos.map((apartamento) => (
                <div key={apartamento.id_apartamento} className="bg-white rounded-lg border border-gray-200 p-3 xxs:p-4 xs:p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2 xxs:mb-3">
                    <h3 className="text-sm xxs:text-base xs:text-lg font-semibold line-clamp-1">{apartamento.titulo_descritivo_apartamento || `Apto. ${apartamento.id_apartamento}`}</h3>
                    {(apartamento.status_publicacao_apartamento !== 'Ativo' && apartamento.status_publicacao_apartamento) && (
                      <span className={`px-1.5 xxs:px-2 xs:px-3 py-0.5 xxs:py-1 rounded-full text-xs xxs:text-xs xs:text-sm ${
                        apartamento.status_publicacao_apartamento === 'Em construção' ? 'bg-blue-100 text-blue-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {apartamento.status_publicacao_apartamento}
                      </span>
                    )}
                  </div>
                  
                  {apartamento.descricao_apartamento && (
                    <p className="text-gray-600 text-xs xxs:text-xs xs:text-sm mb-3 xxs:mb-4 line-clamp-2">{apartamento.descricao_apartamento}</p>
                  )}
                  
                  <div className="space-y-2 xxs:space-y-3">
                    <div className="flex flex-wrap gap-1 xxs:gap-1.5 xs:gap-2 mb-3 xxs:mb-4">
                      {apartamento.area_privativa_apartamento && (
                        <div className="flex items-center gap-1 xxs:gap-1.5 bg-gray-100 px-1.5 xxs:px-2 xs:px-3 py-0.5 xxs:py-1 rounded-full text-xs xxs:text-xs xs:text-sm">
                          <Ruler className="h-2.5 w-2.5 xxs:h-3 xxs:w-3 xs:h-3.5 xs:w-3.5 text-blue-500 flex-shrink-0" />
                          <span>{apartamento.area_privativa_apartamento} m²</span>
                        </div>
                      )}
                      
                      {apartamento.quartos_apartamento > 0 && (
                        <div className="flex items-center gap-1 xxs:gap-1.5 bg-gray-100 px-1.5 xxs:px-2 xs:px-3 py-0.5 xxs:py-1 rounded-full text-xs xxs:text-xs xs:text-sm">
                          <Bed className="h-2.5 w-2.5 xxs:h-3 xxs:w-3 xs:h-3.5 xs:w-3.5 text-blue-500 flex-shrink-0" />
                          <span>{apartamento.quartos_apartamento} {apartamento.quartos_apartamento > 1 ? 'quartos' : 'quarto'}</span>
                        </div>
                      )}
                      
                      {apartamento.suites_apartamento && apartamento.suites_apartamento > 0 && (
                        <div className="flex items-center gap-1 xxs:gap-1.5 bg-gray-100 px-1.5 xxs:px-2 xs:px-3 py-0.5 xxs:py-1 rounded-full text-xs xxs:text-xs xs:text-sm">
                          <Scissors className="h-2.5 w-2.5 xxs:h-3 xxs:w-3 xs:h-3.5 xs:w-3.5 text-blue-500 flex-shrink-0" />
                          <span>{apartamento.suites_apartamento} {apartamento.suites_apartamento > 1 ? 'suítes' : 'suíte'}</span>
                        </div>
                      )}
                      
                      {apartamento.banheiros_apartamento && apartamento.banheiros_apartamento > 0 && (
                        <div className="flex items-center gap-1 xxs:gap-1.5 bg-gray-100 px-1.5 xxs:px-2 xs:px-3 py-0.5 xxs:py-1 rounded-full text-xs xxs:text-xs xs:text-sm">
                          <Bath className="h-2.5 w-2.5 xxs:h-3 xxs:w-3 xs:h-3.5 xs:w-3.5 text-blue-500 flex-shrink-0" />
                          <span>{apartamento.banheiros_apartamento} {apartamento.banheiros_apartamento > 1 ? 'banheiros' : 'banheiro'}</span>
                        </div>
                      )}
                      
                      {apartamento.vagas_garagem_apartamento && apartamento.vagas_garagem_apartamento > 0 && (
                        <div className="flex items-center gap-1 xxs:gap-1.5 bg-gray-100 px-1.5 xxs:px-2 xs:px-3 py-0.5 xxs:py-1 rounded-full text-xs xxs:text-xs xs:text-sm">
                          <Car className="h-2.5 w-2.5 xxs:h-3 xxs:w-3 xs:h-3.5 xs:w-3.5 text-blue-500 flex-shrink-0" />
                          <span>
                            {apartamento.vagas_garagem_apartamento} {apartamento.vagas_garagem_apartamento > 1 ? 'vagas' : 'vaga'}
                            {apartamento.tipo_garagem_apartamento && ` (${apartamento.tipo_garagem_apartamento})`}
                          </span>
                        </div>
                      )}
                      
                      {apartamento.sacada_varanda_apartamento && (
                        <div className="flex items-center gap-1 xxs:gap-1.5 bg-gray-100 px-1.5 xxs:px-2 xs:px-3 py-0.5 xxs:py-1 rounded-full text-xs xxs:text-xs xs:text-sm">
                          <Home className="h-2.5 w-2.5 xxs:h-3 xxs:w-3 xs:h-3.5 xs:w-3.5 text-blue-500 flex-shrink-0" />
                          <span>Com sacada</span>
                        </div>
                      )}
                    </div>
                    
                    {apartamento.caracteristicas_apartamento && (
                      <div className="mt-3 xxs:mt-4">
                        <h4 className="text-xs xxs:text-xs xs:text-sm font-semibold text-gray-700 mb-1.5 xxs:mb-2">Características</h4>
                        <div className="flex flex-wrap gap-1 xxs:gap-1.5 xs:gap-2">
                          {(() => {
                            try {
                              const caracteristicas = JSON.parse(apartamento.caracteristicas_apartamento);
                              if (Array.isArray(caracteristicas)) {
                                return caracteristicas.map((caracteristica: string, index: number) => (
                                  <span key={index} className="inline-block bg-gray-100 px-1.5 xxs:px-2 py-0.5 xxs:py-1 text-xs rounded">
                                    {caracteristica}
                                  </span>
                                ));
                              }
                              return <span className="text-gray-500 text-xs">Nenhuma característica disponível</span>;
                            } catch (e) {
                              
                              return <span className="text-gray-500 text-xs">Formato inválido</span>;
                            }
                          })()}
                        </div>
                      </div>
                    )}
                    
                    {apartamento.valor_venda_apartamento && apartamento.valor_venda_apartamento > 0 && (
                      <div className="mt-3 xxs:mt-4 pt-3 xxs:pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 text-xs xxs:text-sm xs:text-base">Valor</span>
                          <span className="text-sm xxs:text-base xs:text-lg sm:text-xl font-bold text-blue-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL'
                            }).format(apartamento.valor_venda_apartamento || 0)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Botões de ação - apenas para usuários autenticados */}
                    {!isPublicAccess && (
                      <div className="mt-3 xxs:mt-4 pt-3 xxs:pt-4 border-t border-gray-100">
                        <div className="flex justify-end space-x-1.5 xxs:space-x-2">
                          {/* Botão de edição */}
                          <button 
                            className="p-1.5 xxs:p-2 text-blue-500 hover:text-blue-700 transition-colors rounded-full hover:bg-blue-50"
                            onClick={() => iniciarEdicao(apartamento)}
                            title="Editar apartamento"
                          >
                            <Edit className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5" />
                          </button>
                          
                          {/* Botão de exclusão */}
                          <button 
                            className="p-1.5 xxs:p-2 text-red-500 hover:text-red-700 transition-colors rounded-full hover:bg-red-50"
                            onClick={() => iniciarExclusao(apartamento.id_apartamento)}
                            title="Excluir apartamento"
                          >
                            <Trash className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Galeria de Fotos e Vídeos */}
        <div className="bg-white rounded-lg p-3 xxs:p-4 xs:p-5 sm:p-6 lg:p-8 shadow-sm mb-6 xxs:mb-8 xs:mb-10 sm:mb-12">
          <h2 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-bold mb-3 xxs:mb-4 xs:mb-6">Galeria</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xxs:gap-5 xs:gap-6 sm:gap-8">
            {/* Carrossel de fotos (lado esquerdo) */}
            <div>
              <h3 className="text-sm xxs:text-base xs:text-lg sm:text-xl font-semibold mb-2 xxs:mb-3 xs:mb-4">Fotos</h3>
              <Carousel
                showArrows={true}
                showStatus={false}
                showThumbs={true}
                infiniteLoop={true}
                autoPlay={false}
                className="h-full"
              >
                {empreendimento.urlFotoEmpreendimento?.map((foto, index) => {
                  const fotoUrl = foto.replace(/^\/upload\//, '/uploads/');
                  return (
                    <div key={index} className="h-[200px] xxs:h-[250px] xs:h-[300px] sm:h-[350px] flex items-center justify-center relative">
                      <img
                        src={fotoUrl}
                        alt={`Foto ${index + 1} do ${isPublicAccess ? 'empreendimento' : empreendimento.nomeEmpreendimento}`}
                        className="max-h-full max-w-full rounded-lg"
                        onError={(e) => {
                          console.error(`Erro ao carregar foto ${index + 1}: ${fotoUrl}`);
                          // Usar uma imagem padrão de ALTA RESOLUÇÃO para o tipo de imóvel
                          if (empreendimento.tipoImovel.toLowerCase().includes('apartamento')) {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=100&w=2000&auto=format&fit=crop';
                          } else if (empreendimento.tipoImovel.toLowerCase().includes('casa')) {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=100&w=2000&auto=format&fit=crop';
                          } else {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=100&w=2000&auto=format&fit=crop';
                          }
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button 
                          className="bg-blue-600 text-white px-2 xxs:px-2.5 xs:px-3 sm:px-4 py-1 xxs:py-1.5 xs:py-2 rounded-full shadow-lg hover:bg-blue-700 opacity-0 hover:opacity-100 transition-opacity duration-300 text-xs xxs:text-xs xs:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIndiceSlideAtual(index);
                            setCarrosselTelaCheia(true);
                          }}
                        >
                          <span className="hidden xs:inline">Abrir galeria</span>
                          <span className="xs:hidden">Galeria</span>
                          <Maximize2 className="h-3 w-3 xxs:h-3.5 xxs:w-3.5 xs:h-4 xs:w-4 inline-block ml-1" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </Carousel>
            </div>

            {/* Vídeo (lado direito) */}
            {empreendimento.urlVideoEmpreendimento && (
              <div>
                <h3 className="text-sm xxs:text-base xs:text-lg sm:text-xl font-semibold mb-2 xxs:mb-3 xs:mb-4">Vídeos</h3>
                {Array.isArray(empreendimento.urlVideoEmpreendimento) && empreendimento.urlVideoEmpreendimento.length > 1 ? (
                  // Caso seja um array com múltiplos vídeos, mostrar carrossel
                  <Carousel
                    showArrows={true}
                    showStatus={false}
                    showThumbs={true}
                    infiniteLoop={true}
                    autoPlay={false}
                    className="h-full"
                  >
                    {empreendimento.urlVideoEmpreendimento.map((video, index) => {
                      const videoUrl = video.replace(/^\/upload\//, '/uploads/');
                      return (
                        <div key={index} className="h-[200px] xxs:h-[250px] xs:h-[300px] sm:h-[350px] flex items-center justify-center relative group">
                          <video
                            src={videoUrl}
                            title={`Vídeo ${index + 1} do ${isPublicAccess ? 'empreendimento' : empreendimento.nomeEmpreendimento}`}
                            className="w-full h-full rounded-lg"
                            controls
                            preload="metadata"
                          ></video>
                          <button 
                            className="absolute bottom-1.5 right-1.5 xxs:bottom-2 xxs:right-2 bg-white/80 p-1 xxs:p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVideoTelaCheia(videoUrl);
                            }}
                            title="Ver em tela cheia"
                          >
                            <Maximize2 className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5 text-blue-600" />
                          </button>
                        </div>
                      );
                    })}
                  </Carousel>
                ) : (
                  // Caso seja um array com apenas 1 vídeo ou uma string única
                  <div className="h-[200px] xxs:h-[250px] xs:h-[300px] sm:h-[350px] flex items-center justify-center relative group">
                    {(() => {
                      const videoUrl = Array.isArray(empreendimento.urlVideoEmpreendimento) 
                        ? empreendimento.urlVideoEmpreendimento[0].replace(/^\/upload\//, '/uploads/')
                        : typeof empreendimento.urlVideoEmpreendimento === 'string' 
                          ? empreendimento.urlVideoEmpreendimento.replace(/^\/upload\//, '/uploads/') 
                          : '';
                      return (
                        <>
                          <video
                            src={videoUrl}
                            title={`Vídeo do ${isPublicAccess ? 'empreendimento' : empreendimento.nomeEmpreendimento}`}
                            className="w-full h-full rounded-lg"
                            controls
                            preload="metadata"
                          ></video>
                          <button 
                            className="absolute bottom-1.5 right-1.5 xxs:bottom-2 xxs:right-2 bg-white/80 p-1 xxs:p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVideoTelaCheia(videoUrl);
                            }}
                            title="Ver em tela cheia"
                          >
                            <Maximize2 className="h-3.5 w-3.5 xxs:h-4 xxs:w-4 xs:h-5 xs:w-5 text-blue-600" />
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={openConfirmarExclusao} onOpenChange={setOpenConfirmarExclusao}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Apartamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este apartamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={excluirApartamento}
              disabled={deletingApartamento}
            >
              {deletingApartamento ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Modal de Edição de Apartamento */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto w-[95vw] max-w-[95vw] sm:w-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-lg xxs:text-xl">Editar Apartamento</DialogTitle>
            <DialogDescription className="text-sm xxs:text-base">
              Altere as informações do apartamento e clique em salvar quando terminar.
            </DialogDescription>
          </DialogHeader>
          
          {apartamentoEmEdicao && (
            <div className="grid gap-3 xxs:gap-4 py-4">
              {/* Título descritivo */}
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="titulo_descritivo_apartamento" className="text-sm xxs:text-base">Título descritivo</Label>
                <Input
                  id="titulo_descritivo_apartamento"
                  name="titulo_descritivo_apartamento"
                  value={apartamentoEmEdicao.titulo_descritivo_apartamento || ''}
                  onChange={handleInputChange}
                  placeholder="Ex: Apartamento 2 quartos com varanda"
                  className="text-sm xxs:text-base"
                />
              </div>
              
              {/* Descrição */}
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="descricao_apartamento" className="text-sm xxs:text-base">Descrição</Label>
                <Textarea
                  id="descricao_apartamento"
                  name="descricao_apartamento"
                  value={apartamentoEmEdicao.descricao_apartamento || ''}
                  onChange={handleInputChange}
                  placeholder="Descreva o apartamento"
                  className="min-h-[100px] text-sm xxs:text-base"
                />
              </div>
              
              {/* Status e Área Privativa */}
              <div className="grid grid-cols-1 xxs:grid-cols-2 gap-3 xxs:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status_apartamento" className="text-sm xxs:text-base">Status</Label>
                  <Select 
                    name="status_apartamento" 
                    value={apartamentoEmEdicao.status_apartamento || 'Disponível'}
                    onValueChange={(value) => handleInputChange({
                      target: { name: 'status_apartamento', value }
                    } as React.ChangeEvent<HTMLSelectElement>)}
                  >
                    <SelectTrigger id="status_apartamento" className="text-sm xxs:text-base">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Disponível">Disponível</SelectItem>
                      <SelectItem value="Reservado">Reservado</SelectItem>
                      <SelectItem value="Vendido">Vendido</SelectItem>
                      <SelectItem value="Em construção">Em construção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="area_privativa_apartamento" className="text-sm xxs:text-base">Área privativa (m²)</Label>
                  <Input
                    id="area_privativa_apartamento"
                    name="area_privativa_apartamento"
                    type="number"
                    value={apartamentoEmEdicao.area_privativa_apartamento || ''}
                    onChange={(e) => handleNumberChange('area_privativa_apartamento', e.target.value)}
                    placeholder="Ex: 65"
                    className="text-sm xxs:text-base"
                  />
                </div>
              </div>
              
              {/* Quartos e Suítes */}
              <div className="grid grid-cols-1 xxs:grid-cols-2 gap-3 xxs:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quartos_apartamento" className="text-sm xxs:text-base">Quartos</Label>
                  <Input
                    id="quartos_apartamento"
                    name="quartos_apartamento"
                    type="number"
                    value={apartamentoEmEdicao.quartos_apartamento || ''}
                    onChange={(e) => handleNumberChange('quartos_apartamento', e.target.value)}
                    placeholder="Ex: 2"
                    className="text-sm xxs:text-base"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="suites_apartamento" className="text-sm xxs:text-base">Suítes</Label>
                  <Input
                    id="suites_apartamento"
                    name="suites_apartamento"
                    type="number"
                    value={apartamentoEmEdicao.suites_apartamento || ''}
                    onChange={(e) => handleNumberChange('suites_apartamento', e.target.value)}
                    placeholder="Ex: 1"
                    className="text-sm xxs:text-base"
                  />
                </div>
              </div>
              
              {/* Banheiros e Vagas de Garagem */}
              <div className="grid grid-cols-1 xxs:grid-cols-2 gap-3 xxs:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="banheiros_apartamento" className="text-sm xxs:text-base">Banheiros</Label>
                  <Input
                    id="banheiros_apartamento"
                    name="banheiros_apartamento"
                    type="number"
                    value={apartamentoEmEdicao.banheiros_apartamento || ''}
                    onChange={(e) => handleNumberChange('banheiros_apartamento', e.target.value)}
                    placeholder="Ex: 2"
                    className="text-sm xxs:text-base"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="vagas_garagem_apartamento" className="text-sm xxs:text-base">Vagas de garagem</Label>
                  <Input
                    id="vagas_garagem_apartamento"
                    name="vagas_garagem_apartamento"
                    type="number"
                    value={apartamentoEmEdicao.vagas_garagem_apartamento || ''}
                    onChange={(e) => handleNumberChange('vagas_garagem_apartamento', e.target.value)}
                    placeholder="Ex: 1"
                    className="text-sm xxs:text-base"
                  />
                </div>
              </div>
              
              {/* Tipo de Garagem e Sacada/Varanda */}
              <div className="grid grid-cols-1 xxs:grid-cols-2 gap-3 xxs:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo_garagem_apartamento" className="text-sm xxs:text-base">Tipo de garagem</Label>
                  <Select 
                    name="tipo_garagem_apartamento" 
                    value={apartamentoEmEdicao.tipo_garagem_apartamento || 'nao_informado'}
                    onValueChange={(value) => handleInputChange({
                      target: { name: 'tipo_garagem_apartamento', value }
                    } as React.ChangeEvent<HTMLSelectElement>)}
                  >
                    <SelectTrigger id="tipo_garagem_apartamento" className="text-sm xxs:text-base">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_informado">Não informado</SelectItem>
                      <SelectItem value="Coberta">Coberta</SelectItem>
                      <SelectItem value="Descoberta">Descoberta</SelectItem>
                      <SelectItem value="Semi-coberta">Semi-coberta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="sacada_varanda_apartamento"
                    checked={apartamentoEmEdicao.sacada_varanda_apartamento || false}
                    onCheckedChange={(checked) => 
                      handleBooleanChange('sacada_varanda_apartamento', checked)
                    }
                  />
                  <Label htmlFor="sacada_varanda_apartamento" className="text-sm xxs:text-base">Possui sacada/varanda</Label>
                </div>
              </div>
              
              {/* Valor de venda e Status de publicação */}
              <div className="grid grid-cols-1 xxs:grid-cols-2 gap-3 xxs:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_venda_apartamento" className="text-sm xxs:text-base">Valor de venda (R$)</Label>
                  <Input
                    id="valor_venda_apartamento"
                    name="valor_venda_apartamento"
                    type="number"
                    value={apartamentoEmEdicao.valor_venda_apartamento || ''}
                    onChange={(e) => handleNumberChange('valor_venda_apartamento', e.target.value)}
                    placeholder="Ex: 289900"
                    className="text-sm xxs:text-base"
                  />
                  <p className="text-xs text-gray-500">Informe o valor sem pontos ou vírgulas</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status_publicacao_apartamento" className="text-sm xxs:text-base">Status de publicação</Label>
                  <Select 
                    name="status_publicacao_apartamento" 
                    value={apartamentoEmEdicao.status_publicacao_apartamento || 'Não publicado'}
                    onValueChange={(value) => handleInputChange({
                      target: { name: 'status_publicacao_apartamento', value }
                    } as React.ChangeEvent<HTMLSelectElement>)}
                  >
                    <SelectTrigger id="status_publicacao_apartamento" className="text-sm xxs:text-base">
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Não publicado">Não publicado</SelectItem>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Em construção">Em construção</SelectItem>
                      <SelectItem value="Pausado">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col xxs:flex-row gap-2 xxs:gap-0">
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="text-sm xxs:text-base">
              Cancelar
            </Button>
            <Button 
              onClick={salvarEdicaoApartamento} 
              disabled={salvandoEdicao || !apartamentoEmEdicao}
              className="text-sm xxs:text-base"
            >
              {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Compartilhamento */}
      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg xxs:text-xl">Compartilhar Empreendimento</DialogTitle>
            <DialogDescription className="text-sm xxs:text-base">
              Compartilhe este empreendimento com outras pessoas através de um link público.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Preview do link */}
            <div className="space-y-2">
              <Label htmlFor="public-url" className="text-sm font-medium">
                Link público do empreendimento:
              </Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="public-url"
                  value={`${window.location.origin}/empreendimento/publico/${id}`}
                  readOnly
                  className="text-sm bg-gray-50"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button 
                  type="button" 
                  size="sm" 
                  className="px-3"
                  onClick={() => {
                    const url = `${window.location.origin}/empreendimento/publico/${id}`;
                    copyToClipboard(url).catch(() => fallbackCopyTextToClipboard(url));
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-600">
                Este link permite que qualquer pessoa veja o empreendimento sem precisar fazer login.
              </p>
            </div>

            {/* Informações do empreendimento */}
            {empreendimento && (
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-sm mb-1">
                  {empreendimento.nomeEmpreendimento}
                </h4>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {empreendimento.cidadeEmpreendimento}/{empreendimento.estadoEmpreendimento}
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex-col xxs:flex-row gap-2 xxs:gap-0">
            <Button variant="outline" onClick={() => setShareModalOpen(false)} className="text-sm xxs:text-base">
              Cancelar
            </Button>
            <Button 
              onClick={compartilharEmpreendimento}
              disabled={sharingEmpreendimento}
              className="text-sm xxs:text-base"
            >
              {sharingEmpreendimento ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Compartilhando...
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
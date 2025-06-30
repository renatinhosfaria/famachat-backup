import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, RefreshCw, User, Pencil, Save, X, Image, Edit } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Componente para exibir e gerenciar informações de perfil do WhatsApp

// Interfaces para tipagem
interface WhatsAppInstance {
  instanciaId: number;
  instanceName: string;
  userId: number;
  userName?: string;
  status: string;
  description: string | null;
  isActive: boolean;
  lastConnection: string | null;
  createdAt: string;
  updatedAt: string;
  qrCode?: string;
  // Campos adicionais da Evolution API
  profileName?: string;
  profilePicUrl?: string;
  ownerJid?: string;
  integration?: string;
  clientName?: string;
  number?: string;
  whatsappPhone?: string;
  remoteJid?: string;
  disconnectionAt?: string | null;
  _count?: {
    Message?: number;
    Contact?: number;
    Chat?: number;
  };
}

interface ProfileForm {
  setValue: (field: string, value: any) => void;
  getValues: (field?: string) => any;
  watch: (field?: string) => any;
}

interface ProfileInfo {
  name?: string;
  status?: {
    status: string;
  };
  picture?: string | null;
  phone?: string;
  wuid?: string;
  description?: string;
}

interface ProfileTabProps {
  instances: WhatsAppInstance[];
  form: ProfileForm;
  setActiveTab: (tab: string) => void;
  profilePictureUrl: string | null;
  setProfilePictureUrl: React.Dispatch<React.SetStateAction<string | null>>;
  isLoadingProfilePicture: boolean;
  setIsLoadingProfilePicture: React.Dispatch<React.SetStateAction<boolean>>;
  profileInfo: ProfileInfo | null;
  setProfileInfo: React.Dispatch<React.SetStateAction<ProfileInfo | null>>;
}

function ProfileTab({ 
  instances, 
  form, 
  setActiveTab, 
  profilePictureUrl, 
  setProfilePictureUrl, 
  isLoadingProfilePicture, 
  setIsLoadingProfilePicture,
  profileInfo,
  setProfileInfo
}: ProfileTabProps) {
  // Estados para os diálogos de edição
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isEditingPicture, setIsEditingPicture] = useState(false);
  
  // Estados para os valores de edição
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [newPictureUrl, setNewPictureUrl] = useState("");
  
  // Estados para seleção de arquivos
  const [useUrlForPicture, setUseUrlForPicture] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para loading
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingPicture, setIsSavingPicture] = useState(false);
  
  // Função para buscar diretamente a foto do perfil usando o endpoint específico
  const fetchProfilePictureDirectly = async (instance: string, phoneNumber: string): Promise<string | null> => {
    try {
      
      
      // ESTRATÉGIA 1: Usar endpoint profile-picture otimizado
      try {
        
        const response = await fetch(`/api/whatsapp/profile-picture/${instance}?number=${phoneNumber}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && (data.url || data.profilePictureUrl)) {
            const pictureUrl = data.url || data.profilePictureUrl;
            
            return pictureUrl;
          } else {
            
          }
        } else {
          
        }
      } catch (error) {
        
      }
      
      // ESTRATÉGIA 2: Usar endpoint de direct-evolution-call (criado recentemente)
      try {
        
        
        const directResponse = await fetch('/api/whatsapp/direct-evolution-call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: `chat/fetchProfilePictureUrl/${instance}`,
            payload: { number: phoneNumber }
          })
        });
        
        if (directResponse.ok) {
          const directData = await directResponse.json();
          
          if (directData.profilePictureUrl) {
            
            return directData.profilePictureUrl;
          } else {
            
          }
        } else {
          
        }
      } catch (directError) {
        
      }
      
      // ESTRATÉGIA 3: Tentar com o formato completo do número
      try {
        // Tentando com o formato completo do número
        const fullFormatResponse = await fetch('/api/whatsapp/direct-evolution-call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: `chat/fetchProfilePictureUrl/${instance}`,
            payload: { number: `${phoneNumber}@s.whatsapp.net` }
          })
        });
        
        if (fullFormatResponse.ok) {
          const fullFormatData = await fullFormatResponse.json();
          
          if (fullFormatData.profilePictureUrl) {
            
            return fullFormatData.profilePictureUrl;
          } else {
            
          }
        } else {
          
        }
      } catch (fullFormatError) {
        
      }
      
      // Se chegou aqui, todas as estratégias falharam
      return null;
    } catch (error) {
      
      return null;
    }
  };
  
  // Função para carregar informações de perfil com useCallback para evitar re-criação
  const loadProfileInfo = useCallback((instanceName: string) => {
    if (!instanceName) return;
    
    // Verificar se já estamos carregando para evitar requests simultâneos
    if (isLoadingProfilePicture) return;
    
    setIsLoadingProfilePicture(true);
    
    // Primeiro, buscamos as informações gerais do perfil
    apiRequest({
      url: `/api/whatsapp/profile/${instanceName}`,
      method: "GET",
    })
    .then(async (data) => {
      if (data && data.profile) {
        // Armazenar todas as informações do perfil
        setProfileInfo(data.profile);
        
        // Extrair número de telefone do perfil
        const phoneNumber = data.profile.wuid ? 
          data.profile.wuid.split('@')[0] : 
          "553499602714"; // Valor padrão como fallback
        
        // Atualizar URL da foto de perfil
        let profilePic = data.profile.picture || data.profile.profilePictureUrl;
        
        // Se não encontramos a foto no perfil geral, tentamos o endpoint específico
        if (!profilePic || profilePic === 'null' || profilePic === 'undefined') {
          
          
          // Tentar buscar a foto usando o endpoint específico
          const directProfilePic = await fetchProfilePictureDirectly(instanceName, phoneNumber);
          
          if (directProfilePic) {
            profilePic = directProfilePic;
          }
        }
        
        // Definir a URL da foto (seja da resposta original ou da busca específica)
        if (profilePic && profilePic !== 'null' && profilePic !== 'undefined') {
          
          setProfilePictureUrl(profilePic);
        } else {
          
          setProfilePictureUrl(null);
        }
        
        // Atualizar valores iniciais para edição
        setNewName(data.profile.name || "");
        setNewStatus(data.profile.status?.status || "");
      }
      setIsLoadingProfilePicture(false);
    })
    .catch((error) => {
      
      setIsLoadingProfilePicture(false);
    });
  }, [isLoadingProfilePicture, setIsLoadingProfilePicture, setProfileInfo, setProfilePictureUrl, setNewName, setNewStatus]);

  // Ref para controlar se já definimos um valor inicial para o formulário
  const initialValueSetRef = useRef(false);
  
  // Efeito para selecionar automaticamente a primeira instância conectada - COM PROTEÇÃO CONTRA LOOP
  useEffect(() => {
    // IMPORTANTE: Só define o valor UMA VEZ para evitar loops de renderização
    if (!initialValueSetRef.current && instances && instances.length > 0) {
      // Marcar que já definimos o valor inicial
      initialValueSetRef.current = true;
      
      // Procurar por uma instância conectada primeiro
      const connectedInstance = instances.find(instance => 
        instance.status === 'connected' || 
        instance.status === 'open' || 
        instance.status === 'Conectado' || 
        instance.status?.toLowerCase() === 'connected'
      );
      
      // Se encontrar uma instância conectada, usa-a
      if (connectedInstance) {
        form.setValue("profileInstance", connectedInstance.instanceName);
      } 
      // Caso contrário, usa a primeira instância da lista
      else if (instances.length > 0) {
        form.setValue("profileInstance", instances[0].instanceName);
      }
      
      
    }
  }, [instances, form]);
  
  // RESOLUÇÃO DEFINITIVA PARA EVITAR LOOPS DE RENDERIZAÇÃO
  
  // 1. NUNCA usar form.watch() dentro de useEffect - é uma receita para loops infinitos
  // 2. Em vez disso, vamos usar getValues puro e refs para controlar tudo
  
  // Ref para controle de estado interno sem causar re-renders
  const controlRef = useRef({
    isLoading: false,
    lastInstance: "",
    initialized: false,
    timeoutId: null as NodeJS.Timeout | null
  });
  
  // Efeito de inicialização - roda apenas uma vez
  useEffect(() => {
    // Função que carrega dados de perfil de forma segura
    const loadProfileData = () => {
      // Usar getValues é mais seguro que watch dentro de efeitos
      const instanceName = form.getValues("profileInstance");
      
      // Validar instância
      if (!instanceName || typeof instanceName !== 'string' || instanceName.trim() === '') {
        return;
      }
      
      // Evitar recarregar a mesma instância ou durante carregamento
      if (
        controlRef.current.isLoading || 
        instanceName === controlRef.current.lastInstance || 
        isLoadingProfilePicture
      ) {
        return;
      }
      
      // Preparar função assíncrona que carrega dados
      const fetchData = async () => {
        try {
          // Definir flags de controle
          controlRef.current.isLoading = true;
          controlRef.current.lastInstance = instanceName;
          
          // Logar o estado atual do profileInfo
          
          
          // Carregar dados do perfil
          await loadProfileInfo(instanceName);
          
          // Verificar o estado após o carregamento
          
          
        } catch (error) {
          
        } finally {
          // CRÍTICO: resetar flag de carregamento ao finalizar
          controlRef.current.isLoading = false;
        }
      };
      
      // Executar a busca com delay para evitar problemas de timing
      fetchData();
    };
    
    // Configuramos um timer recorrente ao invés de depender de re-renderizações
    // Isso quebra completamente o ciclo de dependências
    const intervalId = setInterval(() => {
      // Apenas carregar os dados se não estiver em processo de carregamento
      if (!controlRef.current.isLoading && !isLoadingProfilePicture) {
        loadProfileData();
      }
    }, 2000); // Intervalo conservador para evitar flood
    
    // Forçar carregamento inicial com pequeno atraso
    if (!controlRef.current.initialized) {
      controlRef.current.initialized = true;
      controlRef.current.timeoutId = setTimeout(loadProfileData, 500);
    }
    
    // Limpeza ao desmontar
    return () => {
      clearInterval(intervalId);
      if (controlRef.current.timeoutId) {
        clearTimeout(controlRef.current.timeoutId);
      }
    };
  // Dependências mínimas absolutas - apenas o que NÃO muda durante renderizações
  }, [loadProfileInfo]);
  
  // Efeito para inicializar os campos de edição quando o perfil for carregado
  useEffect(() => {
    if (profileInfo) {
      setNewName(profileInfo.name || "");
      if (profileInfo.status && profileInfo.status.status) {
        setNewStatus(profileInfo.status.status);
      }
      if (profileInfo.picture) {
        setNewPictureUrl(profileInfo.picture);
      }
    }
  }, [profileInfo]);
  
  // Função para atualizar nome do perfil
  const handleUpdateName = () => {
    if (!form.watch("profileInstance") || !newName) {
      toast({
        title: "Dados incompletos",
        description: "Instância ou novo nome não informados.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSavingName(true);
    apiRequest({
      url: `/api/whatsapp/profile/update-name/${form.watch("profileInstance")}`,
      method: "POST",
      body: { name: newName }
    })
    .then((data) => {
      toast({
        title: "Nome atualizado",
        description: "O nome de perfil foi atualizado com sucesso.",
      });
      
      // Atualizar informações do perfil
      loadProfileInfo(form.watch("profileInstance"));
      setIsEditingName(false);
    })
    .catch((error) => {
      toast({
        title: "Erro ao atualizar nome",
        description: "Não foi possível atualizar o nome do perfil.",
        variant: "destructive",
      });
      
    })
    .finally(() => {
      setIsSavingName(false);
    });
  };
  
  // Função para atualizar status do perfil
  const handleUpdateStatus = () => {
    if (!form.watch("profileInstance") || !newStatus) {
      toast({
        title: "Dados incompletos",
        description: "Instância ou novo status não informados.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSavingStatus(true);
    apiRequest({
      url: `/api/whatsapp/profile/update-status/${form.watch("profileInstance")}`,
      method: "POST",
      body: { status: newStatus }
    })
    .then((data) => {
      toast({
        title: "Status atualizado",
        description: "O status foi atualizado com sucesso.",
      });
      
      // Atualizar informações do perfil
      loadProfileInfo(form.watch("profileInstance"));
      setIsEditingStatus(false);
    })
    .catch((error) => {
      toast({
        title: "Erro ao atualizar status",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
      
    })
    .finally(() => {
      setIsSavingStatus(false);
    });
  };
  
  // Função para lidar com a seleção de arquivo
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Verificar tamanho (50MB máximo)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 50MB.",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo não suportado",
        description: "Apenas imagens JPEG, PNG, GIF e WEBP são aceitas.",
        variant: "destructive",
      });
      return;
    }
    
    // Atualizar o estado com o arquivo selecionado
    setSelectedFile(file);
    
    // Criar uma prévia da imagem
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  // Função para fazer upload do arquivo selecionado
  const uploadFile = async (): Promise<string | null> => {
    if (!selectedFile) return null;
    
    // Criar FormData para upload de arquivo
    const formData = new FormData();
    formData.append('image', selectedFile);
    
    try {
      // Fazer requisição para o endpoint de upload
      const response = await fetch('/api/uploads/profile-picture', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao fazer upload: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Retornar a URL da imagem no servidor
      return data.imageUrl;
    } catch (error) {
      
      toast({
        title: "Falha no upload",
        description: "Não foi possível enviar a imagem para o servidor.",
        variant: "destructive",
      });
      return null;
    }
  };
  
  // Função para atualizar foto de perfil
  const handleUpdatePicture = async () => {
    const instanceName = form.watch("profileInstance");
    
    if (!instanceName) {
      toast({
        title: "Instância não selecionada",
        description: "Selecione uma instância para atualizar a foto de perfil.",
        variant: "destructive",
      });
      return;
    }
    
    // Se estiver usando URL direta
    if (useUrlForPicture && !newPictureUrl) {
      toast({
        title: "URL não informada",
        description: "Digite uma URL válida para a imagem.",
        variant: "destructive",
      });
      return;
    }
    
    // Se estiver fazendo upload e não tiver arquivo selecionado
    if (!useUrlForPicture && !selectedFile) {
      toast({
        title: "Nenhuma imagem selecionada",
        description: "Selecione uma imagem para fazer upload.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSavingPicture(true);
    
    try {
      // Se estiver fazendo upload de arquivo, fazer isso primeiro
      let pictureUrl = newPictureUrl;
      
      if (!useUrlForPicture) {
        // Fazer upload do arquivo e obter a URL
        const uploadedImageUrl = await uploadFile();
        
        if (!uploadedImageUrl) {
          throw new Error("Falha ao fazer upload do arquivo");
        }
        
        // Usar a URL retornada pelo servidor
        pictureUrl = uploadedImageUrl;
        
        // Registrar URL para depuração
        
      }
      
      // Atualizar a foto no WhatsApp usando a URL
      
      try {
        const result = await apiRequest({
          url: `/api/whatsapp/profile/update-picture/${instanceName}`,
          method: "POST",
          body: { pictureUrl }
        });
        
        // Verificar se a API retornou sucesso ou não
        if (result.success === false) {
          // Se a API retornou um código de status 202, significa que recebeu a solicitação
          // mas não pôde processá-la completamente. Mostrar uma mensagem mais informativa.
          toast({
            title: "Status parcial",
            description: result.message || "A solicitação foi recebida, mas o WhatsApp pode demorar para processar. A foto será atualizada assim que possível.",
            variant: "default",
          });
          // Ainda vamos atualizar a UI, mesmo que o WhatsApp não tenha confirmado o processamento
          setProfilePictureUrl(pictureUrl);
        } else {
          // Se foi bem-sucedido
          toast({
            title: "Foto atualizada",
            description: "A foto de perfil foi atualizada com sucesso.",
          });
        }
      } catch (apiError: any) {
        
        
        // Verificar se temos uma resposta detalhada da API
        if (apiError.response?.data) {
          
          
          // Ainda vamos atualizar a URL local para fornecer feedback visual
          toast({
            title: "Erro na API do WhatsApp",
            description: apiError.response.data.message || "A foto foi salva localmente, mas o WhatsApp não confirmou a atualização.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro na comunicação",
            description: "A foto foi salva localmente, mas houve um problema de comunicação com o WhatsApp.",
            variant: "destructive",
          });
        }
        
        // Ainda atualizamos a UI com a nova foto, mesmo com o erro
        setProfilePictureUrl(pictureUrl);
      }
      
      // Atualizar informações do perfil e foto exibida
      loadProfileInfo(instanceName);
      setIsEditingPicture(false);
      
      // Limpar estados
      setSelectedFile(null);
      setPreviewImage(null);
      setNewPictureUrl("");
    } catch (error) {
      toast({
        title: "Erro ao atualizar foto",
        description: "Não foi possível atualizar a foto de perfil.",
        variant: "destructive",
      });
      
    } finally {
      setIsSavingPicture(false);
    }
  };
  const { toast } = useToast();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações de Perfil</CardTitle>
        <CardDescription>
          Gerenciar configurações de perfil para suas instâncias do WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent>
        {instances.length === 0 ? (
          <Alert className="mb-4">
            <AlertTitle>Nenhuma instância disponível</AlertTitle>
            <AlertDescription>
              Crie uma instância primeiro para configurar o perfil.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* Informação sobre a instância atual */}
            <div className="p-4 bg-gray-50 border rounded-md text-center mb-4">
              <p className="text-sm font-medium text-gray-700">
                Configurando perfil para a instância: 
                <span className="font-bold text-primary ml-1">
                  {form.watch("profileInstance") || "Nenhuma instância selecionada"}
                </span>
              </p>
            </div>

            <div className="grid gap-4 pt-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Informações do Perfil</h3>
                <div className="border rounded-md p-4">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Coluna da Foto */}
                    <div className="flex flex-col items-center">
                      {profilePictureUrl && profilePictureUrl !== 'null' && profilePictureUrl !== 'undefined' ? (
                        <div className="relative h-24 w-24 overflow-hidden rounded-md border shadow group">
                          <img 
                            src={profilePictureUrl} 
                            alt="Foto de perfil do WhatsApp" 
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              
                              // Gerar um placeholder com as iniciais da instância
                              const instance = form.watch("profileInstance") || "WhatsApp";
                              const initials = instance.substring(0, 2).toUpperCase();
                              // Usar serviço UI Avatars para gerar um avatar com iniciais
                              e.currentTarget.src = `https://ui-avatars.com/api/?name=${initials}&background=0D8ABC&color=fff&size=256`;
                            }}
                          />
                          <div 
                            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            onClick={() => setIsEditingPicture(true)}
                          >
                            <Edit className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="flex h-24 w-24 items-center justify-center rounded-md border bg-muted shadow cursor-pointer hover:bg-gray-100"
                          onClick={() => setIsEditingPicture(true)}
                          title="Clique para adicionar uma foto de perfil"
                        >
                          <User className="h-10 w-10 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        <p className="text-xs text-gray-500">
                          {profilePictureUrl && profilePictureUrl !== 'null' && profilePictureUrl !== 'undefined'
                            ? "Foto carregada" 
                            : "Sem imagem"}
                        </p>
                        <button 
                          className="p-1 hover:bg-gray-100 rounded" 
                          onClick={() => setIsEditingPicture(true)}
                          title="Editar foto de perfil"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Coluna de Informações */}
                    <div className="flex-1 space-y-4">
                      <div>
                        <h4 className="text-sm font-medium">Detalhes do perfil</h4>
                        <div className="grid grid-cols-1 gap-2 mt-2">
                          <div className="flex justify-between text-sm border-b pb-1">
                            <span className="text-muted-foreground">Nome:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{profileInfo?.name || (form.watch("profileInstance") ? form.watch("profileInstance") : "Sem nome")}</span>
                              <button 
                                className="p-1 hover:bg-gray-100 rounded" 
                                onClick={() => setIsEditingName(true)}
                                title="Editar nome"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                          <div className="flex justify-between text-sm border-b pb-1">
                            <span className="text-muted-foreground">Telefone:</span>
                            <span className="font-medium">{profileInfo?.wuid ? profileInfo.wuid.split('@')[0] : '-'}</span>
                          </div>
                          <div className="flex justify-between text-sm border-b pb-1">
                            <span className="text-muted-foreground">Status:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {profileInfo?.status?.status || "Não disponível"}
                              </span>
                              <button 
                                className="p-1 hover:bg-gray-100 rounded" 
                                onClick={() => setIsEditingStatus(true)}
                                title="Editar status"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {profileInfo?.description && (
                        <div>
                          <h4 className="text-sm font-medium">Descrição</h4>
                          <div className="mt-2 text-sm border rounded-md p-2">
                            {profileInfo.description || "Sem descrição"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Configurações de Privacidade</h3>
                <div className="space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Visto por último</span>
                    <select className="text-xs border rounded p-1">
                      <option value="all">Todos</option>
                      <option value="contacts">Meus contatos</option>
                      <option value="none">Ninguém</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Foto do perfil</span>
                    <select className="text-xs border rounded p-1">
                      <option value="all">Todos</option>
                      <option value="contacts">Meus contatos</option>
                      <option value="none">Ninguém</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recibos de leitura</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Grupos</span>
                    <select className="text-xs border rounded p-1">
                      <option value="all">Todos</option>
                      <option value="contacts">Meus contatos</option>
                      <option value="none">Ninguém</option>
                    </select>
                  </div>
                  <Button size="sm" className="mt-2">
                    Salvar Privacidade
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setActiveTab("instances")}
          className="mr-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Instâncias
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              // Validar se a instância está selecionada
              if (!form.watch("profileInstance")) {
                toast({
                  title: "Selecione uma instância",
                  description: "É necessário selecionar uma instância para obter as informações.",
                  variant: "destructive",
                });
                return;
              }
              
              toast({
                title: "Atualizando informações",
                description: `Buscando informações atuais para ${form.watch("profileInstance")}`,
              });
              
              apiRequest({
                url: `/api/whatsapp/profile/${form.watch("profileInstance")}`,
                method: "GET",
              })
              .then((data) => {
                
                
                if (data && data.profile) {
                  // Armazenar informações completas do perfil
                  
                  setProfileInfo(data.profile);
                  
                  // Inicializar campos de edição
                  if (data.profile.name) {
                    setNewName(data.profile.name);
                  }
                  
                  if (data.profile.status && data.profile.status.status) {
                    setNewStatus(data.profile.status.status);
                  }
                  
                  // Atualizar a foto de perfil se disponível
                  // Verifica se a foto está disponível e não é nula/undefined
                  const profilePic = data.profile.picture || data.profile.profilePictureUrl;
                  if (profilePic && profilePic !== 'null' && profilePic !== 'undefined') {
                    setProfilePictureUrl(profilePic);
                  } else {
                    // Limpar URL anterior se não houver foto válida
                    setProfilePictureUrl(null);
                  }
                  
                  toast({
                    title: "Informações atualizadas",
                    description: "Informações de perfil obtidas com sucesso.",
                  });
                } else {
                  
                  
                  // Definir dados básicos para evitar UI quebrada
                  const instanceName = form.watch("profileInstance");
                  setProfileInfo({
                    name: instanceName,
                    status: { status: "Não disponível" }
                  });
                  
                  toast({
                    title: "Nenhuma informação encontrada",
                    description: "Não foi possível obter informações de perfil.",
                    variant: "destructive",
                  });
                }
              })
              .catch((error) => {
                toast({
                  title: "Erro ao atualizar informações",
                  description: "Não foi possível obter as informações de perfil.",
                  variant: "destructive",
                });
              });
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Informações
          </Button>
        </div>
      </CardFooter>
      
      {/* Diálogo para editar nome */}
      <Dialog open={isEditingName} onOpenChange={setIsEditingName}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Nome de Perfil</DialogTitle>
            <DialogDescription>
              Altere o nome de exibição do seu perfil WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right">
                Nome
              </label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingName(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateName} disabled={isSavingName}>
              {isSavingName ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para editar status */}
      <Dialog open={isEditingStatus} onOpenChange={setIsEditingStatus}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Status</DialogTitle>
            <DialogDescription>
              Altere a mensagem de status do seu perfil WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="status" className="text-right">
                Status
              </label>
              <Input
                id="status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingStatus(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isSavingStatus}>
              {isSavingStatus ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para editar foto de perfil */}
      <Dialog 
        open={isEditingPicture} 
        onOpenChange={(open) => {
          setIsEditingPicture(open);
          if (!open) {
            // Resetar estados ao fechar o diálogo
            setSelectedFile(null);
            setPreviewImage(null);
            setUseUrlForPicture(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Foto de Perfil</DialogTitle>
            <DialogDescription>
              Altere a foto de perfil do WhatsApp enviando uma imagem ou informando um URL.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Exibição da foto atual, se houver */}
            {profilePictureUrl && profilePictureUrl !== 'null' && profilePictureUrl !== 'undefined' && !previewImage && (
              <div className="flex flex-col items-center mb-4 pb-4 border-b">
                <p className="text-sm text-gray-500 mb-2">Foto atual:</p>
                <div className="h-24 w-24 overflow-hidden rounded-md border shadow mb-2">
                  <img 
                    src={profilePictureUrl} 
                    alt="Foto de perfil atual" 
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      
                      // Fallback para quando a imagem não carrega
                      e.currentTarget.src = "/placeholder-user.png";
                    }}
                  />
                </div>
              </div>
            )}
            
            {/* Abas para escolher entre Enviar Arquivo ou Usar URL */}
            <div className="flex border-b">
              <button 
                className={`py-2 px-4 font-medium text-sm ${!useUrlForPicture ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
                onClick={() => setUseUrlForPicture(false)}
                type="button"
              >
                Enviar Arquivo
              </button>
              <button 
                className={`py-2 px-4 font-medium text-sm ${useUrlForPicture ? 'border-b-2 border-primary text-primary' : 'text-gray-500'}`}
                onClick={() => setUseUrlForPicture(true)}
                type="button"
              >
                Usar URL
              </button>
            </div>

            {useUrlForPicture ? (
              // Opção de URL
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="pictureUrl" className="text-right">
                  URL da Imagem
                </label>
                <Input
                  id="pictureUrl"
                  value={newPictureUrl}
                  onChange={(e) => setNewPictureUrl(e.target.value)}
                  className="col-span-3"
                  placeholder="https://exemplo.com/imagem.jpg"
                />
                <div className="col-span-4 text-center text-xs text-gray-500">
                  A imagem deve estar disponível publicamente na internet.
                </div>
              </div>
            ) : (
              // Opção de Upload
              <div className="space-y-4">
                <div 
                  className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer"
                  onClick={() => !previewImage && fileInputRef.current?.click()}
                >
                  {previewImage ? (
                    // Pré-visualização de imagem selecionada
                    <div className="relative w-32 h-32 mb-2">
                      <img
                        src={previewImage}
                        alt="Pré-visualização"
                        className="w-full h-full object-cover rounded-md"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(null);
                          setSelectedFile(null);
                        }}
                        className="absolute -top-2 -right-2 bg-white border shadow-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded-full p-1"
                        title="Remover imagem"
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    // Ícone para upload
                    <div className="text-gray-500">
                      <Image className="mx-auto h-12 w-12 mb-2" />
                      <p className="text-sm font-medium">Arraste uma imagem ou clique para selecionar</p>
                    </div>
                  )}
                  
                  <input 
                    type="file"
                    id="profile-picture-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                  />
                  
                  {!previewImage && (
                    <Button 
                      variant="outline" 
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="mt-4"
                      type="button"
                    >
                      Selecionar Imagem
                    </Button>
                  )}
                </div>
                
                <div className="text-xs text-gray-500 text-center">
                  Formatos suportados: JPEG, PNG, GIF, WEBP. Tamanho máximo: 50MB.
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditingPicture(false)}
              type="button"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdatePicture} 
              disabled={isSavingPicture || (!newPictureUrl && !selectedFile)}
              type="button"
            >
              {isSavingPicture ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ProfileTab;
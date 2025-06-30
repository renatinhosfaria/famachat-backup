import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiMeta, SiFacebook } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  LucideAlertCircle, 
  LucideCircleCheck, 
  LucideKey, 
  LucideRefreshCcw, 
  LucideShieldCheck, 
  LucideWrench,
  LucideLink,
  LucideWifi,
  LucideCheckCircle2
} from "lucide-react";

// Interface para a configuração do Facebook
interface FacebookConfig {
  id: number;
  appId: string;
  appSecret: string;
  accessToken: string;
  userAccessToken?: string;
  verificationToken?: string;
  pageId?: string;
  adAccountId?: string;
  webhookEnabled: boolean;
  isActive: boolean;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

export default function FacebookPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [newConfig, setNewConfig] = useState({
    appId: "",
    appSecret: "",
    accessToken: "",
    userAccessToken: "",
    verificationToken: "",
    pageId: "",
    adAccountId: "",
    webhookEnabled: false,
    isActive: true
  });

  // Verificar se o usuário tem permissão
  if (currentUser?.role !== "Gestor") {
    return (
      <div className="p-8 text-center">
        <LucideAlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-4">Acesso Negado</h2>
        <p className="mb-4">Você não tem permissão para acessar esta página.</p>
        <p>Apenas usuários com a função de Gestor podem configurar integrações com o Facebook.</p>
      </div>
    );
  }

  // Obter configuração atual do Facebook
  const { 
    data: facebookConfig, 
    isLoading: isLoadingConfig,
    isError: isErrorConfig,
    refetch: refetchConfig
  } = useQuery<FacebookConfig>({
    queryKey: ["/api/facebook/config"],
    retry: 1
  });

  // Mutation para salvar configuração
  const { mutate: saveFacebookConfig, isPending: isSavingConfig } = useMutation({
    mutationFn: async (config: any) => {
      // Se já existe configuração, atualizamos
      if (facebookConfig?.id) {
        return await apiRequest(
          "PATCH", 
          `/api/facebook/config/${facebookConfig.id}`, 
          config
        );
      } else {
        // Se não existe, criamos uma nova
        return await apiRequest(
          "POST",
          "/api/facebook/config",
          config
        );
      }
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "As configurações do Facebook foram salvas com sucesso.",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/config"] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar",
        description: `Ocorreu um erro: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation para assinar o webhook
  const { mutate: subscribeWebhook, isPending: isSubscribing } = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "POST", 
        "/api/facebook/subscribe-webhook", 
        {}
      );
    },
    onSuccess: (data) => {
      toast({
        title: "Webhook assinado",
        description: "O webhook foi assinado com sucesso no Facebook.",
        variant: "default"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/facebook/config"] });
      refetchConfig();
    },
    onError: (error) => {
      toast({
        title: "Erro na assinatura",
        description: `Não foi possível assinar o webhook: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation para verificar status das assinaturas
  const { mutate: checkSubscriptionStatus, isPending: isCheckingStatus } = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "GET", 
        "/api/facebook/subscription-status", 
        {}
      );
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Status verificado",
          description: "O status das assinaturas foi verificado com sucesso.",
          variant: "default"
        });
      } else {
        toast({
          title: "Verificação concluída",
          description: data.message || "Não foi possível verificar o status das assinaturas.",
          variant: "default"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro na verificação",
        description: `Ocorreu um erro: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation para assinar página
  const { mutate: subscribePage, isPending: isSubscribingPage } = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "POST", 
        "/api/facebook/subscribe-page", 
        {
          pageId: newConfig.pageId,
          userAccessToken: newConfig.userAccessToken
        }
      );
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Página assinada",
          description: "A página foi assinada com sucesso para receber notificações de leads.",
          variant: "default"
        });
      } else {
        toast({
          title: "Assinatura não concluída",
          description: data.message || "Não foi possível assinar a página.",
          variant: "default"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Erro na assinatura",
        description: `Não foi possível assinar a página: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Mutation para testar conexão com Facebook
  const { mutate: testFacebookConnection, isPending: isTestingConnection } = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "POST", 
        "/api/facebook/test-connection", 
        facebookConfig || newConfig
      );
    },
    onSuccess: (data) => {
      toast({
        title: "Conexão bem-sucedida",
        description: "A conexão com a API do Facebook foi estabelecida com sucesso.",
        variant: "default"
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na conexão",
        description: `Não foi possível conectar à API do Facebook: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Manipular mudanças no formulário
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setNewConfig(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  // Manipular envio do formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveFacebookConfig(facebookConfig?.id ? { ...newConfig } : newConfig);
  };

  // Preencher o formulário com dados existentes quando carregados
  React.useEffect(() => {
    if (facebookConfig) {
      setNewConfig({
        appId: facebookConfig.appId,
        appSecret: facebookConfig.appSecret,
        accessToken: facebookConfig.accessToken,
        userAccessToken: facebookConfig.userAccessToken || "",
        verificationToken: facebookConfig.verificationToken || "",
        pageId: facebookConfig.pageId || "",
        adAccountId: facebookConfig.adAccountId || "",
        webhookEnabled: facebookConfig.webhookEnabled,
        isActive: facebookConfig.isActive
      });
    }
  }, [facebookConfig]);

  // Estado de carregamento
  if (isLoadingConfig) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full mx-auto mb-4"></div>
          <p className="text-lg">Carregando configurações do Facebook...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex items-center space-x-4 mb-8">
        <SiMeta className="w-12 h-12 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Configuração Facebook API</h1>
          <p className="text-muted-foreground">
            Gerencie suas integrações com o Facebook e Meta Business
          </p>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="mb-6">
          <TabsTrigger value="config">Configuração Básica</TabsTrigger>
          <TabsTrigger value="webhook">Webhooks</TabsTrigger>
          <TabsTrigger value="help">Ajuda</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SiFacebook className="mr-2 h-5 w-5 text-blue-600" />
                  Configuração do Facebook API
                </CardTitle>
                <CardDescription>
                  Configure as credenciais da API do Facebook para integração com sua conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="appId">App ID</Label>
                    <Input
                      id="appId"
                      name="appId"
                      placeholder="Insira o App ID"
                      value={newConfig.appId}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="appSecret">App Secret</Label>
                    <Input
                      id="appSecret"
                      name="appSecret"
                      type="password"
                      placeholder="Insira o App Secret"
                      value={newConfig.appSecret}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="accessToken">Access Token</Label>
                    <Input
                      id="accessToken"
                      name="accessToken"
                      placeholder="Insira o Access Token"
                      value={newConfig.accessToken}
                      onChange={handleInputChange}
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Token de acesso de longa duração para API do Facebook. Geralmente válido por 60 dias.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="pageId">Page ID</Label>
                    <Input
                      id="pageId"
                      name="pageId"
                      placeholder="ID da página do Facebook"
                      value={newConfig.pageId}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="adAccountId">Ad Account ID</Label>
                    <Input
                      id="adAccountId"
                      name="adAccountId"
                      placeholder="ID da conta de anúncios"
                      value={newConfig.adAccountId}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-4">
                  <Switch
                    id="isActive"
                    name="isActive"
                    checked={newConfig.isActive}
                    onCheckedChange={(checked) => setNewConfig(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Integração ativa</Label>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => testFacebookConnection()}
                  disabled={isTestingConnection || !newConfig.appId || !newConfig.appSecret || !newConfig.accessToken}
                >
                  {isTestingConnection ? (
                    <>
                      <LucideRefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    <>
                      <LucideWrench className="mr-2 h-4 w-4" />
                      Testar Conexão
                    </>
                  )}
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSavingConfig || !newConfig.appId || !newConfig.appSecret || !newConfig.accessToken}
                >
                  {isSavingConfig ? (
                    <>
                      <LucideRefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <LucideCircleCheck className="mr-2 h-4 w-4" />
                      Salvar Configuração
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="webhook">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Webhook</CardTitle>
              <CardDescription>
                Configure webhooks para receber notificações do Facebook
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="verificationToken">Token de Verificação do Webhook</Label>
                <div className="flex">
                  <Input
                    id="verificationToken"
                    name="verificationToken"
                    placeholder="Token para validação de webhooks"
                    value={newConfig.verificationToken}
                    onChange={handleInputChange}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="ml-2"
                    onClick={() => {
                      // Gerar token aleatório
                      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                      setNewConfig(prev => ({ ...prev, verificationToken: token }));
                    }}
                  >
                    <LucideKey className="mr-2 h-4 w-4" />
                    Gerar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Este token deve ser configurado no Facebook para validar as chamadas de webhook.
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-2">URL do Webhook</h3>
                <div className="flex">
                  <code className="bg-background p-2 rounded text-sm border flex-1">
                    {window.location.origin}/api/webhooks/facebook
                  </code>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="ml-2"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/facebook`);
                      toast({
                        title: "URL copiada",
                        description: "URL do webhook copiada para a área de transferência",
                        variant: "default"
                      });
                    }}
                  >
                    Copiar
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Esta URL deve ser configurada no painel do desenvolvedor do Facebook.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  id="webhookEnabled"
                  name="webhookEnabled"
                  checked={newConfig.webhookEnabled}
                  onCheckedChange={(checked) => setNewConfig(prev => ({ ...prev, webhookEnabled: checked }))}
                />
                <Label htmlFor="webhookEnabled">Habilitar recebimento de webhooks</Label>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" className="w-full mt-4">
                    <LucideShieldCheck className="mr-2 h-4 w-4" />
                    Verificar Webhook
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Verificação de Webhook</AlertDialogTitle>
                    <AlertDialogDescription>
                      Antes de verificar o webhook, certifique-se de que:
                      <ul className="list-disc pl-5 mt-2">
                        <li>O token de verificação foi definido</li>
                        <li>A URL do webhook foi configurada no painel do Facebook</li>
                        <li>O webhook está habilitado nas configurações</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => checkSubscriptionStatus()}
                    >
                      Verificar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <Button 
                  type="button" 
                  onClick={() => subscribeWebhook()}
                  disabled={isSubscribing || !newConfig.appId || !newConfig.appSecret || !newConfig.verificationToken}
                  variant="outline"
                >
                  {isSubscribing ? (
                    <>
                      <LucideRefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      Assinando...
                    </>
                  ) : (
                    <>
                      <LucideLink className="mr-2 h-4 w-4" />
                      Assinar Webhook no App
                    </>
                  )}
                </Button>
                
                <Button 
                  type="button" 
                  onClick={() => checkSubscriptionStatus()}
                  disabled={isCheckingStatus || !newConfig.appId || !newConfig.appSecret}
                  variant="outline"
                >
                  {isCheckingStatus ? (
                    <>
                      <LucideRefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <LucideWifi className="mr-2 h-4 w-4" />
                      Verificar Status
                    </>
                  )}
                </Button>
              </div>
              
              {newConfig.pageId && (
                <div className="w-full">
                  <div className="space-y-3 mb-4">
                    <Label htmlFor="userAccessToken">User Access Token (para assinar página)</Label>
                    <Input
                      id="userAccessToken"
                      name="userAccessToken"
                      placeholder="Token de acesso do usuário"
                      value={newConfig.userAccessToken}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <Button 
                    type="button" 
                    onClick={() => subscribePage()}
                    disabled={isSubscribingPage || !newConfig.pageId || !newConfig.userAccessToken}
                    variant="outline"
                    className="w-full"
                  >
                    {isSubscribingPage ? (
                      <>
                        <LucideRefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                        Assinando página...
                      </>
                    ) : (
                      <>
                        <LucideCheckCircle2 className="mr-2 h-4 w-4" />
                        Assinar Página {newConfig.pageId}
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              <Button 
                type="button" 
                onClick={handleSubmit}
                disabled={isSavingConfig}
                className="w-full"
              >
                {isSavingConfig ? (
                  <>
                    <LucideRefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <LucideCircleCheck className="mr-2 h-4 w-4" />
                    Salvar Configurações de Webhook
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="help">
          <Card>
            <CardHeader>
              <CardTitle>Como configurar a API do Facebook</CardTitle>
              <CardDescription>
                Guia passo a passo para configurar a integração com Facebook
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-2">1. Crie um App no Meta for Developers</h3>
                <p className="text-sm">
                  Acesse <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta for Developers</a> e 
                  crie um novo app para sua empresa.
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-2">2. Obtenha as credenciais</h3>
                <p className="text-sm">
                  No painel do app, encontre o App ID e o App Secret nas configurações básicas.
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-2">3. Gere um token de acesso</h3>
                <p className="text-sm">
                  Gere um token de acesso de longa duração para integração com a API.
                </p>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-2">4. Configure o webhook para leads</h3>
                <p className="text-sm">
                  Para receber leads automaticamente, configure o webhook com a URL e token de verificação. Você pode usar 
                  o botão "Assinar Webhook no App" na aba Webhooks para fazer isso automaticamente.
                </p>
              </div>
              
              <div className="bg-muted rounded-lg p-4">
                <h3 className="font-medium mb-2">5. Vincule sua página ao webhook</h3>
                <p className="text-sm">
                  Use um User Access Token com permissões para gerenciar a página e clique em "Assinar Página" para 
                  começar a receber eventos de leads dessa página específica.
                </p>
              </div>
              
              <div className="bg-muted rounded-lg p-4 border-l-4 border-blue-500">
                <h3 className="font-medium mb-2">Automação de assinatura</h3>
                <p className="text-sm">
                  Este sistema permite assinar o webhook automaticamente, sem precisar configurar manualmente no painel do Facebook. 
                  Basta preencher os campos necessários e usar os botões na aba Webhook.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Shield, Eye, Bell, Mail, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface PrivacySettings {
  dataProcessing: boolean;
  emailMarketing: boolean;
  smsMarketing: boolean;
  behaviorAnalytics: boolean;
  thirdPartySharing: boolean;
  profileVisibility: 'public' | 'contacts' | 'private';
  dataRetention: '1year' | '3years' | '5years';
}

export default function PrivacySettings() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<PrivacySettings>({
    dataProcessing: true,
    emailMarketing: false,
    smsMarketing: false,
    behaviorAnalytics: false,
    thirdPartySharing: false,
    profileVisibility: 'contacts',
    dataRetention: '3years'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Carregar configurações do usuário
    const savedSettings = localStorage.getItem(`privacySettings_${currentUser?.id}`);
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, [currentUser?.id]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Simular salvamento (implementar API real)
      localStorage.setItem(`privacySettings_${currentUser?.id}`, JSON.stringify(settings));
      
      toast({
        title: "Configurações salvas",
        description: "Suas preferências de privacidade foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar suas configurações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataExport = () => {
    // Simular exportação de dados
    const userData = {
      user: currentUser,
      privacySettings: settings,
      exportDate: new Date().toISOString(),
      dataRetentionPolicy: `Dados mantidos por ${settings.dataRetention === '1year' ? '1 ano' : settings.dataRetention === '3years' ? '3 anos' : '5 anos'}`
    };

    const dataStr = JSON.stringify(userData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `meus-dados-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Dados exportados",
      description: "Seus dados foram exportados com sucesso.",
    });
  };

  const handleDataDeletion = () => {
    // Implementar lógica de solicitação de exclusão
    toast({
      title: "Solicitação registrada",
      description: "Sua solicitação de exclusão de dados foi registrada. Entraremos em contato em até 15 dias.",
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-2 mb-6">
        <Shield className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Configurações de Privacidade</h1>
      </div>

      {/* Consentimentos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Consentimentos e Comunicação</span>
          </CardTitle>
          <CardDescription>
            Gerencie como e quando queremos nos comunicar com você
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Email Marketing</h4>
              <p className="text-sm text-muted-foreground">
                Receber ofertas e novidades por email
              </p>
            </div>
            <Switch
              checked={settings.emailMarketing}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, emailMarketing: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">SMS Marketing</h4>
              <p className="text-sm text-muted-foreground">
                Receber ofertas e alertas por SMS
              </p>
            </div>
            <Switch
              checked={settings.smsMarketing}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, smsMarketing: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Análise Comportamental</h4>
              <p className="text-sm text-muted-foreground">
                Permitir análise do seu comportamento para melhorar serviços
              </p>
            </div>
            <Switch
              checked={settings.behaviorAnalytics}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, behaviorAnalytics: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Compartilhamento com Terceiros</h4>
              <p className="text-sm text-muted-foreground">
                Permitir compartilhamento de dados com parceiros confiáveis
              </p>
            </div>
            <Switch
              checked={settings.thirdPartySharing}
              onCheckedChange={(checked) => 
                setSettings(prev => ({ ...prev, thirdPartySharing: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Visibilidade do Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Visibilidade do Perfil</span>
          </CardTitle>
          <CardDescription>
            Controle quem pode ver suas informações
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Quem pode ver seu perfil:</label>
              <select 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                value={settings.profileVisibility}
                onChange={(e) => 
                  setSettings(prev => ({ 
                    ...prev, 
                    profileVisibility: e.target.value as 'public' | 'contacts' | 'private' 
                  }))
                }
              >
                <option value="public">Público</option>
                <option value="contacts">Apenas contatos</option>
                <option value="private">Privado</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retenção de Dados */}
      <Card>
        <CardHeader>
          <CardTitle>Retenção de Dados</CardTitle>
          <CardDescription>
            Defina por quanto tempo seus dados devem ser mantidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Período de retenção:</label>
              <select 
                className="w-full mt-1 p-2 border border-gray-300 rounded-md"
                value={settings.dataRetention}
                onChange={(e) => 
                  setSettings(prev => ({ 
                    ...prev, 
                    dataRetention: e.target.value as '1year' | '3years' | '5years'
                  }))
                }
              >
                <option value="1year">1 ano</option>
                <option value="3years">3 anos</option>
                <option value="5years">5 anos</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Direitos do Titular */}
      <Card>
        <CardHeader>
          <CardTitle>Seus Direitos (LGPD)</CardTitle>
          <CardDescription>
            Exercite seus direitos sobre dados pessoais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Como titular dos dados, você tem direito de acesso, correção, exclusão, 
              portabilidade e revogação do consentimento conforme a LGPD.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              variant="outline" 
              onClick={handleDataExport}
              className="flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Exportar Meus Dados</span>
            </Button>

            <Button 
              variant="outline" 
              onClick={handleDataDeletion}
              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              <span>Solicitar Exclusão</span>
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              Para outras solicitações relacionadas aos seus dados, entre em contato 
              conosco através do email: <strong>dpo@famanegocios.com.br</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isLoading}
          className="flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{isLoading ? "Salvando..." : "Salvar Configurações"}</span>
        </Button>
      </div>
    </div>
  );
}

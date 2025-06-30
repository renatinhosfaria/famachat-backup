import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RefreshCw, Save } from "lucide-react";
import { useState } from "react";

export default function WebhookImplementation() {
  const { toast } = useToast();
  const [webhookInstance, setWebhookInstance] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Função para obter configuração atual do webhook
  const handleGetCurrentConfig = async () => {
    if (!webhookInstance) {
      toast({
        title: "Erro",
        description: "Selecione uma instância para obter a configuração",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await apiRequest({
        url: `/api/whatsapp/webhook/config/${webhookInstance}`,
        method: "GET"
      });
      
      if (data && data.config) {
        setWebhookUrl(data.config.url || "");
        toast({
          title: "Configuração obtida",
          description: `Webhook configurado para: ${data.config.url}`
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível obter a configuração do webhook",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para salvar configuração do webhook
  const handleSaveConfig = async () => {
    if (!webhookInstance || !webhookUrl) {
      toast({
        title: "Erro",
        description: "Selecione uma instância e informe a URL do webhook",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      await apiRequest({
        url: `/api/whatsapp/webhook/config`,
        method: "POST",
        body: {
          instanceName: webhookInstance,
          webhookUrl: webhookUrl
        }
      });
      
      toast({
        title: "Sucesso",
        description: "Webhook configurado com sucesso"
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível configurar o webhook",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Webhook</CardTitle>
          <CardDescription>
            Configure webhooks para receber notificações do WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-instance">Instância</Label>
            <Select value={webhookInstance} onValueChange={setWebhookInstance}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma instância" />
              </SelectTrigger>
              <SelectContent>
                {/* Aqui você pode mapear as instâncias disponíveis */}
                <SelectItem value="instance1">Instância 1</SelectItem>
                <SelectItem value="instance2">Instância 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL do Webhook</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://exemplo.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleGetCurrentConfig}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Obter Configuração Atual
            </Button>

            <Button
              onClick={handleSaveConfig}
              disabled={isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar Configuração
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
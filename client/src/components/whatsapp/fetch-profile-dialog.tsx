import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Interface para os dados do perfil do WhatsApp
interface WhatsAppProfileData {
  name: string;
  wuid: string;
  phoneNumber?: string;
  picture?: string;
  profilePictureUrl?: string;
  status?: {
    status: string;
    setAt: string;
  };
  isBusiness?: boolean;
  description?: string;
}

interface FetchProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceName: string;
  onProfile?: (profile: WhatsAppProfileData) => void;
}

const FetchProfileDialog: React.FC<FetchProfileDialogProps> = ({
  open,
  onOpenChange,
  instanceName,
  onProfile
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profile, setProfile] = useState<WhatsAppProfileData | null>(null);

  // Lida com a busca do perfil
  const handleFetchProfile = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Número de telefone necessário",
        description: "Por favor, digite um número de telefone para buscar",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Chamada ao endpoint correto
      const response = await apiRequest({
        url: `/api/whatsapp/fetch-contact-profile/${instanceName}`,
        method: "POST",
        body: { number: phoneNumber.trim() }
      });

      if (response.data?.success && response.data?.profile) {
        const profileData = response.data.profile;
        setProfile(profileData);
        
        // Notificar o componente pai se necessário
        if (onProfile) {
          onProfile(profileData);
        }
        
        toast({
          title: "Perfil encontrado",
          description: `Dados do perfil para ${profileData.name || phoneNumber} obtidos com sucesso.`,
        });
      } else {
        toast({
          title: "Falha ao buscar perfil",
          description: response.data?.message || "Não foi possível obter os dados do perfil",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      
      toast({
        title: "Erro na busca",
        description: error.response?.data?.message || "Ocorreu um erro ao buscar o perfil do contato",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para formatar número de telefone (exemplo: 553499602714 -> +55 34 9960-2714)
  const formatPhoneNumber = (number: string) => {
    if (!number) return "";
    
    // Remover '@s.whatsapp.net' se existir
    let cleaned = number.replace(/@s\.whatsapp\.net/g, '');
    
    // Remover caracteres não numéricos
    cleaned = cleaned.replace(/\D/g, '');
    
    // Verificar se é um número brasileiro
    if (cleaned.startsWith('55') && cleaned.length >= 10) {
      // Formato brasileiro
      if (cleaned.length === 13) { // Com código do país e 9 dígito
        return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
      } else if (cleaned.length === 12) { // Com código do país, sem 9 dígito
        return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 4)} ${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
      } else {
        // Formato genérico se não encaixar nos padrões acima
        return cleaned;
      }
    } else {
      // Formato genérico para números não brasileiros
      return cleaned;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buscar Perfil do WhatsApp</DialogTitle>
          <DialogDescription>
            Digite o número de telefone para obter informações do perfil no WhatsApp.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="phone-number">Número de Telefone</Label>
            <Input
              id="phone-number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Ex: (34) 99999-9999 ou 5534999999999"
              disabled={isLoading}
            />
            <p className="text-sm text-muted-foreground">
              Digite apenas números ou no formato brasileiro com DDD.
            </p>
          </div>
          
          {profile && (
            <div className="mt-4 border rounded-md p-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={profile.picture || profile.profilePictureUrl} />
                  <AvatarFallback>{profile.name?.substring(0, 2) || '??'}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{profile.name || "Nome não disponível"}</h3>
                  <p className="text-sm text-muted-foreground">{formatPhoneNumber(profile.wuid || profile.phoneNumber || phoneNumber)}</p>
                  {profile.status && (
                    <p className="text-xs mt-1">
                      Status: {profile.status.status}
                    </p>
                  )}
                  {profile.isBusiness && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded mt-1">
                      Conta Business
                    </span>
                  )}
                </div>
              </div>
              {profile.description && (
                <p className="mt-2 text-sm border-t pt-2">
                  {profile.description}
                </p>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="submit" disabled={isLoading} onClick={handleFetchProfile}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando...
              </>
            ) : (
              "Buscar Perfil"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FetchProfileDialog;
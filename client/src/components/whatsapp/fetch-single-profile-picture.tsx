import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface FetchSingleProfilePictureProps {
  clientes?: any[];
  onSuccess?: (data: any) => void;
}

export function FetchSingleProfilePicture({ clientes = [], onSuccess }: FetchSingleProfilePictureProps) {
  const { toast } = useToast();
  const [selectedClienteId, setSelectedClienteId] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [resultData, setResultData] = useState<any>(null);

  const fetchProfilePictureMutation = useMutation({
    mutationFn: (data: { clienteId: number; phoneNumber: string }) => apiRequest({
      url: "/api/whatsapp/fetch-client-profile-picture",
      method: "POST",
      body: data
    }),
    onSuccess: (data) => {
      toast({
        title: data.success 
          ? "Foto de perfil atualizada" 
          : "Processamento concluído",
        description: data.message
      });
      
      setResultData(data);
      
      if (onSuccess) {
        onSuccess(data);
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao buscar foto de perfil",
        description: "Não foi possível buscar a foto de perfil. Verifique se a instância do WhatsApp está conectada.",
        variant: "destructive"
      });
    }
  });

  const handleClienteSelect = (id: string) => {
    setSelectedClienteId(id);
    
    // Se selecionou um cliente, procurar o telefone
    if (id && clientes.length > 0) {
      const cliente = clientes.find(c => c.id === parseInt(id));
      if (cliente && cliente.phone) {
        setPhoneNumber(cliente.phone);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedClienteId) {
      toast({
        title: "Selecione um cliente",
        description: "Por favor, selecione um cliente para buscar a foto de perfil.",
        variant: "destructive"
      });
      return;
    }
    
    if (!phoneNumber) {
      toast({
        title: "Informe o número de telefone",
        description: "Por favor, informe o número de telefone para buscar a foto de perfil.",
        variant: "destructive"
      });
      return;
    }
    
    // Limpar resultado anterior
    setResultData(null);
    
    // Executar a busca
    fetchProfilePictureMutation.mutate({
      clienteId: parseInt(selectedClienteId),
      phoneNumber: phoneNumber
    });
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Buscar Foto de Perfil Individual</CardTitle>
        <CardDescription>
          Busque a foto de perfil do WhatsApp para um cliente específico
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            {clientes.length > 0 ? (
              <Select 
                value={selectedClienteId} 
                onValueChange={handleClienteSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={String(cliente.id)}>
                      {cliente.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="clienteId"
                type="number"
                placeholder="ID do cliente"
                value={selectedClienteId}
                onChange={(e) => setSelectedClienteId(e.target.value)}
              />
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Número de Telefone</Label>
            <Input
              id="phoneNumber"
              placeholder="(00) 00000-0000"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Formato: DDD + número, ex: 34999999999
            </p>
          </div>
          
          {resultData && (
            <div className="mt-4 space-y-4">
              <Alert variant={resultData.success ? "default" : "destructive"}>
                <AlertTitle>{resultData.success ? "Sucesso" : "Atenção"}</AlertTitle>
                <AlertDescription>{resultData.message}</AlertDescription>
              </Alert>
              
              {resultData.profilePicture && (
                <div className="flex flex-col items-center gap-2 p-4 border rounded-md">
                  <h3 className="text-sm font-medium">Foto de Perfil</h3>
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={resultData.profilePicture} alt="Foto de perfil" />
                    <AvatarFallback>
                      <UserCircle className="h-24 w-24" />
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          type="button" 
          onClick={() => {
            setSelectedClienteId("");
            setPhoneNumber("");
            setResultData(null);
          }}
        >
          Limpar
        </Button>
        <Button 
          type="submit"
          onClick={handleSubmit}
          disabled={fetchProfilePictureMutation.isPending}
        >
          {fetchProfilePictureMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Buscar Foto
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
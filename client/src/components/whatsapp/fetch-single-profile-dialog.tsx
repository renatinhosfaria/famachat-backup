import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FetchSingleProfilePicture } from "./fetch-single-profile-picture";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";

interface FetchSingleProfileDialogProps {
  buttonText?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function FetchSingleProfileDialog({
  buttonText = "Buscar Foto Individual",
  variant = "outline",
  size = "default"
}: FetchSingleProfileDialogProps) {
  const [open, setOpen] = React.useState(false);

  // Buscar clientes para o seletor
  const { data: clientes = [], isLoading: isLoadingClientes } = useQuery<any[]>({
    queryKey: ["/api/clientes/list", { pageSize: 100, order: "mais-novos" }],
    // Só buscar quando o diálogo estiver aberto para não sobrecarregar o servidor
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Search className="h-4 w-4 mr-2" />
          {buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Buscar Foto de Perfil Individual</DialogTitle>
          <DialogDescription>
            Busque a foto de perfil do WhatsApp para um cliente específico.
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingClientes ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Carregando clientes...</span>
          </div>
        ) : (
          <FetchSingleProfilePicture 
            clientes={clientes} 
            onSuccess={() => {
              // Não fechar o diálogo automaticamente para o usuário ver o resultado
              // Deixar que ele feche quando terminar
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
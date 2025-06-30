import { useState } from "react";
import { formatDateShort } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Calendar, MessageSquareX, User } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Cliente } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ClienteCardProps {
  cliente: Cliente;
  onCardClick?: (cliente: Cliente) => void;
}

export function ClienteCard({ cliente, onCardClick }: ClienteCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  // Função para atualizar o status do cliente
  const updateClienteStatus = async (newStatus: string) => {
    if (isUpdating) return;
    
    try {
      setIsUpdating(true);
      await apiRequest({
        url: `/api/clientes/${cliente.id}`,
        method: "PATCH",
        body: { status: newStatus },
      });
      
      // Invalidate clientes query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
      
      toast({
        title: "Status atualizado",
        description: `O status foi alterado para ${newStatus}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status do cliente",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Obter as iniciais do nome para o fallback do avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <Card 
      className="mb-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onCardClick && onCardClick(cliente)}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage 
              src={cliente.profilePicUrl || ''} 
              alt={cliente.fullName} 
            />
            <AvatarFallback>
              {cliente.hasWhatsapp ? getInitials(cliente.fullName) : <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex flex-col space-y-2 w-full">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold line-clamp-1">{cliente.fullName}</h3>
              {cliente.source && (
                <Badge variant="outline" className="text-xs">
                  {cliente.source}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center text-sm text-muted-foreground">
              <Phone className="mr-1 h-3 w-3" />
              <span className="flex items-center">
                {cliente.phone}
                {cliente.hasWhatsapp === true ? (
                  <span title="Cliente tem WhatsApp">
                    <FaWhatsapp className="ml-1 h-3 w-3 text-green-600" />
                  </span>
                ) : cliente.hasWhatsapp === false ? (
                  <span title="Cliente não tem WhatsApp">
                    <MessageSquareX className="ml-1 h-3 w-3 text-red-500" />
                  </span>
                ) : null}
              </span>
            </div>
            
            {cliente.createdAt && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Calendar className="mr-1 h-3 w-3" />
                <span>Cadastro: {formatDateShort(cliente.createdAt)}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import React from 'react';
import { Button } from "@/components/ui/button";
import { PowerOff, Power, RefreshCw, Loader2, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface WhatsappButtonsProps {
  instance: any;
  status: string;
  handleInstanceStatus: (instance: any, action: 'connect' | 'disconnect' | 'check') => void;
  disconnectInstanceMutation: any;
  connectInstanceMutation: any;
  getQRCodeMutation: any; // Ainda mantido na interface para compatibilidade
  checkStatusMutation: any;
}

export function WhatsappButtons({
  instance,
  status,
  handleInstanceStatus,
  disconnectInstanceMutation,
  connectInstanceMutation,
  getQRCodeMutation,
  checkStatusMutation
}: WhatsappButtonsProps) {
  return (
    <>
      {instance.status === 'Conectado' ? (
        <Button 
          variant="destructive" 
          size="sm"
          onClick={() => handleInstanceStatus(instance, 'disconnect')}
          disabled={disconnectInstanceMutation.isPending}
        >
          {disconnectInstanceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <PowerOff className="h-4 w-4 mr-1" />
          Desconectar
        </Button>
      ) : (
        <Button 
          variant="default" 
          size="sm"
          onClick={() => handleInstanceStatus(instance, 'connect')}
          disabled={connectInstanceMutation.isPending}
        >
          {connectInstanceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Power className="h-4 w-4 mr-1" />
          Conectar
        </Button>
      )}
      
      <div className="flex gap-2">
        {/* Removido o botão QR Code pois agora ele aparece automaticamente após clicar em "Conectar" */}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              disabled={checkStatusMutation.isPending}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleInstanceStatus(instance, 'check')}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Verificar Status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
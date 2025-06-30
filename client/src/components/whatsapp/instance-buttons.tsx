import { Button } from "@/components/ui/button";
import { Loader2, QrCode, PowerOff, Power, RefreshCw, Shield, Globe, PhoneCall } from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface InstanceButtonsProps {
  instance: any;
  handleInstanceStatus: (instance: any, action: 'connect' | 'disconnect' | 'qrcode' | 'check' | 'verify-status') => void;
  disconnectInstanceMutation: any;
  connectInstanceMutation: any;
  getQRCodeMutation: any;
  checkStatusMutation: any;
  verifyActualStatusMutation?: any;
}

export function InstanceButtons({
  instance,
  handleInstanceStatus,
  disconnectInstanceMutation,
  connectInstanceMutation,
  getQRCodeMutation,
  checkStatusMutation,
  verifyActualStatusMutation
}: InstanceButtonsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
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
      
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => handleInstanceStatus(instance, 'qrcode')}
        disabled={getQRCodeMutation.isPending || instance.status === 'Conectado'}
      >
        <QrCode className="h-4 w-4 mr-1" />
        QR Code
      </Button>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleInstanceStatus(instance, 'verify-status')}
              disabled={verifyActualStatusMutation?.isPending}
            >
              {verifyActualStatusMutation?.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Globe className="h-4 w-4 mr-1" />
              Verificar Status
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Verificar o status real diretamente na API Evolution</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
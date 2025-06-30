import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";

interface ProfileAvatarProps {
  name: string;
  clienteId: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-32 w-32",
};

export function ProfileAvatar({
  name,
  clienteId,
  size = "lg",
  className = "",
}: ProfileAvatarProps) {
  const [nameInitials, setNameInitials] = useState("??");
  
  // Buscar dados do cliente para obter a URL da foto de perfil
  const { data: cliente } = useQuery({
    queryKey: [`/api/clientes/${clienteId}`],
    enabled: !!clienteId,
  });

  useEffect(() => {
    // Gerar iniciais do nome
    if (name) {
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        // Pegar a primeira letra do primeiro e último nome
        setNameInitials(
          `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
        );
      } else if (nameParts.length === 1) {
        // Se for um nome único, usar as duas primeiras letras
        setNameInitials(
          nameParts[0].length > 1
            ? nameParts[0].substring(0, 2).toUpperCase()
            : nameParts[0][0].toUpperCase()
        );
      }
    }
  }, [name]);

  return (
    <div className="flex flex-col items-center">
      <Avatar className={`${sizeClasses[size]} ${className}`}>
        {cliente?.profilePicUrl && (
          <AvatarImage 
            src={cliente.profilePicUrl} 
            alt={name} 
          />
        )}
        <AvatarFallback className="text-xl font-semibold bg-primary text-primary-foreground">
          {nameInitials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";

interface UserFilterProps {
  selectedUserId: number | null;
  onUserChange: (userId: number | null) => void;
}

export default function UserFilter({ selectedUserId, onUserChange }: UserFilterProps) {
  // Buscar lista de usuários da API
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: true,
  });

  // Garantir que users é um array
  const usersList = Array.isArray(users) ? users : [];

  return (
    <div className="w-full xxs:w-auto">
      <Select
        value={selectedUserId?.toString() || "all"}
        onValueChange={(value) => {
          if (value === "all") {
            onUserChange(null);
          } else {
            onUserChange(parseInt(value));
          }
        }}
      >
        <SelectTrigger className="w-10 h-8 p-1 xxs:w-12 xxs:h-9 xxs:p-2 md:w-[180px] md:h-10 md:p-3 lg:w-[200px] justify-center md:justify-between">
          <div className="flex items-center gap-1 xxs:gap-2">
            <User className="h-3 w-3 xxs:h-4 xxs:w-4 text-muted-foreground" />
            <div className="hidden md:block">
              <SelectValue placeholder="Selecionar usuário" />
            </div>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os usuários</SelectItem>
          {usersList.map((user: any) => (
            <SelectItem key={user.id} value={user.id.toString()}>
              {user.username} ({user.role})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
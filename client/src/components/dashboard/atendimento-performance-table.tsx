import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodType } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ColumnKey = "fullName" | "leads" | "appointments" | "appointmentConversion";

// Função para calcular a conversão de agendamentos
const calculateAppointmentConversion = (leads: number, appointments: number): number => {
  return leads > 0 ? Math.round((appointments / leads) * 100) : 0;
};

type UserMetric = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  department: string;
  leads: number;
  appointments: number;
  visits: number;
  sales: number;
  conversion: number;
};

interface AtendimentoPerformanceTableProps {
  period: PeriodType;
}

export default function AtendimentoPerformanceTable({ period }: AtendimentoPerformanceTableProps) {
  const [sortColumn, setSortColumn] = useState<ColumnKey>("leads");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/users/performance", period],
  });

  const handleSort = (column: ColumnKey) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const renderSortIcon = (column: ColumnKey) => {
    if (sortColumn !== column) {
      return <ChevronsUpDown className="ml-2 h-4 w-4" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-2 h-4 w-4" />
    ) : (
      <ChevronDown className="ml-2 h-4 w-4" />
    );
  };

  // Processar e ordenar os dados - filtrar apenas consultores de atendimento
  const processedData = data && Array.isArray(data)
    ? [...data]
        .filter(user => {
          // Log para depuração detalhada
          console.log(`[AtendimentoTable] Usuário: ${user.username}, Role: "${user.role}", Department: "${user.department}"`);
          
          // Filtrar consultores de atendimento usando múltiplos critérios
          const isConsultor = user.role && (
            user.role.includes("Consultor") || 
            user.role === "Consultor de Atendimento" ||
            user.role.toLowerCase().includes("consultor")
          );
          
          const isCentralAtendimento = user.department && (
            user.department === "Central de Atendimento" ||
            user.department.toLowerCase().includes("atendimento")
          );
          
          const shouldInclude = isConsultor || isCentralAtendimento;
          console.log(`[AtendimentoTable] ${user.username} - Include: ${shouldInclude} (isConsultor: ${isConsultor}, isCentralAtendimento: ${isCentralAtendimento})`);
          
          return shouldInclude;
        })
        .sort((a, b) => {
          // Ordenação especial para a coluna de conversão de agendamentos
          if (sortColumn === "appointmentConversion") {
            const conversionA = calculateAppointmentConversion(a.leads, a.appointments);
            const conversionB = calculateAppointmentConversion(b.leads, b.appointments);
            
            if (sortDirection === "asc") {
              return conversionA > conversionB ? 1 : -1;
            }
            return conversionA < conversionB ? 1 : -1;
          }
          
          // Ordenação padrão para outras colunas
          if (sortDirection === "asc") {
            return a[sortColumn] > b[sortColumn] ? 1 : -1;
          }
          return a[sortColumn] < b[sortColumn] ? 1 : -1;
        })
    : [];

  return (
    <Card className="col-span-full lg:col-span-6">
      <CardHeader className="pb-3 xxs:pb-4">
        <CardTitle className="text-base xxs:text-lg">Desempenho da Equipe - Central de Atendimento</CardTitle>
        <CardDescription className="text-xs xxs:text-sm">
          Visão detalhada do desempenho dos consultores de atendimento no período selecionado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px] xxs:min-w-[140px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("fullName")}
                    className="font-medium text-xs xxs:text-sm"
                  >
                    Nome
                    {renderSortIcon("fullName")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[80px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("leads")}
                    className="font-medium text-xs xxs:text-sm"
                  >
                    Clientes
                    {renderSortIcon("leads")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[100px] hidden xxs:table-cell">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("appointments")}
                    className="font-medium text-xs xxs:text-sm"
                  >
                    Agendamentos
                    {renderSortIcon("appointments")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("appointmentConversion")}
                    className="font-medium text-xs xxs:text-sm"
                  >
                    Conv. (%)
                    {renderSortIcon("appointmentConversion")}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-[150px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[50px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[50px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[50px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[80px]" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : processedData && processedData.length > 0 ? (
                processedData.map((user: UserMetric) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-xs xxs:text-sm">
                      <div className="flex flex-col xxs:flex-row xxs:items-center gap-1 xxs:gap-2">
                        <span className="truncate max-w-[100px] xxs:max-w-none">{user.username || user.fullName}</span>
                        <Badge
                          variant="outline"
                          className="text-xs bg-purple-50 text-purple-700"
                        >
                          {user.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs xxs:text-sm">{user.leads}</TableCell>
                    <TableCell className="text-xs xxs:text-sm hidden xxs:table-cell">{user.appointments}</TableCell>
                    <TableCell>
                      {/* Calcular taxa de conversão de Clientes para Agendamentos */}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          user.leads > 0 && (user.appointments / user.leads * 100) > 50
                            ? "bg-green-50 text-green-700"
                            : user.leads > 0 && (user.appointments / user.leads * 100) > 30
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700"
                        )}
                      >
                        {user.leads > 0 
                          ? Math.round((user.appointments / user.leads) * 100)
                          : 0}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-xs xxs:text-sm">
                    Nenhum consultor de atendimento encontrado para o período selecionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
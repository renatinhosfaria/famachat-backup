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

type ColumnKey = "fullName" | "leads" | "appointments" | "visits" | "sales" | "conversion" | "visitConversion";

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
  visitConversion?: number;
};

interface VendasPerformanceTableProps {
  period: PeriodType;
}

export default function VendasPerformanceTable({ period }: VendasPerformanceTableProps) {
  const [sortColumn, setSortColumn] = useState<ColumnKey>("sales");
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

  // Funções para calcular as taxas de conversão
  // Taxa de conversão de agendamentos para visitas
  const calculateVisitConversionRate = (appointments: number, visits: number): number => {
    return appointments > 0 ? Math.round((visits / appointments) * 100) : 0;
  };
  
  // Taxa de conversão de visitas para vendas
  const calculateSalesConversionRate = (visits: number, sales: number): number => {
    return visits > 0 ? Math.round((sales / visits) * 100) : 0;
  };

  // Processar e ordenar os dados - filtrar apenas corretores e gestores (equipe de vendas)
  const processedData = data && Array.isArray(data)
    ? [...data]
        .filter(user => {
          // Log completo de todos os dados do usuário para depuração
          console.log(`Usuário: ${user.username || user.fullName}, ID: ${user.id}, Função: ${user.role}, Departamento: ${user.department}`);
          console.log(`Métricas - Visitas: ${user.visits}, Vendas: ${user.sales}, Agendamentos: ${user.appointments}`);
          
          // Filtrar apenas usuários do departamento de Vendas ou que sejam Corretores
          return user.department === "Vendas" ||
                 user.role === "Corretor" ||
                 user.role === "Gestor" ||
                 user.username === "Renato Faria" ||  // Incluir explicitamente usuários específicos
                 user.username === "Michel" ||
                 user.username === "Humberto";
        })
        .map(user => {
          // 1. Calcular taxa de conversão de visitas (agendamentos para visitas)
          // Conversão Visitas (%) = (visitas / agendamentos) × 100
          const visitConversionRate = calculateVisitConversionRate(user.appointments, user.visits);
          
          // 2. Calcular taxa de conversão de vendas (visitas para vendas)
          // Conversão Vendas (%) = (vendas / visitas) × 100  
          const salesConversionRate = calculateSalesConversionRate(user.visits, user.sales);
          
          // Retornar usuário com as taxas de conversão calculadas
          return {
            ...user,
            visitConversion: visitConversionRate,
            conversion: salesConversionRate // Sobrescreve a conversão vinda do backend
          };
        })
        .sort((a, b) => {
          // Ordenação especial para a coluna de conversão
          if (sortColumn === "conversion") {
            // Usar o valor já calculado no backend em vez de recalcular
            if (sortDirection === "asc") {
              return a.conversion > b.conversion ? 1 : -1;
            }
            return a.conversion < b.conversion ? 1 : -1;
          }
          
          // Ordenação especial para a coluna de conversão de visitas
          if (sortColumn === "visitConversion") {
            if (sortDirection === "asc") {
              return (a.visitConversion || 0) > (b.visitConversion || 0) ? 1 : -1;
            }
            return (a.visitConversion || 0) < (b.visitConversion || 0) ? 1 : -1;
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
        <CardTitle className="text-base xxs:text-lg">Desempenho da Equipe - Vendas</CardTitle>
        <CardDescription className="text-xs xxs:text-sm">
          Visão detalhada do desempenho dos corretores e gestores no período selecionado.
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
                <TableHead className="min-w-[80px] hidden xxs:table-cell">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("visits")}
                    className="font-medium text-xs xxs:text-sm"
                  >
                    Visitas
                    {renderSortIcon("visits")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[100px] hidden sm:table-cell">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("visitConversion")}
                    className="font-medium text-xs xxs:text-sm"
                  >
                    Conv. Visitas (%)
                    {renderSortIcon("visitConversion")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[80px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("sales")}
                    className="font-medium text-xs xxs:text-sm"
                  >
                    Vendas
                    {renderSortIcon("sales")}
                  </Button>
                </TableHead>
                <TableHead className="min-w-[90px]">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("conversion")}
                    className="font-medium text-xs xxs:text-sm"
                  >
                    Conv. Vendas (%)
                    {renderSortIcon("conversion")}
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
                          className={cn(
                            "text-xs",
                            user.role === "Gestor"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-green-50 text-green-700"
                          )}
                        >
                          {user.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs xxs:text-sm hidden xxs:table-cell">{user.visits}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          (user.visitConversion || 0) > 50
                            ? "bg-green-50 text-green-700"
                            : (user.visitConversion || 0) > 30
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700"
                        )}
                      >
                        {user.visitConversion || 0}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs xxs:text-sm">{user.sales}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          user.conversion > 50
                            ? "bg-green-50 text-green-700"
                            : user.conversion > 30
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700"
                        )}
                      >
                        {user.conversion}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    Nenhum corretor encontrado para o período selecionado.
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
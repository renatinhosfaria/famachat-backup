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
  Trophy,
  Medal,
  Award,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodType } from "@/lib/utils";
import { cn } from "@/lib/utils";

type ColumnKey = "fullName" | "appointments" | "appointmentConversion" | "visits" | "visitConversion" | "sales" | "salesConversion";

// Função para calcular conversões
const calculateConversion = (numerator: number, denominator: number): number => {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
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

interface PerformanceRankingProps {
  period: PeriodType;
}

export default function PerformanceRanking({ period }: PerformanceRankingProps) {
  const [sortColumn, setSortColumn] = useState<ColumnKey>("sales");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Buscar dados de performance
  const { data: performanceData, isLoading: isLoadingPerformance } = useQuery({
    queryKey: ["/api/users/performance", period],
  });

  // Buscar todos os usuários
  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/users"],
  });

  const isLoading = isLoadingPerformance || isLoadingUsers;

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

  const renderRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-4 w-4 sm:h-3 sm:w-3 md:h-3 md:w-3 lg:h-3 lg:w-3 xl:h-4 xl:w-4 text-yellow-500" />;
    if (index === 1) return <Medal className="h-4 w-4 sm:h-3 sm:w-3 md:h-3 md:w-3 lg:h-3 lg:w-3 xl:h-4 xl:w-4 text-gray-400" />;
    if (index === 2) return <Award className="h-4 w-4 sm:h-3 sm:w-3 md:h-3 md:w-3 lg:h-3 lg:w-3 xl:h-4 xl:w-4 text-amber-600" />;
    return <span className="text-sm text-muted-foreground font-medium">{index + 1}</span>;
  };

  // Combinar dados de usuários com dados de performance
  const processedData = usersData && Array.isArray(usersData)
    ? usersData
        .filter(user => {
          // Filtrar apenas usuários dos departamentos Central de Atendimento e Vendas
          return user.department === "Central de Atendimento" || user.department === "Vendas";
        })
        .map(user => {
          // Encontrar dados de performance para este usuário
          const performanceUser = performanceData && Array.isArray(performanceData) 
            ? performanceData.find(p => p.id === user.id)
            : null;
          
          const processedUser = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            department: user.department,
            leads: performanceUser?.leads || 0,
            appointments: performanceUser?.appointments || 0,
            visits: performanceUser?.visits || 0,
            sales: performanceUser?.sales || 0,
            conversion: performanceUser?.conversion || 0,
          };
          

          return processedUser;
        })
        .sort((a, b) => {
          // Ordenação especial para colunas de conversão
          if (sortColumn === "appointmentConversion") {
            const conversionA = calculateConversion(a.appointments, a.leads);
            const conversionB = calculateConversion(b.appointments, b.leads);
            return sortDirection === "asc" ? conversionA - conversionB : conversionB - conversionA;
          }
          
          if (sortColumn === "visitConversion") {
            const conversionA = calculateConversion(a.visits, a.appointments);
            const conversionB = calculateConversion(b.visits, b.appointments);
            return sortDirection === "asc" ? conversionA - conversionB : conversionB - conversionA;
          }
          
          if (sortColumn === "salesConversion") {
            const conversionA = calculateConversion(a.sales, a.visits);
            const conversionB = calculateConversion(b.visits, b.appointments);
            return sortDirection === "asc" ? conversionA - conversionB : conversionB - conversionA;
          }
          
          // Ordenação padrão para outras colunas
          if (sortDirection === "asc") {
            return a[sortColumn] > b[sortColumn] ? 1 : -1;
          }
          return a[sortColumn] < b[sortColumn] ? 1 : -1;
        })
    : [];

  const renderConversionBadge = (conversion: number) => {
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    
    if (conversion >= 70) variant = "default";
    else if (conversion >= 50) variant = "outline";
    else if (conversion >= 30) variant = "secondary";
    else variant = "destructive";

    return (
      <Badge variant={variant}>
        {conversion}%
      </Badge>
    );
  };

  return (
    <Card className="mb-6 md:mb-8 lg:mb-10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm mobile:text-sm sm:text-base md:text-lg lg:text-lg xl:text-lg 2xl:text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Ranking de Performance
        </CardTitle>
        <CardDescription className="text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-sm">
          Performance dos colaboradores no período selecionado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto max-w-full bg-gradient-to-r from-transparent via-transparent to-blue-50/30">
          <Table className="min-w-[1000px] w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm">#</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("fullName")}
                    className="font-medium text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm"
                  >
                    Nome do Usuário
                    {renderSortIcon("fullName")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("appointments")}
                    className="font-medium text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm"
                  >
                    Agendamentos
                    {renderSortIcon("appointments")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("appointmentConversion")}
                    className="font-medium text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm"
                  >
                    Conversão Agendamento
                    {renderSortIcon("appointmentConversion")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("visits")}
                    className="font-medium text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm"
                  >
                    Visitas
                    {renderSortIcon("visits")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("visitConversion")}
                    className="font-medium text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm"
                  >
                    Conversão Visita
                    {renderSortIcon("visitConversion")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("sales")}
                    className="font-medium text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm"
                  >
                    Vendas
                    {renderSortIcon("sales")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("salesConversion")}
                    className="font-medium text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm"
                  >
                    Conversão Vendas
                    {renderSortIcon("salesConversion")}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[150px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[50px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[60px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[50px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[60px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[50px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-[60px]" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : processedData && processedData.length > 0 ? (
                processedData.map((user: UserMetric, index: number) => (
                  <TableRow key={user.id} className={cn(
                    index < 3 && "bg-muted/20"
                  )}>
                    <TableCell className="font-medium">
                      <div className="flex items-center justify-center">
                        {renderRankIcon(index)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm">{user.username || user.fullName}</span>
                        <Badge
                          variant="outline"
                          className="text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm w-fit"
                        >
                          {user.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm">{user.appointments}</TableCell>
                    <TableCell className="text-center">
                      {renderConversionBadge(calculateConversion(user.appointments, user.leads))}
                    </TableCell>
                    <TableCell className="text-center text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm">{user.visits}</TableCell>
                    <TableCell className="text-center">
                      {renderConversionBadge(calculateConversion(user.visits, user.appointments))}
                    </TableCell>
                    <TableCell className="text-center text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm">{user.sales}</TableCell>
                    <TableCell className="text-center">
                      {renderConversionBadge(calculateConversion(user.sales, user.visits))}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-4 text-xs mobile:text-xs sm:text-xs md:text-sm lg:text-sm">
                    Nenhum dado de performance encontrado para o período selecionado.
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
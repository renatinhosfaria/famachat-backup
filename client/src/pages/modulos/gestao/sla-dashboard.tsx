import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  TrendingUp,
  Activity,
  RefreshCw,
} from "lucide-react";
import { formatTimeAgo, formatDate } from "@/lib/utils";

// Tipos para o dashboard
interface MetricasSLA {
  periodo: {
    inicio: Date;
    fim: Date;
  };
  resumo: {
    totalAtendimentos: number;
    atendimentosFinalizados: number;
    atendimentosExpirados: number;
    atendimentosAtivos: number;
    taxaConversao: number;
    taxaExpiracao: number;
  };
  porUsuario: Record<string, any>;
}

interface AtendimentoAtivo {
  id: number;
  clienteId: number;
  leadId: number;
  userId: number;
  sequencia: number;
  slaHoras: number;
  iniciadoEm: string;
  expiraEm: string;
  userName: string;
  userFullName: string;
  userRole: string;
  clienteNome: string;
  clientePhone: string;
  clienteEmail: string;
  clienteStatus: string;
  tempoRestanteHoras: number;
  statusTempo: 'OK' | 'ALERTA' | 'CRITICO' | 'EXPIRADO';
}

interface RankingUsuario {
  userId: number;
  userName: string;
  userFullName: string;
  userRole: string;
  totalAtendimentos: number;
  finalizadosSucesso: number;
  finalizadosDuplicata: number;
  expirados: number;
  ativos: number;
  taxaConversao: number;
  mediaSequencia: number;
}

// Componente para exibir status de tempo
const StatusTempoBadge: React.FC<{ status: AtendimentoAtivo['statusTempo'] }> = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'OK':
        return { color: 'bg-green-100 text-green-800 border-green-300', icon: CheckCircle2, label: 'OK' };
      case 'ALERTA':
        return { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: Clock, label: 'Alerta' };
      case 'CRITICO':
        return { color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertTriangle, label: 'Crítico' };
      case 'EXPIRADO':
        return { color: 'bg-red-100 text-red-800 border-red-300', icon: AlertTriangle, label: 'Expirado' };
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-300', icon: Clock, label: 'Desconhecido' };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.color} font-medium border flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// Componente principal do Dashboard SLA
const SLADashboardPage: React.FC = () => {
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("30d");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Buscar métricas gerais
  const { data: metricas, isLoading: loadingMetricas, refetch: refetchMetricas } = useQuery<MetricasSLA>({
    queryKey: ["/api/sla-dashboard/metrics", periodoFiltro],
    refetchInterval: autoRefresh ? 30000 : false, // 30 segundos
  });

  // Buscar atendimentos ativos
  const { data: atendimentosAtivos, isLoading: loadingAtivos, refetch: refetchAtivos } = useQuery<{
    atendimentos: AtendimentoAtivo[];
    total: number;
    resumo: {
      total: number;
      expirados: number;
      criticos: number;
      alertas: number;
      ok: number;
    };
  }>({
    queryKey: ["/api/sla-dashboard/active-assignments"],
    refetchInterval: autoRefresh ? 10000 : false, // 10 segundos
  });

  // Buscar ranking de usuários
  const { data: ranking, isLoading: loadingRanking, refetch: refetchRanking } = useQuery<{
    ranking: RankingUsuario[];
    total: number;
  }>({
    queryKey: ["/api/sla-dashboard/user-ranking", periodoFiltro],
    refetchInterval: autoRefresh ? 60000 : false, // 1 minuto
  });

  // Função para refresh manual
  const handleRefresh = () => {
    refetchMetricas();
    refetchAtivos();
    refetchRanking();
  };

  return (
    <div className="container mx-auto py-6">
      <Helmet>
        <title>Dashboard SLA Cascata | FamaChat</title>
      </Helmet>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard SLA Cascata Paralelo</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe a performance do sistema de distribuição automática de leads
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "bg-green-50 border-green-200" : ""}
          >
            <Activity className={`mr-2 h-4 w-4 ${autoRefresh ? "text-green-600" : ""}`} />
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-6 gap-4 sm:gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Atendimentos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? "..." : metricas?.resumo.totalAtendimentos || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              no período selecionado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loadingMetricas ? "..." : `${metricas?.resumo.taxaConversao || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              leads convertidos com sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendimentos Ativos</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {loadingAtivos ? "..." : atendimentosAtivos?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              em andamento agora
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendimentos Críticos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loadingAtivos ? "..." : 
                (atendimentosAtivos?.resumo.criticos || 0) + (atendimentosAtivos?.resumo.expirados || 0)
              }
            </div>
            <p className="text-xs text-muted-foreground">
              precisam de atenção urgente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Atendimentos Ativos */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Atendimentos Ativos em Tempo Real</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAtivos ? (
            <div className="text-center py-8">Carregando atendimentos...</div>
          ) : atendimentosAtivos?.atendimentos.length === 0 ? (
            <div className="text-center py-8">Nenhum atendimento ativo no momento.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Sequência</TableHead>
                    <TableHead>Tempo Restante</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Iniciado Em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atendimentosAtivos?.atendimentos.map((atendimento) => (
                    <TableRow key={atendimento.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{atendimento.clienteNome}</div>
                          <div className="text-sm text-muted-foreground">
                            {atendimento.clientePhone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{atendimento.userFullName}</div>
                          <div className="text-sm text-muted-foreground">
                            {atendimento.userRole}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          Seq. {atendimento.sequencia}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {atendimento.tempoRestanteHoras}h restantes
                        </div>
                        <div className="text-sm text-muted-foreground">
                          de {atendimento.slaHoras}h totais
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusTempoBadge status={atendimento.statusTempo} />
                      </TableCell>
                      <TableCell>
                        {formatDate(atendimento.iniciadoEm, "dd/MM/yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranking de Performance dos Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Performance dos Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRanking ? (
            <div className="text-center py-8">Carregando ranking...</div>
          ) : ranking?.ranking.length === 0 ? (
            <div className="text-center py-8">Nenhum dado de performance disponível.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Posição</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Convertidos</TableHead>
                    <TableHead>Taxa Conversão</TableHead>
                    <TableHead>Média Sequência</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking?.ranking.map((usuario, index) => (
                    <TableRow key={usuario.userId}>
                      <TableCell>
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-bold">
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{usuario.userFullName}</div>
                          <div className="text-sm text-muted-foreground">
                            {usuario.userRole}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{usuario.totalAtendimentos}</TableCell>
                      <TableCell>
                        <span className="text-green-600 font-medium">
                          {usuario.finalizadosSucesso}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            usuario.taxaConversao >= 50 ? "bg-green-100 text-green-800 border-green-300" :
                            usuario.taxaConversao >= 30 ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                            "bg-red-100 text-red-800 border-red-300"
                          }
                        >
                          {usuario.taxaConversao}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {usuario.mediaSequencia.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SLADashboardPage;

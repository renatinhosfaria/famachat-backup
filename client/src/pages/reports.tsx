import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useReportsStore } from "@/hooks/use-reports-store";
import PeriodFilter from "@/components/dashboard/period-filter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reports() {
  const {
    currentReport,
    setCurrentReport,
    currentPeriod,
    setPeriod,
    isLoading,
    setIsLoading,
    reportData,
    setReportData,
  } = useReportsStore();

  // Fetch report data
  const { data, isLoading: isQueryLoading } = useQuery({
    queryKey: [`/api/reports/${currentReport}`, currentPeriod],
    enabled: true,
  });

  // Set report data when it loads
  useEffect(() => {
    setIsLoading(isQueryLoading);
    if (data) {
      setReportData(data);
    }
  }, [data, isQueryLoading]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    setCurrentReport(value as any);
  };

  // Mock report data (would be replaced with API data)

  const mockProductionData = {
    totalClientes: 48,
    totalAppointments: 32,
    totalVisits: 18,
    totalSales: 5,
    byUser: {
      1: {
        userId: 1,
        fullName: "Carlos Rodrigues",
        role: "Corretor",
        clientes: 28,
        appointments: 18,
        visits: 12,
        sales: 3,
        conversionRates: {
          appointmentsToClientes: 64,
          visitsToAppointments: 67,
          salesToVisits: 25,
        },
      },
      2: {
        userId: 2,
        fullName: "Ana Silva",
        role: "Corretor",
        clientes: 20,
        appointments: 14,
        visits: 6,
        sales: 2,
        conversionRates: {
          appointmentsToClientes: 70,
          visitsToAppointments: 43,
          salesToVisits: 33,
        },
      },
    },
  };

  // Função para retornar a cor de acordo com o status
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Novo":
        return "bg-blue-100 text-blue-800";
      case "Agendamento concluído":
        return "bg-green-100 text-green-800";
      case "Aguardando contato":
        return "bg-yellow-100 text-yellow-800";
      case "Visita agendada":
        return "bg-blue-100 text-blue-800";
      case "Proposta":
        return "bg-purple-100 text-purple-800";
      case "Venda":
        return "bg-green-100 text-green-800";
      case "Perdido":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <PeriodFilter currentPeriod={currentPeriod} onChange={setPeriod} />
      
      <Card className="p-5 mb-6">
        <Tabs value={currentReport} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="production">Produção</TabsTrigger>
            <TabsTrigger value="appointments">Agendamentos</TabsTrigger>
            <TabsTrigger value="visits">Visitas</TabsTrigger>
            <TabsTrigger value="sales">Vendas</TabsTrigger>
          </TabsList>



          <TabsContent value="clientes">
            <h3 className="text-xl font-medium text-dark mb-4">Relatório de Clientes</h3>
            {reportData && (
              <div className="space-y-6">
                <Card className="p-4">
                  <h4 className="text-md font-medium mb-4">Total de Clientes: {reportData.total || 0}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
                    {Object.entries(reportData.byStatus || {}).map(([status, count]: [string, any]) => (
                      <div key={status} className={`p-4 rounded-lg ${getStatusBadgeClass(status)} bg-opacity-20`}>
                        <p className="text-sm text-muted-foreground">{status}</p>
                        <p className="text-2xl font-bold">{count}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {reportData.clientes && reportData.clientes.length > 0 && (
                  <Card className="p-4">
                    <h4 className="text-md font-medium mb-4">Lista de Clientes</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data de Cadastro</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.clientes.map((cliente: any) => (
                          <TableRow key={cliente.id}>
                            <TableCell className="font-medium">{cliente.name}</TableCell>
                            <TableCell>{cliente.phone}</TableCell>
                            <TableCell>
                              <Badge className={getStatusBadgeClass(cliente.status)}>
                                {cliente.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(cliente.createdAt).toLocaleDateString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </div>
            )}
            {!reportData && (
              <div className="p-6 text-center">
                <p className="text-gray-500">Selecione um período para visualizar os dados de clientes.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="production">
            <h3 className="text-xl font-medium text-dark mb-4">Relatório de Produção</h3>
            <div className="space-y-6">
              <Card className="p-4">
                <h4 className="text-md font-medium mb-4">Resumo Geral</h4>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-4 mb-4">
                  <div className="bg-primary/10 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total de Clientes</p>
                    <p className="text-2xl font-bold">{mockProductionData.totalClientes}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Agendamentos</p>
                    <p className="text-2xl font-bold">{mockProductionData.totalAppointments}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Visitas</p>
                    <p className="text-2xl font-bold">{mockProductionData.totalVisits}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Vendas</p>
                    <p className="text-2xl font-bold">{mockProductionData.totalSales}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="text-md font-medium mb-4">Produção por Corretor</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Corretor</TableHead>
                      <TableHead className="text-center">Clientes</TableHead>
                      <TableHead className="text-center">Agendamentos</TableHead>
                      <TableHead className="text-center">Visitas</TableHead>
                      <TableHead className="text-center">Vendas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(mockProductionData.byUser).map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell className="text-center">{user.clientes}</TableCell>
                        <TableCell className="text-center">{user.appointments}</TableCell>
                        <TableCell className="text-center">{user.visits}</TableCell>
                        <TableCell className="text-center">{user.sales}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              <Card className="p-4">
                <h4 className="text-md font-medium mb-4">Taxas de Conversão</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Corretor</TableHead>
                      <TableHead className="text-center">Agendamentos/Clientes</TableHead>
                      <TableHead className="text-center">Visitas/Agendamentos</TableHead>
                      <TableHead className="text-center">Vendas/Visitas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(mockProductionData.byUser).map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell className="text-center">{user.conversionRates.appointmentsToClientes}%</TableCell>
                        <TableCell className="text-center">{user.conversionRates.visitsToAppointments}%</TableCell>
                        <TableCell className="text-center">{user.conversionRates.salesToVisits}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="appointments">
            <h3 className="text-xl font-medium text-dark mb-4">Relatório de Agendamentos</h3>
            <div className="p-6 text-center">
              <p className="text-gray-500">Selecione um período para visualizar os dados de agendamentos.</p>
            </div>
          </TabsContent>

          <TabsContent value="visits">
            <h3 className="text-xl font-medium text-dark mb-4">Relatório de Visitas</h3>
            <div className="p-6 text-center">
              <p className="text-gray-500">Selecione um período para visualizar os dados de visitas.</p>
            </div>
          </TabsContent>

          <TabsContent value="sales">
            <h3 className="text-xl font-medium text-dark mb-4">Relatório de Vendas</h3>
            <div className="p-6 text-center">
              <p className="text-gray-500">Selecione um período para visualizar os dados de vendas.</p>
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </>
  );
}

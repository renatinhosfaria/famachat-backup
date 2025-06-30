import { DashboardMetrics } from "@/hooks/use-dashboard-store";
import MetricCard from "@/components/dashboard/metric-card";

type MetricsGridProps = {
  metrics: DashboardMetrics;
};

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  // Calcular percentuais e diferenças para os cards
  const leadsPercent = Math.round(
    ((metrics.newClientes - metrics.teamAverages.newClientes) / metrics.teamAverages.newClientes) * 100
  );
  const appointmentsPercent = Math.round(
    ((metrics.appointments - metrics.teamAverages.appointments) / metrics.teamAverages.appointments) * 100
  );
  const visitsPercent = Math.round(
    ((metrics.visits - metrics.teamAverages.visits) / metrics.teamAverages.visits) * 100
  );
  const salesPercent = Math.round(
    ((metrics.sales - metrics.teamAverages.sales) / metrics.teamAverages.sales) * 100
  );

  return (
    <div className="grid grid-cols-1 tablet:grid-cols-2 desktop:grid-cols-4 wide:grid-cols-4 gap-4 tablet:gap-5 desktop:gap-4 wide:gap-4 mb-6 tablet:mb-8 desktop:mb-6 wide:mb-6">
      {/* Primeira coluna, primeira linha */}
      <MetricCard
        title="Novos Clientes"
        value={metrics.newClientes}
        unit="clientes"
        trend={leadsPercent >= 0 ? "up" : "down"}
        percent={Math.abs(leadsPercent)}
        teamAverage={metrics.teamAverages.newClientes}
        difference={metrics.newClientes - metrics.teamAverages.newClientes}
      />
      
      {/* Segunda coluna, primeira linha */}
      <MetricCard
        title="Agendamentos"
        value={metrics.appointments}
        unit="agendamentos"
        trend={appointmentsPercent >= 0 ? "up" : "down"}
        percent={Math.abs(appointmentsPercent)}
        teamAverage={metrics.teamAverages.appointments}
        difference={metrics.appointments - metrics.teamAverages.appointments}
      />
      
      {/* Primeira coluna, segunda linha */}
      <MetricCard
        title="Visitas"
        value={metrics.visits}
        unit="visitas"
        trend={visitsPercent >= 0 ? "up" : "down"}
        percent={Math.abs(visitsPercent)}
        teamAverage={metrics.teamAverages.visits}
        difference={metrics.visits - metrics.teamAverages.visits}
      />
      
      {/* Segunda coluna, segunda linha */}
      <MetricCard
        title="Vendas"
        value={metrics.sales}
        unit="vendas"
        trend={salesPercent >= 0 ? "up" : "down"}
        percent={Math.abs(salesPercent)}
        teamAverage={metrics.teamAverages.sales}
        difference={metrics.sales - metrics.teamAverages.sales}
      />
    </div>
  );
}
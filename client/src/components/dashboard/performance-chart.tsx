import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type PerformanceChartProps = {
  monthlyConversionRates: {
    appointmentsToClientes: number[];
    visitsToAppointments: number[];
    salesToVisits: number[];
  };
};

export default function PerformanceChart({ monthlyConversionRates }: PerformanceChartProps) {
  // Meses do ano em português
  const months = [
    "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", 
    "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
  ];
  
  // Obter o mês atual (0-11)
  const currentMonth = new Date().getMonth();
  
  // Preparar dados para o gráfico (apenas até o mês atual)
  const chartData = months.slice(0, currentMonth + 1).map((month, index) => {
    return {
      name: month,
      "Conversão Agendamentos": monthlyConversionRates.appointmentsToClientes[index] || 0,
      "Conversão Visitas": monthlyConversionRates.visitsToAppointments[index] || 0,
      "Conversão Vendas": monthlyConversionRates.salesToVisits[index] || 0,
    };
  });

  return (
    <Card className="col-span-1">
      <CardHeader className="p-3 xxs:p-6">
        <CardTitle className="text-sm xxs:text-lg lg:text-lg xl:text-lg 2xl:text-lg">Performance</CardTitle>
        <CardDescription className="text-xs xxs:text-sm lg:text-sm xl:text-sm 2xl:text-sm">
          Evolução das taxas de conversão ao longo do ano
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 xxs:p-6">
        <div className="h-[200px] xxs:h-[300px] lg:h-[400px] xl:h-[450px] 2xl:h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 15, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => [`${value}%`, ""]} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Line
                type="monotone"
                dataKey="Conversão Agendamentos"
                stroke="#8884d8"
                strokeWidth={1.5}
                activeDot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="Conversão Visitas" 
                stroke="#82ca9d" 
                strokeWidth={1.5}
                activeDot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="Conversão Vendas" 
                stroke="#ff7300" 
                strokeWidth={1.5}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
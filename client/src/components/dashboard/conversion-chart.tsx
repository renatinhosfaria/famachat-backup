import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ConversionChartProps = {
  data: {
    appointmentsToClientes: number;
    visitsToAppointments: number;
    salesToVisits: number;
  };
};

export default function ConversionChart({ data }: ConversionChartProps) {
  const chartData = [
    {
      name: "Clientes → Agendamentos",
      value: data.appointmentsToClientes,
      fill: "#38bdf8",
    },
    {
      name: "Agendamentos → Visitas",
      value: data.visitsToAppointments,
      fill: "#4ade80",
    },
    {
      name: "Visitas → Vendas",
      value: data.salesToVisits,
      fill: "#f43f5e",
    },
  ];

  return (
    <Card className="col-span-1">
      <CardHeader className="p-3 xxs:p-6">
        <CardTitle className="text-sm xxs:text-lg lg:text-lg xl:text-lg 2xl:text-lg">Taxas de Conversão</CardTitle>
        <CardDescription className="text-xs xxs:text-sm lg:text-sm xl:text-sm 2xl:text-sm">
          Percentual de conversão entre cada etapa do funil
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 xxs:p-6">
        <div className="h-[200px] xxs:h-[300px] lg:h-[400px] xl:h-[450px] 2xl:h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={100}
                tick={{ fontSize: 9 }}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, "Taxa de Conversão"]}
                cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
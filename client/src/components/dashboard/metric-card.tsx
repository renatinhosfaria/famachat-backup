import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

type MetricCardProps = {
  title: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "neutral";
  percent: number;
  teamAverage: number;
  difference: number;
};

export default function MetricCard({
  title,
  value,
  unit,
  trend,
  percent,
  teamAverage,
  difference,
}: MetricCardProps) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 md:pb-3 lg:pb-2 xl:pb-2 2xl:pb-3">
        <CardTitle className="text-xs mobile:text-xs sm:text-sm md:text-base lg:text-base xl:text-base 2xl:text-base font-medium truncate pr-2">
          {title}
        </CardTitle>
        {trend === "up" && (
          <ArrowUpRight className="h-4 w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4 2xl:h-4 2xl:w-4 text-emerald-500 flex-shrink-0" />
        )}
        {trend === "down" && (
          <ArrowDownRight className="h-4 w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4 2xl:h-4 2xl:w-4 text-rose-500 flex-shrink-0" />
        )}
        {trend === "neutral" && (
          <Minus className="h-4 w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4 2xl:h-4 2xl:w-4 text-gray-500 flex-shrink-0" />
        )}
      </CardHeader>
      <CardContent className="p-3 md:p-3 lg:p-3 xl:p-3 2xl:p-4 pt-0">
        <div className="text-lg mobile:text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-2xl 2xl:text-2xl font-bold text-foreground mb-1 lg:mb-1 xl:mb-1 2xl:mb-2">
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
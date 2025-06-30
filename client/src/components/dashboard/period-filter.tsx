import { periods, PeriodType } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type PeriodFilterProps = {
  currentPeriod: PeriodType;
  onChange: (period: PeriodType) => void;
};

export default function PeriodFilter({ currentPeriod, onChange }: PeriodFilterProps) {
  return (
    <div className="w-full">
      {/* Layout responsivo: grid em telas pequenas, flex em telas maiores */}
      <div className="grid grid-cols-2 gap-1 xxs:grid-cols-3 xxs:gap-2 md:flex md:flex-wrap md:gap-2">
        {periods.map((period) => (
          <Button
            key={period.value}
            variant={currentPeriod === period.value ? "default" : "outline"}
            size="sm"
            onClick={() => onChange(period.value as PeriodType)}
            className="w-full text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-base md:w-auto"
          >
            {period.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
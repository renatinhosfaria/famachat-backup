import { Appointment } from "@/hooks/use-dashboard-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type UpcomingAppointmentsProps = {
  appointments: Appointment[];
};

export default function UpcomingAppointments({ appointments }: UpcomingAppointmentsProps) {
  // Se não houver agendamentos, não exiba nada
  if (!appointments.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3 xxs:pb-4">
        <CardTitle className="text-base md:text-lg lg:text-lg xl:text-lg 2xl:text-lg">Próximos Agendamentos</CardTitle>
        <CardDescription className="text-xs md:text-sm lg:text-sm xl:text-sm 2xl:text-sm">
          Agendamentos previstos para os próximos dias
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 xxs:pt-2">
        <div className="space-y-2 xxs:space-y-3">
          {appointments.map((appointment) => (
            <div
              key={appointment.id}
              className="flex flex-col xxs:flex-row items-start xxs:items-center gap-2 xxs:gap-3 sm:gap-4 p-2 xxs:p-3 sm:p-4 border rounded-md"
            >
              <div className="flex-shrink-0 bg-primary/10 text-primary font-semibold py-1 xxs:py-2 px-2 xxs:px-3 rounded-md text-center min-w-[48px] xxs:min-w-[60px]">
                <div className="text-xs md:text-sm lg:text-xs font-normal">{appointment.monthAbbr}</div>
                <div className="text-sm md:text-lg lg:text-base xl:text-base 2xl:text-lg">{appointment.day}</div>
              </div>
              
              <div className="flex-grow">
                <h4 className="font-medium text-sm md:text-base lg:text-sm xl:text-sm 2xl:text-base">{appointment.title}</h4>
                <div className="flex flex-col xxs:flex-row xxs:space-x-4 text-xs md:text-sm lg:text-xs xl:text-xs 2xl:text-sm text-muted-foreground mt-1">
                  <div>{appointment.time}</div>
                  <div className="xxs:hidden sm:block">{appointment.clientName}</div>
                  <div className="truncate">{appointment.location}</div>
                </div>
                {appointment.address && (
                  <div className="text-xs md:text-sm lg:text-xs xl:text-xs 2xl:text-sm text-muted-foreground mt-1 hidden xxs:block">
                    <span className="font-medium">Endereço:</span> {appointment.address}
                  </div>
                )}
                {appointment.brokerName && (
                  <div className="text-xs md:text-sm lg:text-xs xl:text-xs 2xl:text-sm text-muted-foreground mt-1 hidden xxs:block">
                    <span className="font-medium">Corretor:</span> {appointment.brokerName}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
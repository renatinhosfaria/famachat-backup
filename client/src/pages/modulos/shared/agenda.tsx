import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, startOfWeek, endOfWeek, isWithinInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

// Mock appointments data
const mockAppointments = [
  {
    id: 1,
    title: "Visita - Apartamento Jardins",
    date: new Date(2023, 4, 15, 10, 30),
    endTime: new Date(2023, 4, 15, 11, 30),
    client: "Marcos Costa",
    location: "Condomínio Reserva Jardins",
    address: "Av. Brasil, 1500, Apto 302, Jardins, São Paulo/SP",
    type: "Visita",
    broker: "Humberto Santos",
  },
  {
    id: 2,
    title: "Reunião - Proposta de Venda",
    date: new Date(2023, 4, 16, 14, 0),
    endTime: new Date(2023, 4, 16, 15, 0),
    client: "Ricardo Almeida",
    location: "Escritório FamaChat",
    address: "Rua Coronel Melo Oliveira, 745, Perdizes, São Paulo/SP",
    type: "Reunião",
    broker: "Michel Silva",
  },
  {
    id: 3,
    title: "Visita - Casa Vila Verde",
    date: new Date(2023, 4, 17, 9, 0),
    endTime: new Date(2023, 4, 17, 10, 30),
    client: "Luciana Silva",
    location: "Condomínio Villagio Verde",
    address: "Rua das Palmeiras, 230, Casa 15, Vila Verde, São Paulo/SP",
    type: "Visita",
    broker: "Humberto Santos",
  },
  {
    id: 4,
    title: "Ligação - Acompanhamento",
    date: new Date(2023, 4, 18, 11, 0),
    endTime: new Date(2023, 4, 18, 11, 30),
    client: "João Pereira",
    location: "Telefone",
    type: "Ligação",
  },
  {
    id: 5,
    title: "Visita - Apartamento Centro",
    date: new Date(2023, 4, 19, 15, 0),
    endTime: new Date(2023, 4, 19, 16, 0),
    client: "Amanda Costa",
    location: "Edifício Central Park",
    address: "Rua XV de Novembro, 500, Apto 1202, Centro, São Paulo/SP",
    type: "Visita",
    broker: "Michel Silva",
  },
];

// Time slots for the weekly view
const timeSlots = Array.from({ length: 12 }, (_, i) => i + 8); // 8AM to 7PM

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [view, setView] = useState<"week" | "month">("week");
  
  // Calculate the current week's start and end
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Start on Monday
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  
  // Generate the days of the week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  
  // Filter appointments for the selected week
  const weekAppointments = mockAppointments.filter((appointment) =>
    isWithinInterval(appointment.date, {
      start: weekStart,
      end: weekEnd,
    })
  );
  
  // Previous week
  const goToPreviousWeek = () => {
    setSelectedDate(addDays(selectedDate, -7));
  };
  
  // Next week
  const goToNextWeek = () => {
    setSelectedDate(addDays(selectedDate, 7));
  };
  
  // Format date for the week header
  const formatWeekHeader = () => {
    const start = format(weekStart, "d 'de' MMMM", { locale: ptBR });
    const end = format(weekEnd, "d 'de' MMMM", { locale: ptBR });
    return `${start} - ${end}`;
  };

  return (
    <div className="space-y-3 xxs:space-y-4 xs:space-y-5 sm:space-y-6 p-2 xxs:p-3 xs:p-4">
      <Card className="p-2 xxs:p-3 xs:p-4 sm:p-6">
        <div className="flex flex-col space-y-2 xxs:space-y-3 xs:space-y-3 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
          <div className="mb-0 sm:mb-0">
            <h2 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-semibold text-dark">Agenda</h2>
          </div>
          
          <div className="flex flex-col space-y-2 xxs:space-y-2 xs:flex-row xs:space-y-0 xs:space-x-2 xs:items-center">
            <div className="flex items-center justify-center xs:justify-start space-x-1 xxs:space-x-1.5 xs:space-x-2 bg-gray-50 rounded-lg p-1 xxs:p-1.5 xs:p-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousWeek}
                className="p-1 xxs:p-1.5 xs:p-2 h-7 xxs:h-8 xs:h-9 w-7 xxs:w-8 xs:w-9"
              >
                <ChevronLeft className="h-3 w-3 xxs:h-3.5 xxs:w-3.5 xs:h-4 xs:w-4" />
              </Button>
              
              <div className="text-xs xxs:text-xs xs:text-sm font-medium text-center min-w-0 px-1 xxs:px-1.5 xs:px-2 whitespace-nowrap">
                {formatWeekHeader()}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextWeek}
                className="p-1 xxs:p-1.5 xs:p-2 h-7 xxs:h-8 xs:h-9 w-7 xxs:w-8 xs:w-9"
              >
                <ChevronRight className="h-3 w-3 xxs:h-3.5 xxs:w-3.5 xs:h-4 xs:w-4" />
              </Button>
            </div>
            
            <div className="flex justify-center xs:justify-start space-x-1 xxs:space-x-1.5 xs:space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs xxs:text-xs xs:text-sm px-2 xxs:px-2.5 xs:px-3 py-1 xxs:py-1.5 xs:py-2 h-7 xxs:h-8 xs:h-9"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoje
              </Button>
              
              <div className="flex bg-gray-100 rounded-lg p-0.5 xxs:p-1">
                <Button
                  variant={view === "week" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs xxs:text-xs xs:text-sm px-2 xxs:px-2.5 xs:px-3 py-1 xxs:py-1.5 xs:py-2 h-6 xxs:h-7 xs:h-8 rounded-md"
                  onClick={() => setView("week")}
                >
                  Semana
                </Button>
                <Button
                  variant={view === "month" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs xxs:text-xs xs:text-sm px-2 xxs:px-2.5 xs:px-3 py-1 xxs:py-1.5 xs:py-2 h-6 xxs:h-7 xs:h-8 rounded-md"
                  onClick={() => setView("month")}
                >
                  Mês
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      {view === "week" ? (
        <Card className="overflow-hidden">
          {/* Week view header */}
          <div className="grid grid-cols-8 border-b bg-gray-50">
            <div className="p-1 xxs:p-1.5 xs:p-2 sm:p-3 text-center font-medium text-gray-500 border-r text-xs xxs:text-xs xs:text-sm"></div>
            {weekDays.map((day, i) => (
              <div
                key={i}
                className={`p-1 xxs:p-1.5 xs:p-2 sm:p-3 text-center ${
                  isSameDay(day, new Date()) ? "bg-primary text-white" : ""
                }`}
              >
                <div className="text-xs xxs:text-xs xs:text-sm font-medium">
                  {format(day, "EEE", { locale: ptBR })}
                </div>
                <div className="text-xs xxs:text-sm xs:text-base font-medium">{format(day, "dd")}</div>
              </div>
            ))}
          </div>
          
          {/* Time slots */}
          <div className="relative bg-white">
            {timeSlots.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b hover:bg-gray-50/50">
                <div className="p-1 xxs:p-1.5 xs:p-2 sm:p-3 text-xs xxs:text-xs xs:text-sm text-center text-gray-500 border-r font-medium bg-gray-50/30">
                  {hour}:00
                </div>
                {weekDays.map((day, dayIndex) => {
                  // Find appointments for this time slot and day
                  const slotAppointments = weekAppointments.filter((appointment) => {
                    const appointmentHour = appointment.date.getHours();
                    return (
                      isSameDay(appointment.date, day) && appointmentHour === hour
                    );
                  });
                  
                  return (
                    <div
                      key={dayIndex}
                      className="p-0.5 xxs:p-1 xs:p-1.5 min-h-[40px] xxs:min-h-[45px] xs:min-h-[55px] sm:min-h-[65px] border-r relative"
                    >
                      {slotAppointments.map((appointment) => (
                        <div
                          key={appointment.id}
                          className="absolute bg-primary text-white rounded p-0.5 xxs:p-1 xs:p-1.5 text-xs xxs:text-xs xs:text-sm shadow-sm"
                          style={{
                            top: `${(appointment.date.getMinutes() / 60) * 100}%`,
                            height: `${
                              ((appointment.endTime.getTime() - appointment.date.getTime()) /
                                (1000 * 60 * 60)) *
                              100
                            }%`,
                            left: "3%",
                            right: "3%",
                            overflow: "hidden",
                          }}
                        >
                          <div className="font-medium leading-tight truncate">{appointment.title}</div>
                          <div className="leading-tight text-xs xxs:text-xs xs:text-sm opacity-90">
                            {format(appointment.date, "HH:mm")} -{" "}
                            {format(appointment.endTime, "HH:mm")}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="p-3 xxs:p-4 xs:p-5 sm:p-6">
          <div className="w-full max-w-full overflow-hidden">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full mx-auto [&_table]:w-full [&_td]:p-1 [&_td]:xxs:p-1.5 [&_td]:xs:p-2 [&_th]:p-1 [&_th]:xxs:p-1.5 [&_th]:xs:p-2 [&_th]:text-xs [&_th]:xxs:text-xs [&_th]:xs:text-sm [&_td]:text-xs [&_td]:xxs:text-xs [&_td]:xs:text-sm [&_button]:h-7 [&_button]:xxs:h-8 [&_button]:xs:h-9 [&_button]:w-7 [&_button]:xxs:w-8 [&_button]:xs:w-9 [&_button]:text-xs [&_button]:xxs:text-xs [&_button]:xs:text-sm"
              locale={ptBR}
              modifiers={{
                appointment: weekAppointments.map((apt) => apt.date),
              }}
              modifiersStyles={{
                appointment: {
                  backgroundColor: "#0099CC",
                  color: "white",
                  fontWeight: "bold",
                },
              }}
            />
          </div>
          
          <div className="mt-3 xxs:mt-4 xs:mt-5 sm:mt-6">
            <h3 className="text-sm xxs:text-base xs:text-lg sm:text-xl font-medium mb-2 xxs:mb-3 xs:mb-4">
              Agendamentos em {format(selectedDate, "dd/MM/yyyy")}
            </h3>
            <div className="space-y-2 xxs:space-y-3 xs:space-y-4">
              {mockAppointments
                .filter((apt) => isSameDay(apt.date, selectedDate))
                .map((appointment) => (
                  <Card key={appointment.id} className="p-2 xxs:p-3 xs:p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start space-x-2 xxs:space-x-3 xs:space-x-4">
                      <div className="bg-primary text-white p-1.5 xxs:p-2 xs:p-2.5 rounded-md text-center min-w-[40px] xxs:min-w-[50px] xs:min-w-[60px] sm:min-w-[65px] flex-shrink-0">
                        <div className="text-xs xxs:text-xs xs:text-sm font-medium">{format(appointment.date, "HH:mm")}</div>
                        <div className="text-xs xxs:text-xs xs:text-sm opacity-90">{format(appointment.endTime, "HH:mm")}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-xs xxs:text-sm xs:text-base sm:text-lg mb-1 xxs:mb-1.5">{appointment.title}</h4>
                        <div className="space-y-0.5 xxs:space-y-1">
                          <p className="text-xs xxs:text-xs xs:text-sm text-gray-600">
                            <span className="font-medium">Cliente:</span> {appointment.client}
                          </p>
                          <p className="text-xs xxs:text-xs xs:text-sm text-gray-600">
                            <span className="font-medium">Local:</span> {appointment.location}
                          </p>
                          {appointment.address && (
                            <p className="text-xs xxs:text-xs xs:text-sm text-gray-600 break-words">
                              <span className="font-medium">Endereço:</span> {appointment.address}
                            </p>
                          )}
                          {appointment.broker && (
                            <p className="text-xs xxs:text-xs xs:text-sm text-gray-600">
                              <span className="font-medium">Corretor:</span> {appointment.broker}
                            </p>
                          )}
                        </div>
                        <span className="inline-block mt-1.5 xxs:mt-2 px-2 xxs:px-2.5 xs:px-3 py-0.5 xxs:py-1 bg-gray-100 text-gray-800 text-xs xxs:text-xs xs:text-sm rounded-full font-medium">
                          {appointment.type}
                        </span>
                      </div>
                    </div>
                  </Card>
                ))}
              
              {mockAppointments.filter((apt) => isSameDay(apt.date, selectedDate)).length === 0 && (
                <div className="text-center py-6 xxs:py-8 xs:py-10 sm:py-12 text-gray-500 text-xs xxs:text-sm xs:text-base sm:text-lg">
                  <div className="bg-gray-50 rounded-lg p-4 xxs:p-5 xs:p-6">
                    <p className="font-medium mb-1">Nenhum agendamento para esta data</p>
                    <p className="text-xs xxs:text-xs xs:text-sm opacity-75">Selecione outra data para ver os agendamentos</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

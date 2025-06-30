import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Appointment } from "@shared/schema";
import { formatDateBrasil, BRASIL_TIMEZONE_OFFSET } from "./date-utils";

// Tipo estendido para o objeto de agendamento com campos formatados
export type FormattedAppointment = Appointment & {
  monthAbbr: string;
  day: string;
  time: string;
  title: string;
  date: Date; // Data formatada para exibição
  createdDateFormatted: string; // Data de criação formatada
};

// Expande o objeto de agendamento com propriedades formatadas para exibição
export function formatAppointment(appointment: Appointment): FormattedAppointment {
  try {
    // Usar a string ISO diretamente para criar a data
    // O banco de dados já retorna as datas ajustadas para o fuso horário America/Sao_Paulo
    const scheduledDate = appointment.scheduledAt ? new Date(appointment.scheduledAt) : new Date();
    
    // Como o PostgreSQL já está retornando as datas com o ajuste de fuso horário,
    // não precisamos fazer nenhuma conversão adicional aqui.
    // Vamos usar as horas e minutos locais diretamente:
    const hours = scheduledDate.getHours();
    const minutes = scheduledDate.getMinutes();
    
    // Formatar para exibição usando nossos utilitários que lidam com o fuso horário
    const monthAbbr = format(scheduledDate, "MMM", { locale: ptBR });
    const day = format(scheduledDate, "dd", { locale: ptBR });
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    // Gerar título baseado no tipo de agendamento se não existir
    const title = appointment.type || "Agendamento";
    
    // Formatar a data de criação
    // O banco de dados já retorna as datas ajustadas para o fuso horário do Brasil
    const createdDate = appointment.createdAt ? new Date(appointment.createdAt) : new Date();
    
    // Formatar diretamente sem conversão adicional
    const createdDateFormatted = format(createdDate, "dd/MM/yyyy HH:mm", { locale: ptBR });
    
    return {
      ...appointment,
      monthAbbr,
      day,
      time,
      title,
      date: scheduledDate,
      createdDateFormatted
    };
  } catch (error) {
    
    const now = new Date();
    return {
      ...appointment,
      monthAbbr: "---",
      day: "--",
      time: "--:--",
      title: appointment.type || "Agendamento",
      date: now,
      createdDateFormatted: "Não disponível"
    };
  }
}

// Formata uma lista de agendamentos
export function formatAppointments(appointments: Appointment[]): FormattedAppointment[] {
  return appointments.map(formatAppointment);
}
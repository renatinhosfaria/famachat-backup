import {
  startOfDay, endOfDay, 
  startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, 
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  subMonths, subYears,
  subQuarters, startOfHalf,
  endOfHalf, getQuarter
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Função auxiliar para obter o intervalo de datas com base no período
export function getDateRangeFromPeriod(period: string): { startDate: Date, endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = endOfDay(now);

  switch (period) {
    case 'today':
      startDate = startOfDay(now);
      break;
    case 'week':
      startDate = startOfWeek(now, { locale: ptBR, weekStartsOn: 0 });
      break;
    case 'month':
      startDate = startOfMonth(now);
      break;
    case 'lastMonth':
      const lastMonth = subMonths(now, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
      break;
    case 'quarter':
      startDate = startOfQuarter(now);
      break;
    case 'half':
      // Primeiro ou segundo semestre
      const currentMonth = now.getMonth() + 1;
      if (currentMonth <= 6) {
        // Primeiro semestre (1-6)
        startDate = new Date(now.getFullYear(), 0, 1); // 1º de janeiro
        endDate = new Date(now.getFullYear(), 5, 30); // 30 de junho
      } else {
        // Segundo semestre (7-12)
        startDate = new Date(now.getFullYear(), 6, 1); // 1º de julho
        endDate = new Date(now.getFullYear(), 11, 31); // 31 de dezembro
      }
      break;
    case 'year':
      startDate = startOfYear(now);
      break;
    case 'lastYear':
      const lastYear = subYears(now, 1);
      startDate = startOfYear(lastYear);
      endDate = endOfYear(lastYear);
      break;
    default:
      // Padrão: últimos 7 dias
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate = startOfDay(startDate);
  }

  return { startDate, endDate };
}

// Função para obter total de dias entre duas datas
export function getDaysBetweenDates(startDate: Date, endDate: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const timeDifference = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(timeDifference / millisecondsPerDay);
}

// Função para formatar data em formato brasileiro (DD/MM/YYYY)
export function formatDateBR(date: Date): string {
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
}

// Função para formatar data em formato ISO (YYYY-MM-DD)
export function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}
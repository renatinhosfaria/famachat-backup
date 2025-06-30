import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date, formatString: string = "PPP"): string {
  try {
    const date = typeof dateString === "string" ? parseISO(dateString) : dateString;
    return format(date, formatString, { locale: ptBR });
  } catch (error) {
    
    return "Data inválida";
  }
}

export function formatDateShort(dateString: string | Date): string {
  try {
    // Tratamento especial para ajustar o problema de fuso horário com datas do banco
    if (typeof dateString === "string") {
      // Extrair apenas a parte da data (ignorando a hora) e converter para YYYY-MM-DD
      const parts = dateString.split('T')[0].split('-');
      if (parts.length === 3) {
        // Criar nova data usando apenas o componente de data para evitar ajustes de timezone
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Meses em JS são 0-11
        const day = parseInt(parts[2]);
        return format(new Date(year, month, day), "dd/MM/yyyy", { locale: ptBR });
      }
    }
    
    // Se não for string ou não tiver o formato esperado, usa o método normal
    return formatDate(dateString, "dd/MM/yyyy");
  } catch (error) {
    
    return formatDate(dateString, "dd/MM/yyyy");
  }
}

export function formatDateTime(dateString: string | Date): string {
  return formatDate(dateString, "dd/MM/yyyy HH:mm");
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100); // Assuming value is in cents
}

export function getInitials(name: string): string {
  if (!name) return "";
  
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getStatusColor(status: string): {
  bg: string;
  text: string;
} {
  switch (status) {
    case "Novo":
      return { bg: "bg-blue-100", text: "text-blue-800" };
    case "Agendamento concluído":
      return { bg: "bg-green-100", text: "text-green-800" };
    case "Aguardando contato":
      return { bg: "bg-yellow-100", text: "text-yellow-800" };
    case "Visita agendada":
      return { bg: "bg-blue-100", text: "text-blue-800" };
    case "Proposta":
      return { bg: "bg-purple-100", text: "text-purple-800" };
    case "Venda":
      return { bg: "bg-green-100", text: "text-green-800" };
    case "Perdido":
      return { bg: "bg-red-100", text: "text-red-800" };
    default:
      return { bg: "bg-gray-100", text: "text-gray-800" };
  }
}

export const periods = [
  { label: "Hoje", value: "today" },
  { label: "Ontem", value: "yesterday" },
  { label: "7 dias", value: "7days" },
  { label: "Mês Passado", value: "last_month" },
  { label: "Mês", value: "month" },
  { label: "Trimestre", value: "quarter" },
  { label: "Semestre", value: "semester" },
  { label: "Ano", value: "year" },
];

export type PeriodType = "today" | "yesterday" | "7days" | "last_month" | "month" | "quarter" | "semester" | "year";

/**
 * Normaliza um nome para ser usado como nome de instância do WhatsApp
 * Remove acentos, converte para minúsculas e remove caracteres especiais
 */
export function normalizeInstanceName(fullName: string): string {
  if (!fullName) return "";
  
  // Pega apenas o primeiro nome
  const firstName = fullName.split(' ')[0];
  
  // Normalização para remover acentos
  return firstName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .toLowerCase() // Converte para minúsculas
    .replace(/[^a-z0-9_]/g, ''); // Remove caracteres especiais exceto letras, números e sublinhados
}

/**
 * Aplica máscara de telefone no padrão brasileiro: (99) 99999-9999 ou (99) 9999-9999
 * @param value Número de telefone para formatar
 * @returns Número formatado com a máscara aplicada
 */
export function formatPhoneNumber(value: string): string {
  if (!value) return "";
  
  // Remove todos os caracteres não numéricos
  const phoneNumber = value.replace(/\D/g, "");
  
  // Aplica a formatação apropriada com base no comprimento do número
  if (phoneNumber.length <= 10) {
    // Formato para telefone fixo: (99) 9999-9999
    return phoneNumber
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    // Formato para celular: (99) 99999-9999
    return phoneNumber
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2");
  }
}

/**
 * Formata uma data para exibir o tempo decorrido desde então (ex: "há 3 horas", "há 2 dias")
 * @param dateString String de data ou objeto Date
 * @returns String formatada com o tempo decorrido
 */
export function formatTimeAgo(dateString: string | Date): string {
  if (!dateString) return "";
  
  try {
    const date = typeof dateString === "string" ? parseISO(dateString) : dateString;
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: ptBR
    });
  } catch (error) {
    return "Data inválida";
  }
}

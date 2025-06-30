// Utilitários para manipulação de datas
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Converte uma data UTC do banco de dados para os campos de formulário (data e hora)
 * @param utcDate String de data ISO 8601 ou objeto Date
 * @returns Objeto com propriedades date (Date) e time (string "HH:MM")
 */
export function utcToFormFields(utcDate: Date | string | null) {
  if (!utcDate) {
    return { date: new Date(), time: "09:00" };
  }

  // Extrair data e hora diretamente da string ISO sem conversão de timezone
  const match = utcDate.toString().match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (match) {
    const [_, year, month, day, hours, minutes] = match;
    // Criar data usando os componentes extraídos, mantendo o horário exato
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return {
      date,
      time: `${hours}:${minutes}` // Mantém o horário exato da string ISO
    };
  }

  // Fallback para o caso de formato inválido
  return { 
    date: new Date(), 
    time: "09:00" 
  };
}

/**
 * Converte campos de formulário para um string ISO 8601
 * @param date Objeto Date do campo de data
 * @param time String de hora no formato "HH:MM"
 * @returns String ISO 8601 para armazenamento
 */
export function brazilFormDateToUTC(date: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);

  // Criar data usando UTC para evitar conversões automáticas
  const utcDate = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  ));

  return utcDate.toISOString();
}

/**
 * Função auxiliar para depuração de datas
 * @param label Rótulo para identificar o log
 * @param date Data a ser inspecionada
 */
export function logDateInfo(label: string, date: Date) {
  // Log removido para produção
  const dateInfo = {
    utc: date.toUTCString(),
    hours: date.getHours(),
    utcHours: date.getUTCHours(),
  };
}

/**
 * Formata uma data para exibição, preservando o valor exato do banco de dados
 * sem aplicar conversão de fuso horário
 * @param dateStr String de data ISO 8601
 * @returns String formatada DD/MM/YYYY HH:MM
 */
export function formatDatePreserveTime(dateStr: string | Date | null): string {
  if (!dateStr) return "Data não definida";

  const rawDate = dateStr.toString();
  // Formato esperado: 2025-04-16T13:01:44.868Z
  const match = rawDate.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);

  if (match) {
    const [_, year, month, day, hours, minutes] = match;
    // Não precisamos fazer ajuste, pois o banco já está em UTC e queremos exibir exatamente como está
    const adjustedHours = parseInt(hours);
    return `${day}/${month}/${year} ${String(adjustedHours).padStart(2, '0')}:${minutes}`;
  }

  // Fallback para o método anterior se o formato não bater
  const date = new Date(rawDate);
  // Para lidar com horário UTC, criamos uma data ISO e extraímos os componentes
  const isoString = date.toISOString();
  const utcMatch = isoString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  
  if (utcMatch) {
    const [_, year, month, day, hours, minutes] = utcMatch;
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
  
  // Se ainda falhar, usamos o método original
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Formata uma data para exibição, preservando o valor exato do banco de dados
 * sem aplicar conversão de fuso horário, removendo o horário
 * @param dateStr String de data ISO 8601
 * @returns String formatada DD/MM/YYYY (sem hora)
 */
export function formatDateOnlyDay(dateStr: string | Date | null): string {
  if (!dateStr) return "Data não definida";

  const rawDate = dateStr.toString();
  // Formato esperado: 2025-04-16T13:01:44.868Z
  const match = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    const [_, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  // Fallback para o método anterior se o formato não bater
  const date = new Date(rawDate);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

/**
 * Formata uma data de venda com o prefixo "Data da Venda: " seguido do formato DD/MM/YYYY
 * @param dateStr String de data ISO 8601
 * @returns String formatada "Data da Venda: DD/MM/YYYY"
 */
export function formatSaleDate(dateStr: string | Date | null): string {
  if (!dateStr) return "Data da Venda: Não definida";
  
  const formattedDate = formatDateOnlyDay(dateStr);
  return `Data da Venda: ${formattedDate}`;
}

/**
 * Formata um CPF no padrão brasileiro: 123.456.789-10
 * @param cpf String com o CPF sem formatação
 * @returns String formatada no padrão brasileiro
 */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return "";
  
  // Remover caracteres não numéricos
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Verificar se tem 11 dígitos
  if (cleanCPF.length !== 11) return cpf;
  
  // Formatar no padrão XXX.XXX.XXX-XX
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata um valor monetário para o padrão brasileiro: R$ 1.234,56
 * @param value Valor numérico ou string
 * @returns String formatada no padrão brasileiro
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  
  // Se for string, tentar converter para número
  let numValue: number;
  if (typeof value === 'string') {
    // Primeiro verificar se o valor parece ser um valor em formato americano (10000.00)
    if (/^\d+\.\d+$/.test(value)) {
      // Valor no formato americano, como do banco de dados (10000.00)
      numValue = parseFloat(value);
    } else if (value.includes('R$')) {
      // Extrair apenas o valor numérico de uma string formatada com R$
      const cleaned = value
        .replace(/[^\d,.]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      numValue = parseFloat(cleaned);
    } else {
      // Limpar a string e converter para número no formato brasileiro
      const cleaned = value
        .replace(/[^\d,.]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
      numValue = parseFloat(cleaned);
    }
    
    if (isNaN(numValue)) return "R$ 0,00";
  } else {
    // Verificar se estamos lidando com um valor muito grande que provavelmente
    // já está multiplicado por 100 (mais provável em caso de comissões)
    // Se o valor for muito grande para um valor típico de comissão (acima de 1.000.000)
    // e terminar em 00, provavelmente está multiplicado por 100 e devemos dividir por 100
    if (value > 1000000 && value % 100 === 0) {
      numValue = value / 100;
    } else {
      numValue = value;
    }
  }
  
  // Formatar para o padrão brasileiro com espaço após o R$
  return `R$ ${numValue.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
}

/**
 * @deprecated Use formatDatePreserveTime para preservar o horário original.
 * 
 * Formata uma data para exibir no formato brasileiro.
 * @param date A data a ser formatada
 * @returns String no formato DD/MM/YYYY HH:MM
 */
export function formattedDate(date: Date | string | null): string {
  if (!date) return "";
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
}
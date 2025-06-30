/**
 * Formata um valor numérico como moeda brasileira (R$)
 * @param valor - Valor a ser formatado
 * @returns String formatada no padrão de moeda brasileira
 */
export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') {
    return 'R$ 0,00';
  }
  
  // Converter para número se for string
  const valorNumerico = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d,-]/g, '').replace(',', '.')) : valor;
  
  // Verificar se o valor é um número válido
  if (isNaN(valorNumerico)) {
    return 'R$ 0,00';
  }
  
  // Formatar o valor como moeda brasileira
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valorNumerico);
}

/**
 * Formata um número para ter separador de milhares
 * @param valor - Valor a ser formatado
 * @returns String formatada com separador de milhares
 */
export function formatarNumero(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') {
    return '0';
  }
  
  // Converter para número se for string
  const valorNumerico = typeof valor === 'string' ? parseFloat(valor.replace(/[^\d,-]/g, '').replace(',', '.')) : valor;
  
  // Verificar se o valor é um número válido
  if (isNaN(valorNumerico)) {
    return '0';
  }
  
  // Formatar o valor com separador de milhares
  return new Intl.NumberFormat('pt-BR').format(valorNumerico);
}

/**
 * Formatar uma data no padrão brasileiro (DD/MM/AAAA)
 * @param data - Data a ser formatada (string no formato ISO ou objeto Date)
 * @returns String formatada no padrão brasileiro
 */
export function formatarData(data: string | Date | null | undefined): string {
  if (!data) {
    return '';
  }
  
  const dataObj = typeof data === 'string' ? new Date(data) : data;
  
  if (isNaN(dataObj.getTime())) {
    return '';
  }
  
  return dataObj.toLocaleDateString('pt-BR');
}
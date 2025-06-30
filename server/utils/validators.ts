import { z } from 'zod';

/**
 * Validador para IDs numéricos
 * Garante que o ID é um número válido e positivo
 */
export const idSchema = z.coerce
  .number()
  .int()
  .positive()
  .pipe(z.number());

/**
 * Validador para parâmetros de paginação
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(2000).default(100), // Limite de 2000 para equilibrar desempenho e capacidade
  includeCount: z.coerce.boolean().default(false),
});

/**
 * Validador para parâmetros de filtro de clientes
 */
export const clienteFilterSchema = z.object({
  status: z.string().optional(),
  assignedTo: z.coerce.number().int().positive().optional(),
  brokerId: z.coerce.number().int().positive().optional(),
  period: z.string().optional(),
  search: z.string().optional(),
  order: z.string().optional(),
}).merge(paginationSchema.partial());

/**
 * Função para validar um ID e retornar apropriadamente
 * @param rawId ID a ser validado, possivelmente como string
 * @returns Resultado da validação contendo o ID numérico ou um erro
 */
export function validateId(rawId: any): { success: boolean; data?: number; error?: string } {
  try {
    const id = idSchema.parse(rawId);
    return { success: true, data: id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: 'ID inválido. Deve ser um número positivo.' 
      };
    }
    return { 
      success: false, 
      error: 'Erro desconhecido ao validar ID.' 
    };
  }
}

/**
 * Função para validar filtros de cliente
 * @param filter Objeto de filtro a ser validado
 * @returns Resultado da validação contendo o filtro validado ou um erro
 */
export function validateClienteFilter(filter?: Record<string, any>) {
  try {
    const validatedFilter = clienteFilterSchema.parse(filter || {});
    return { success: true, data: validatedFilter };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: 'Filtro inválido', 
        details: error.errors 
      };
    }
    return { 
      success: false, 
      error: 'Erro desconhecido ao validar filtro.' 
    };
  }
}
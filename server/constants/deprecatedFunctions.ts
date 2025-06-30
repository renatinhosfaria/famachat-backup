/**
 * Arquivo para registrar e centralizar mensagens sobre funções depreciadas no sistema.
 * Isso facilita o rastreamento e remoção de funções legadas no futuro.
 */

/**
 * Registro de funções depreciadas, suas substitutas e planos de remoção.
 * Chave é o nome da função, valor é um objeto com informações sobre depreciação.
 */
export const DeprecatedFunctions = {
  // Storage / Database
  getLeadsReport: {
    replacement: "getClientesReport",
    since: "2023-11-01",
    removalDate: "2024-03-01",
    message: "Esta função foi depreciada. Use getClientesReport() em vez disso."
  },
  
  // API Routes
  "api/leads": {
    replacement: "api/clientes",
    since: "2023-10-15",
    removalDate: "2024-03-01",
    message: "Rotas /api/leads/* foram depreciadas. Use /api/clientes/* em vez disso."
  }
};

/**
 * Obtém a mensagem de depreciação para uma função específica
 * @param functionName Nome da função depreciada
 * @returns Mensagem formatada ou mensagem padrão se a função não estiver registrada
 */
export function getDeprecationMessage(functionName: string): string {
  const funcInfo = DeprecatedFunctions[functionName as keyof typeof DeprecatedFunctions];
  
  if (!funcInfo) {
    return `Esta função está depreciada e será removida em breve.`;
  }
  
  return `${funcInfo.message} Será removida após ${funcInfo.removalDate}.`;
} 
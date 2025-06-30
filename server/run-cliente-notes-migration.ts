import { db } from "./db";
import { addClienteNotesTable } from "./migrations/add-cliente-notes-table";
import { log, LogLevel } from "./utils";

/**
 * Script para executar especificamente a migração da tabela cliente_notes
 */
async function main() {
  try {
    log("Iniciando migração manual para adicionar tabela cliente_notes...", LogLevel.INFO);
    
    // Executar a migração
    const result = await addClienteNotesTable();
    
    // Verificar o resultado
    if (result === true) {
      log("Migração concluída com sucesso", LogLevel.INFO);
    } else {
      log("Migração falhou", LogLevel.ERROR);
    }
    
    log("Finalizando script de migração", LogLevel.INFO);
    process.exit(0);
  } catch (error) {
    log(`Erro durante execução da migração: ${error}`, LogLevel.ERROR);
    process.exit(1);
  }
}

// Executar o script
main();
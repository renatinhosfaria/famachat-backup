import { db } from "./db";
import { addProfilePicToClientes } from "./migrations/add-profile-pic-to-clientes";
import { log, LogLevel } from "./utils";

/**
 * Script para executar especificamente a migração de profilePicUrl
 */
async function main() {
  try {
    log("Iniciando migração manual para adicionar profilePicUrl...", LogLevel.INFO);
    
    // Executar a migração
    const result = await addProfilePicToClientes();
    
    // Verificar o resultado
    if (typeof result === 'object' && result !== null && 'success' in result) {
      if (!result.success) {
        log(`Erro na migração: ${result.message}`, LogLevel.ERROR);
      } else {
        log(`Migração concluída: ${result.message}`, LogLevel.INFO);
      }
    } else if (result === true) {
      log("Migração concluída com sucesso", LogLevel.INFO);
    } else if (result === false) {
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
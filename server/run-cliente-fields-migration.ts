import { addClienteSourceFields } from "./migrations/add-cliente-source-fields";
import { log } from "./utils";

async function runMigration() {
  try {
    log("Iniciando migração para adicionar campos de fonte ao cliente...");
    await addClienteSourceFields();
    log("Migração dos campos de fonte do cliente concluída com sucesso!");
  } catch (error) {
    log(`Erro na migração: ${error}`);
    process.exit(1);
  }
}

runMigration().catch(error => {
  
  process.exit(1);
});
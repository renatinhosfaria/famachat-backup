import { addRecurringLeadColumnsToAutomation } from './migrations/add-recurring-lead-columns';

async function run() {
  try {
    console.log('Iniciando script de migração para adicionar colunas de lead recorrente...');
    await addRecurringLeadColumnsToAutomation();
    console.log('Script de migração concluído com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro ao executar script de migração:', error);
    process.exit(1);
  }
}

run();
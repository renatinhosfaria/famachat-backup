/**
 * Script de teste para verificar se a configuração cascade_user_order está sendo respeitada
 */

const { db } = require('./database');
const { slaCascataParallelService } = require('./services/sla-cascata-parallel.service');

async function testCascadeConfig() {
  try {
    console.log('🔍 Testando configuração de cascata...\n');

    // 1. Verificar configuração ativa
    console.log('1. Verificando configuração ativa:');
    const result = await db.execute(`
      SELECT id, name, active, cascade_user_order, rotation_users 
      FROM sistema_config_automacao_leads 
      WHERE active = true
    `);
    
    if (result.length > 0) {
      const config = result[0];
      console.log(`   ✓ Configuração ID: ${config.id}`);
      console.log(`   ✓ Nome: ${config.name}`);
      console.log(`   ✓ cascade_user_order: ${JSON.stringify(config.cascade_user_order)}`);
      console.log(`   ✓ rotation_users: ${JSON.stringify(config.rotation_users)}`);
    } else {
      console.log('   ❌ Nenhuma configuração ativa encontrada');
      return;
    }

    console.log('\n2. Testando busca de usuários ativos do serviço:');
    
    // Usar reflexão para acessar o método privado (apenas para teste)
    const service = slaCascataParallelService;
    
    // Como os métodos são privados, vamos testar indiretamente através dos logs
    console.log('   📋 Iniciando um teste de cascata...');
    
    // Criar um cliente de teste
    const clienteTest = await db.execute(`
      INSERT INTO clientes (full_name, phone, email, status, created_at, updated_at)
      VALUES ('Cliente Teste Cascata', '11999999999', 'teste@cascata.com', 'lead', NOW(), NOW())
      RETURNING id
    `);
    
    const clienteId = clienteTest[0].id;
    console.log(`   ✓ Cliente de teste criado: ID ${clienteId}`);
    
    // Criar um lead de teste
    const leadTest = await db.execute(`
      INSERT INTO sistema_leads (full_name, phone, email, source, status, cliente_id, created_at, updated_at)
      VALUES ('Cliente Teste Cascata', '11999999999', 'teste@cascata.com', 'teste', 'novo', ${clienteId}, NOW(), NOW())
      RETURNING id
    `);
    
    const leadId = leadTest[0].id;
    console.log(`   ✓ Lead de teste criado: ID ${leadId}`);
    
    // Iniciar cascata (isso vai usar nosso novo sistema)
    console.log('\n3. Iniciando cascata de teste...');
    await service.iniciarSLACascataParalelo(leadId, clienteId);
    
    // Verificar resultado
    const cascataResult = await db.execute(`
      SELECT sc.*, u.username, u.full_name
      FROM sistema_leads_cascata sc
      LEFT JOIN sistema_users u ON sc.user_id = u.id
      WHERE sc.cliente_id = ${clienteId}
      ORDER BY sc.sequencia
    `);
    
    if (cascataResult.length > 0) {
      console.log('\n4. Resultado da cascata:');
      cascataResult.forEach(row => {
        console.log(`   ✓ Usuário: ${row.username} (${row.full_name}) - ID: ${row.user_id} - Sequência: ${row.sequencia}`);
      });
      
      // Verificar se o usuário atribuído está na cascade_user_order
      const configAtiva = result[0];
      const cascadeOrder = configAtiva.cascade_user_order || [];
      const usuarioAtribuido = cascataResult[0].user_id;
      
      if (cascadeOrder.includes(usuarioAtribuido)) {
        console.log(`   ✅ SUCESSO: Usuário ${usuarioAtribuido} está na cascade_user_order configurada`);
      } else {
        console.log(`   ❌ ERRO: Usuário ${usuarioAtribuido} NÃO está na cascade_user_order configurada`);
      }
    } else {
      console.log('   ❌ Nenhum registro de cascata foi criado');
    }
    
    // Limpeza
    console.log('\n5. Limpando dados de teste...');
    await db.execute(`DELETE FROM sistema_leads_cascata WHERE cliente_id = ${clienteId}`);
    await db.execute(`DELETE FROM sistema_leads WHERE id = ${leadId}`);
    await db.execute(`DELETE FROM clientes WHERE id = ${clienteId}`);
    console.log('   ✓ Dados de teste removidos');
    
    console.log('\n✅ Teste concluído!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    process.exit(0);
  }
}

// Executar teste
testCascadeConfig();

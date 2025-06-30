import { db } from '../database';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

const migrationLogger = logger.createLogger('Migration:WhatsAppAutoCheck');

/**
 * Cria um trigger que executa automaticamente a verificação de WhatsApp
 * quando um novo cliente é inserido na tabela clientes
 */
export async function createWhatsAppAutoCheckTrigger(): Promise<boolean> {
  try {
    migrationLogger.info('Criando trigger para verificação automática de WhatsApp...');

    // Primeiro, criar a função que será executada pelo trigger
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION trigger_whatsapp_check()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Apenas executa se o cliente tem um número de telefone
        IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
          -- Inserir uma tarefa na tabela de notificações ou log para processamento assíncrono
          INSERT INTO sistema_whatsapp_check_queue (cliente_id, phone, created_at)
          VALUES (NEW.id, NEW.phone, NOW())
          ON CONFLICT (cliente_id) DO UPDATE SET
            phone = EXCLUDED.phone,
            created_at = EXCLUDED.created_at,
            processed = false;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    migrationLogger.info('Função trigger_whatsapp_check criada com sucesso');

    // Criar a tabela de fila para processamento assíncrono
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sistema_whatsapp_check_queue (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        phone TEXT NOT NULL,
        processed BOOLEAN DEFAULT false,
        attempts INTEGER DEFAULT 0,
        last_attempt TIMESTAMP,
        result BOOLEAN,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(cliente_id)
      );
    `);

    migrationLogger.info('Tabela sistema_whatsapp_check_queue criada com sucesso');

    // Criar índices para otimização
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_processed 
      ON sistema_whatsapp_check_queue(processed);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_cliente_id 
      ON sistema_whatsapp_check_queue(cliente_id);
    `);

    // Remover trigger existente se houver
    await db.execute(sql`
      DROP TRIGGER IF EXISTS tr_whatsapp_check_on_insert ON clientes;
    `);

    // Criar o trigger na tabela clientes
    await db.execute(sql`
      CREATE TRIGGER tr_whatsapp_check_on_insert
        AFTER INSERT ON clientes
        FOR EACH ROW
        EXECUTE FUNCTION trigger_whatsapp_check();
    `);

    migrationLogger.info('Trigger tr_whatsapp_check_on_insert criado com sucesso');

    // Também criar trigger para updates quando o telefone muda
    await db.execute(sql`
      DROP TRIGGER IF EXISTS tr_whatsapp_check_on_update ON clientes;
    `);

    await db.execute(sql`
      CREATE TRIGGER tr_whatsapp_check_on_update
        AFTER UPDATE OF phone ON clientes
        FOR EACH ROW
        WHEN (OLD.phone IS DISTINCT FROM NEW.phone AND NEW.phone IS NOT NULL AND NEW.phone != '')
        EXECUTE FUNCTION trigger_whatsapp_check();
    `);

    migrationLogger.info('Trigger tr_whatsapp_check_on_update criado com sucesso');

    migrationLogger.info('Sistema de verificação automática de WhatsApp configurado com sucesso!');
    return true;

  } catch (error) {
    migrationLogger.error(`Erro ao criar trigger de verificação WhatsApp: ${error}`);
    return false;
  }
}

/**
 * Remove o trigger e tabela de automação WhatsApp (rollback)
 */
export async function removeWhatsAppAutoCheckTrigger(): Promise<boolean> {
  try {
    migrationLogger.info('Removendo sistema de verificação automática de WhatsApp...');

    // Remover triggers
    await db.execute(sql`DROP TRIGGER IF EXISTS tr_whatsapp_check_on_insert ON clientes;`);
    await db.execute(sql`DROP TRIGGER IF EXISTS tr_whatsapp_check_on_update ON clientes;`);
    
    // Remover função
    await db.execute(sql`DROP FUNCTION IF EXISTS trigger_whatsapp_check();`);
    
    // Remover tabela (cuidado: isso apaga todos os dados da fila)
    await db.execute(sql`DROP TABLE IF EXISTS sistema_whatsapp_check_queue;`);

    migrationLogger.info('Sistema de verificação automática removido com sucesso');
    return true;

  } catch (error) {
    migrationLogger.error(`Erro ao remover trigger de verificação WhatsApp: ${error}`);
    return false;
  }
}

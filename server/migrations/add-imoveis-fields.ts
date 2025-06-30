
import { db } from "../database";
import { sql } from "drizzle-orm";
import { log } from "../utils";

export async function addImoveisFields() {
  try {
    await db.execute(sql`
      ALTER TABLE imoveis 
      ADD COLUMN IF NOT EXISTS proprietario_id UUID REFERENCES proprietarios(id),
      ADD COLUMN IF NOT EXISTS nome_empreendimento VARCHAR(100),
      ADD COLUMN IF NOT EXISTS rua VARCHAR(100),
      ADD COLUMN IF NOT EXISTS numero VARCHAR(20),
      ADD COLUMN IF NOT EXISTS complemento VARCHAR(50),
      ADD COLUMN IF NOT EXISTS bairro VARCHAR(50),
      ADD COLUMN IF NOT EXISTS cidade VARCHAR(50),
      ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
      ADD COLUMN IF NOT EXISTS cep VARCHAR(20),
      ADD COLUMN IF NOT EXISTS blocos VARCHAR(50),
      ADD COLUMN IF NOT EXISTS andares VARCHAR(20),
      ADD COLUMN IF NOT EXISTS aptos_por_andar VARCHAR(20),
      ADD COLUMN IF NOT EXISTS valor_condominio VARCHAR(30),
      ADD COLUMN IF NOT EXISTS servicos JSONB,
      ADD COLUMN IF NOT EXISTS lazer JSONB,
      ADD COLUMN IF NOT EXISTS apartamentos JSONB,
      ADD COLUMN IF NOT EXISTS fotos JSONB,
      ADD COLUMN IF NOT EXISTS foto_capa_idx INTEGER,
      ADD COLUMN IF NOT EXISTS videos JSONB,
      ADD COLUMN IF NOT EXISTS valor_venda VARCHAR(30),
      ADD COLUMN IF NOT EXISTS titulo_descritivo VARCHAR(200),
      ADD COLUMN IF NOT EXISTS descricao_completa TEXT,
      ADD COLUMN IF NOT EXISTS status_publicacao VARCHAR(20)
    `);
    log("Campos adicionados à tabela imoveis com sucesso");
    return true;
  } catch (error) {
    log(`Erro ao adicionar campos à tabela imoveis: ${error}`, "error");
    return false;
  }
}

import { eq, and } from 'drizzle-orm';
import { db, pool } from '../database';
import { sistemaMetas, insertSistemaMetaSchema, updateSistemaMetaSchema, SistemaMeta, InsertSistemaMeta, UpdateSistemaMeta } from '@shared/schema';

/**
 * Serviço para gerenciamento das metas no sistema
 */
export class MetasService {
  /**
   * Busca as metas de um usuário específico
   * @param userId ID do usuário
   * @param ano Ano das metas
   * @param mes Mês das metas (1-12)
   */
  async getMetasByUserId(userId: number, ano: number, mes: number): Promise<SistemaMeta | undefined> {
    try {
      console.log(`Buscando metas para usuário ${userId}, ano ${ano}, mês ${mes}`);
      
      // Seleciona apenas as colunas que realmente existem na tabela
      // Importante: Drizzle já faz o mapeamento entre snake_case e camelCase
      const result = await db.select({
        id: sistemaMetas.id,
        userId: sistemaMetas.userId,
        periodo: sistemaMetas.periodo,
        ano: sistemaMetas.ano,
        mes: sistemaMetas.mes,
        agendamentos: sistemaMetas.agendamentos,
        visitas: sistemaMetas.visitas,
        vendas: sistemaMetas.vendas,
        conversaoAgendamentos: sistemaMetas.conversaoAgendamentos,
        conversaoVisitas: sistemaMetas.conversaoVisitas,
        conversaoVendas: sistemaMetas.conversaoVendas,
        createdAt: sistemaMetas.createdAt,
        updatedAt: sistemaMetas.updatedAt
      })
      .from(sistemaMetas)
      .where(
        and(
          eq(sistemaMetas.userId, userId),
          eq(sistemaMetas.ano, ano),
          eq(sistemaMetas.mes, mes)
        )
      );
      
      console.log('Resultado da consulta:', result[0]);
      
      if (!result[0]) {
        return undefined;
      }
      
      return result[0];
    } catch (error) {
      console.error('Erro ao buscar metas do usuário:', error);
      throw new Error('Falha ao buscar metas do usuário');
    }
  }

  /**
   * Busca todas as metas de todos os usuários para um período específico
   * @param ano Ano das metas
   * @param mes Mês das metas (1-12)
   */
  async getAllMetas(ano: number, mes: number): Promise<SistemaMeta[]> {
    try {
      // Adicionar log para debugging
      console.log(`Buscando todas as metas - mostrar para ano=${ano}`);
      
      // Vamos verificar a consulta SQL gerada
      const query = db.select({
        id: sistemaMetas.id,
        userId: sistemaMetas.userId,
        periodo: sistemaMetas.periodo,
        ano: sistemaMetas.ano,
        mes: sistemaMetas.mes,
        agendamentos: sistemaMetas.agendamentos,
        visitas: sistemaMetas.visitas,
        vendas: sistemaMetas.vendas,
        conversaoAgendamentos: sistemaMetas.conversaoAgendamentos,
        conversaoVisitas: sistemaMetas.conversaoVisitas,
        conversaoVendas: sistemaMetas.conversaoVendas,
        createdAt: sistemaMetas.createdAt,
        updatedAt: sistemaMetas.updatedAt
      })
      .from(sistemaMetas)
      .orderBy(sistemaMetas.updatedAt);
      
      const result = await query;
      
      console.log(`Resultado da consulta: ${result.length} metas encontradas`);
      
      // Certifique-se de retornar um array vazio se não houver resultados
      console.log(`Retornando ${result.length} metas`);
      return result || [];
    } catch (error) {
      console.error('Erro ao buscar todas as metas:', error);
      throw new Error('Falha ao buscar todas as metas');
    }
  }

  /**
   * Cria ou atualiza as metas de um usuário
   * @param meta Dados da meta a ser criada/atualizada
   */
  async upsertMeta(meta: any): Promise<SistemaMeta> {
    try {
      console.log('Dados originais recebidos para mapeamento:', JSON.stringify(meta));
      
      // Verificar dados de entrada
      if (!meta.userId) {
        console.error('Erro: userId não fornecido nos dados de entrada!', meta);
        throw new Error('userId é obrigatório para salvar uma meta');
      }
      
      // Mapeia os nomes de campos do JavaScript para os nomes de colunas do banco de dados
      const metaForDb = {
        // É crucial garantir que user_id esteja presente e seja um número
        user_id: Number(meta.userId),
        periodo: meta.periodo || 'mensal',
        ano: Number(meta.ano) || new Date().getFullYear(),
        mes: Number(meta.mes) || new Date().getMonth() + 1,
        agendamentos: meta.agendamentos || 0,
        visitas: meta.visitas || 0,
        vendas: meta.vendas || 0,
        // Garantir valores numéricos para as taxas de conversão
        conversao_agendamentos: meta.conversaoAgendamentos !== undefined ? 
          Number(meta.conversaoAgendamentos) : 
          (meta.conversaoClientes !== undefined ? Number(meta.conversaoClientes) : 0),
        conversao_visitas: meta.conversaoVisitas !== undefined ? Number(meta.conversaoVisitas) : 0,
        conversao_vendas: meta.conversaoVendas !== undefined ? Number(meta.conversaoVendas) : 0,
      };
      
      // Log de verificação para userId/user_id
      console.log('Verificação crítica:');
      console.log('meta.userId original:', meta.userId, 'tipo:', typeof meta.userId);
      console.log('metaForDb.user_id mapeado:', metaForDb.user_id, 'tipo:', typeof metaForDb.user_id);
      
      console.log('Dados mapeados para colunas do banco:', JSON.stringify(metaForDb));
      
      // Não vamos usar o schema para validação direta aqui, pois ele faz mapeamento camelCase -> snake_case
      // Vamos usar os nomes corretos diretamente
      
      // Verifica se já existe uma meta para este usuário/período
      const existingMeta = await this.getMetasByUserId(
        metaForDb.user_id, 
        metaForDb.ano, 
        metaForDb.mes
      );
      
      if (existingMeta) {
        console.log(`Atualizando meta existente com ID ${existingMeta.id}`);
        
        // Usar conexão direta com o PostgreSQL
        console.log('Usando conexão direta com o PostgreSQL para atualização');
        
        // Obter um cliente do pool de conexões
        const client = await pool.connect();
        
        try {
          // Preparar SQL diretamente para atualização
          const query = `
            UPDATE sistema_metas SET
              agendamentos = $1,
              visitas = $2,
              vendas = $3,
              conversao_agendamentos = $4,
              conversao_visitas = $5,
              conversao_vendas = $6,
              updated_at = NOW()
            WHERE id = $7
            RETURNING *
          `;
          
          const params = [
            Number(metaForDb.agendamentos || 0),
            Number(metaForDb.visitas || 0),
            Number(metaForDb.vendas || 0),
            Number(metaForDb.conversao_agendamentos || 0),
            Number(metaForDb.conversao_visitas || 0),
            Number(metaForDb.conversao_vendas || 0),
            Number(existingMeta.id)
          ];
          
          console.log('Parâmetros para atualização:', JSON.stringify(params));
          
          // Executar a query com os parâmetros preparados
          const result = await client.query(query, params);
          const rows = result.rows;
          
          if (!rows || rows.length === 0) {
            throw new Error('Falha ao atualizar meta - nenhuma linha retornada');
          }
          
          console.log('Meta atualizada com valores de conversão:', {
            conversao_agendamentos: metaForDb.conversao_agendamentos,
            conversao_visitas: metaForDb.conversao_visitas, 
            conversao_vendas: metaForDb.conversao_vendas
          });
          
          return rows[0];
        } finally {
          // Liberar a conexão de volta para o pool
          client.release();
        }
      } else {
        console.log('Criando nova meta');
        
        // Usar a conexão direta com o PostgreSQL
        console.log('Usando conexão direta com o PostgreSQL para inserção');
        
        // Garantir que o user_id é um número válido
        const userId = Number(metaForDb.user_id);
        if (isNaN(userId) || userId <= 0) {
          console.error('user_id inválido:', metaForDb.user_id);
          throw new Error('ID de usuário inválido');
        }
        
        console.log('user_id para inserção (certamente não é nulo):', userId);
        
        // Obter um cliente do pool de conexões
        const client = await pool.connect();
        
        try {
          // Preparar SQL diretamente
          const query = `
            INSERT INTO sistema_metas 
              (user_id, periodo, ano, mes, agendamentos, visitas, vendas, 
               conversao_agendamentos, conversao_visitas, conversao_vendas)
            VALUES 
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
          `;
          
          const params = [
            userId, // Explicitamente usar o userId validado como número
            metaForDb.periodo || 'mensal',
            Number(metaForDb.ano),
            Number(metaForDb.mes),
            Number(metaForDb.agendamentos || 0),
            Number(metaForDb.visitas || 0),
            Number(metaForDb.vendas || 0),
            Number(metaForDb.conversao_agendamentos || 0),
            Number(metaForDb.conversao_visitas || 0),
            Number(metaForDb.conversao_vendas || 0)
          ];
          
          console.log('Parâmetros para query:', JSON.stringify(params));
          
          // Executar a query com os parâmetros preparados
          const result = await client.query(query, params);
          const rows = result.rows;
        
          if (!rows || rows.length === 0) {
            throw new Error('Falha ao inserir meta - nenhuma linha retornada');
          }
          
          return rows[0];
        } finally {
          // Liberar a conexão de volta para o pool
          client.release();
        }
      }
    } catch (error) {
      console.error('Erro ao salvar meta:', error);
      throw new Error('Falha ao salvar meta');
    }
  }

  /**
   * Atualiza uma meta existente
   * @param id ID da meta
   * @param meta Dados para atualização
   */
  async updateMeta(id: number, meta: any): Promise<SistemaMeta> {
    try {
      console.log('Dados originais para atualização:', JSON.stringify(meta));
      
      // Mapeia os nomes de campos para nomes de colunas snake_case diretamente
      const metaForDb: any = {};
      
      // Campos básicos
      if (meta.userId !== undefined) metaForDb.user_id = meta.userId;
      if (meta.periodo !== undefined) metaForDb.periodo = meta.periodo;
      if (meta.ano !== undefined) metaForDb.ano = meta.ano;
      if (meta.mes !== undefined) metaForDb.mes = meta.mes;
      if (meta.agendamentos !== undefined) metaForDb.agendamentos = meta.agendamentos;
      if (meta.visitas !== undefined) metaForDb.visitas = meta.visitas;
      if (meta.vendas !== undefined) metaForDb.vendas = meta.vendas;
      
      // Campos de conversão - usando diretamente os nomes snake_case
      if (meta.conversaoClientes !== undefined || meta.conversaoAgendamentos !== undefined) {
        metaForDb.conversao_agendamentos = meta.conversaoAgendamentos !== undefined ? 
          Number(meta.conversaoAgendamentos) : 
          (meta.conversaoClientes !== undefined ? Number(meta.conversaoClientes) : 0);
      }
      if (meta.conversaoVisitas !== undefined) {
        metaForDb.conversao_visitas = Number(meta.conversaoVisitas);
      }
      if (meta.conversaoVendas !== undefined) {
        metaForDb.conversao_vendas = Number(meta.conversaoVendas);
      }
      
      console.log('Dados mapeados para colunas do banco:', JSON.stringify(metaForDb));
      
      // Garantir que o user_id é um número válido se estiver presente
      if (metaForDb.user_id !== undefined) {
        const userId = Number(metaForDb.user_id);
        if (isNaN(userId) || userId <= 0) {
          console.error('user_id inválido para atualização:', metaForDb.user_id);
          throw new Error('ID de usuário inválido');
        }
        metaForDb.user_id = userId; // Garantir que é um número
      }
      
      // Usar conexão direta com o PostgreSQL
      const client = await pool.connect();
      
      try {
        // Construir a query dinamicamente baseada nos campos presentes
        let setClause = [];
        let params = [];
        let paramCount = 1;
        
        // Adicionar campos para atualização (se presentes)
        if (metaForDb.user_id !== undefined) {
          setClause.push(`user_id = $${paramCount++}`);
          params.push(metaForDb.user_id);
        }
        if (metaForDb.periodo !== undefined) {
          setClause.push(`periodo = $${paramCount++}`);
          params.push(metaForDb.periodo);
        }
        if (metaForDb.ano !== undefined) {
          setClause.push(`ano = $${paramCount++}`);
          params.push(Number(metaForDb.ano));
        }
        if (metaForDb.mes !== undefined) {
          setClause.push(`mes = $${paramCount++}`);
          params.push(Number(metaForDb.mes));
        }
        if (metaForDb.agendamentos !== undefined) {
          setClause.push(`agendamentos = $${paramCount++}`);
          params.push(Number(metaForDb.agendamentos));
        }
        if (metaForDb.visitas !== undefined) {
          setClause.push(`visitas = $${paramCount++}`);
          params.push(Number(metaForDb.visitas));
        }
        if (metaForDb.vendas !== undefined) {
          setClause.push(`vendas = $${paramCount++}`);
          params.push(Number(metaForDb.vendas));
        }
        if (metaForDb.conversao_agendamentos !== undefined) {
          setClause.push(`conversao_agendamentos = $${paramCount++}`);
          params.push(Number(metaForDb.conversao_agendamentos));
        }
        if (metaForDb.conversao_visitas !== undefined) {
          setClause.push(`conversao_visitas = $${paramCount++}`);
          params.push(Number(metaForDb.conversao_visitas));
        }
        if (metaForDb.conversao_vendas !== undefined) {
          setClause.push(`conversao_vendas = $${paramCount++}`);
          params.push(Number(metaForDb.conversao_vendas));
        }
        
        // Sempre atualizar o updated_at
        setClause.push(`updated_at = NOW()`);
        
        // Adicionar o ID como último parâmetro
        params.push(id);
        
        // Construir a query completa
        const query = `
          UPDATE sistema_metas
          SET ${setClause.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
        
        console.log('Query SQL para atualização:', query);
        console.log('Parâmetros para query de atualização:', JSON.stringify(params));
        
        // Executar a query
        const result = await client.query(query, params);
        const rows = result.rows;
        
        if (!rows || rows.length === 0) {
          throw new Error('Meta não encontrada ou falha ao atualizar');
        }
        
        console.log('Meta atualizada com sucesso:', JSON.stringify(rows[0]));
        
        return rows[0];
      } finally {
        // Liberar a conexão de volta para o pool
        client.release();
      }
    } catch (error) {
      console.error('Erro ao atualizar meta:', error);
      throw new Error('Falha ao atualizar meta');
    }
  }

  /**
   * Remove uma meta
   * @param id ID da meta
   */
  async deleteMeta(id: number): Promise<void> {
    try {
      await db.delete(sistemaMetas)
        .where(eq(sistemaMetas.id, id));
    } catch (error) {
      console.error('Erro ao excluir meta:', error);
      throw new Error('Falha ao excluir meta');
    }
  }
}

export const metasService = new MetasService();
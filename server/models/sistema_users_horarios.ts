import { pgTable, serial, integer, text, time, boolean } from 'drizzle-orm/pg-core';
import { users } from '../../shared/schema';

export const sistemaUsersHorarios = pgTable('sistema_users_horarios', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  diaSemana: text('dia_semana').notNull(), // 'SEG', 'TER', etc.
  horarioInicio: time('horario_inicio').notNull(),
  horarioFim: time('horario_fim').notNull(),
  diaTodo: boolean('dia_todo').default(false),
}); 
import { pgTable, serial, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Tabela para armazenar o conteúdo diário gerado pela OpenAI
export const sistema_daily_content = pgTable("sistema_daily_content", {
  id: serial("id").primaryKey(),
  image_url: text("image_url").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at").defaultNow(),
  active: boolean("active").default(true)
});

// Schema para inserção de conteúdo diário
export const insertDailyContentSchema = createInsertSchema(sistema_daily_content).omit({ 
  id: true,
  created_at: true
});

// Tipos para o conteúdo diário
export type DailyContent = typeof sistema_daily_content.$inferSelect;
export type InsertDailyContent = z.infer<typeof insertDailyContentSchema>;
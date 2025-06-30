import { Express } from 'express';
import metasRoutes from './metas';

/**
 * Registra as rotas de metas na aplicação Express
 * @param app Aplicação Express
 */
export function registerMetasRoutes(app: Express): void {
  app.use('/api/metas', metasRoutes);
}
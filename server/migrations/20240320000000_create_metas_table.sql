CREATE TABLE IF NOT EXISTS metas (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  agendamentos INTEGER,
  visitas INTEGER,
  vendas INTEGER,
  conversao_clientes INTEGER,
  conversao_agendamentos INTEGER,
  conversao_visitas INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
); 
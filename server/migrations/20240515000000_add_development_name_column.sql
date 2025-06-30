-- Add development_name column to clientes_vendas table
ALTER TABLE clientes_vendas ADD COLUMN IF NOT EXISTS development_name TEXT;

-- Comment explaining the purpose of the column
COMMENT ON COLUMN clientes_vendas.development_name IS 'Nome do empreendimento imobiliário';
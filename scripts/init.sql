-- FamaChat Database Initialization Script
-- This script ensures the database is properly configured for the application

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE famachat'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'famachat')\gexec

-- Connect to famachat database
\c famachat;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Set timezone
SET timezone = 'America/Sao_Paulo';

-- Create application user if needed (for security)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'famachat_app') THEN
        CREATE USER famachat_app WITH PASSWORD 'famachat_secure_2024';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE famachat TO famachat_app;
GRANT USAGE ON SCHEMA public TO famachat_app;
GRANT CREATE ON SCHEMA public TO famachat_app;

-- Log initialization
SELECT 'FamaChat database initialized successfully' AS status;
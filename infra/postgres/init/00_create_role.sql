-- Ensure the minute role/database exist for local dev (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'minute') THEN
        CREATE ROLE minute WITH LOGIN PASSWORD 'minute' SUPERUSER;
    END IF;
END $$;

SELECT 'CREATE DATABASE minute OWNER minute'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'minute')\gexec

GRANT ALL PRIVILEGES ON DATABASE minute TO minute;

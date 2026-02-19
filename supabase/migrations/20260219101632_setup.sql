-- 1. Setup Schema and Common Functions
CREATE SCHEMA IF NOT EXISTS private;

-- Grant usage on the schema itself
GRANT USAGE ON SCHEMA private TO postgres, service_role;

-- Grant table-level permissions
GRANT ALL ON ALL TABLES IN SCHEMA private TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA private TO postgres, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA private TO postgres, service_role;

-- Ensure future tables also have these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA private GRANT ALL ON FUNCTIONS TO postgres, service_role;

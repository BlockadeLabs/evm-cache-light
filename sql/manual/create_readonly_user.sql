-- Issued by postgres OUTSIDE THE DATABASE
CREATE USER evm_cache_readonly;
ALTER USER evm_cache_readonly WITH PASSWORD 'evm_cache_readonly_password';
GRANT CONNECT ON DATABASE evm_cache TO evm_cache_readonly;

-- Issued by postgres WITHIN THE DATABASE
GRANT USAGE ON SCHEMA public TO evm_cache_readonly;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO evm_cache_readonly;

-- Issued by evm_cache_user WITHIN THE DATABASE
GRANT SELECT ON ALL TABLES IN SCHEMA public TO evm_cache_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO evm_cache_readonly;

-- Now we grant update access to the metadata table to allow for knowing when to refresh
-- A more secure way would be to separate the necessity to update a token's metadata and the metadata information
GRANT UPDATE ON "asset_metadata" TO evm_cache_readonly;

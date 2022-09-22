-- First create user and password
CREATE USER evm_cache_user SUPERUSER;
ALTER USER evm_cache_user WITH PASSWORD 'password';

-- Now create database
CREATE DATABASE "evm_cache" WITH OWNER evm_cache_user;
GRANT ALL PRIVILEGES ON DATABASE "evm_cache" TO evm_cache_user;

-- note: if importing a ton of data, probably best to *wait* to set these indexes
-- until after finishing copying in the data

-- block indexes
CREATE INDEX block_number_idx ON "block" ("number");
CREATE INDEX block_hash_idx ON "block" ("hash");
CREATE INDEX block_parent_hash_idx ON "block" ("parent_hash");
CREATE INDEX block_miner_idx ON "block" ("miner");
CREATE INDEX block_created_time_idx ON "block" ("created_time");

-- transaction indexes
CREATE INDEX transaction_block_hash_idx ON "transaction" ("block_hash");
CREATE INDEX transaction_hash_idx ON "transaction" ("hash");
CREATE INDEX transaction_from_idx ON "transaction" ("from");
CREATE INDEX transaction_to_idx ON "transaction" ("to");
CREATE INDEX transaction_contract_address_idx ON "transaction" ("contract_address");

-- log indexes
CREATE INDEX log_block_number_idx ON "log" ("block_number");
CREATE INDEX log_transaction_hash_idx ON "log" ("transaction_hash");
CREATE INDEX log_address_idx ON "log" ("address");

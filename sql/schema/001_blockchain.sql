CREATE TYPE BLOCKCHAIN_TYPE as ENUM(
	'ethereum',
	'matic'
);

CREATE TABLE blockchain (
	"blockchain_id" BIGSERIAL PRIMARY KEY,
	"type"          BLOCKCHAIN_TYPE NOT NULL,
	"name"          TEXT NOT NULL UNIQUE
);

CREATE TABLE blockchain_node (
	"blockchain_node_id" BIGSERIAL PRIMARY KEY,
	"blockchain_id"      BIGINT REFERENCES "blockchain" (blockchain_id) NOT NULL,
	"endpoint"           TEXT NOT NULL,
	"skip"               BOOLEAN DEFAULT FALSE
);

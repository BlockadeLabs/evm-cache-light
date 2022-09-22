CREATE TABLE block (
	"block_id"          BIGSERIAL PRIMARY KEY,
	"blockchain_id"     BIGINT REFERENCES "blockchain" (blockchain_id) NOT NULL,
	"number"            BIGINT NOT NULL,
	"hash"              BYTEA NOT NULL UNIQUE,
	"parent_hash"       BYTEA, --REFERENCES "block" (hash),
	"created_time"      TIMESTAMP WITH TIME ZONE,
	"gas_limit"         BIGINT,
	"gas_used"          BIGINT,
	"miner"             BYTEA,
	"difficulty"        NUMERIC,
	"size"              BIGINT
);

CREATE TABLE transaction (
	"transaction_id"    BIGSERIAL PRIMARY KEY,
	"block_hash"        BYTEA REFERENCES "block" (hash) NOT NULL,
	"hash"              BYTEA NOT NULL UNIQUE,
	"nonce"             BIGINT,
	"transaction_index" BIGINT,
	"from"              BYTEA NOT NULL,
	"to"                BYTEA,
	"value"             NUMERIC,
	"gas_price"         NUMERIC,
	"gas"               BIGINT,
	"input"             BYTEA,
	"status"            BOOLEAN,
	"contract_address"  BYTEA
);

CREATE TABLE log (
	"log_id"           BIGSERIAL PRIMARY KEY,
	"transaction_hash" BYTEA REFERENCES "transaction" (hash) NOT NULL,
	"block_number"     BIGINT,
	"log_index"        BIGINT,
	"address"          BYTEA,
	"data"             BYTEA,
	"topics"           BYTEA[]
);

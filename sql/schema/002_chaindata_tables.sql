CREATE TABLE block (
	"block_id"          BIGSERIAL PRIMARY KEY,
	"blockchain_id"     BIGINT REFERENCES "blockchain" (blockchain_id) NOT NULL,
	"number"            BIGINT NOT NULL,
	"hash"              BYTEA NOT NULL UNIQUE,
	"parent_hash"       BYTEA, --REFERENCES "block" (hash),
	"created_time"      TIMESTAMP WITH TIME ZONE,
	"nonce"             BYTEA,
	"gas_limit"         BIGINT,
	"gas_used"          BIGINT,
	"sha3_uncles"       BYTEA,
	"logs_bloom"        BYTEA,
	"transactions_root" BYTEA,
	"receipts_root"     BYTEA,
	"state_root"        BYTEA,
	"mix_hash"          BYTEA,
	"miner"             BYTEA,
	"difficulty"        NUMERIC,
	"extra_data"        BYTEA,
	"size"              BIGINT
);

-- To store the "uncles" data
CREATE TABLE ommer (
	"ommer_id"           BIGSERIAL PRIMARY KEY,
	"blockchain_id"      BIGINT REFERENCES "blockchain" (blockchain_id) NOT NULL,
	"hash"               BYTEA NOT NULL UNIQUE,
	"nibling_block_hash" BYTEA REFERENCES "block" (hash) NOT NULL
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
	"contract_address"  BYTEA,
	"v"                 BYTEA,
	"r"                 BYTEA,
	"s"                 BYTEA
);

CREATE TABLE log (
	"log_id"           BIGSERIAL PRIMARY KEY,
	"transaction_hash" BYTEA REFERENCES "transaction" (hash) NOT NULL,
	"block_number"     BIGINT,
	"log_index"        BIGINT,
	"address"          BYTEA,
	"data"             BYTEA,
	"topic_0"          BYTEA,
	"topic_1"          BYTEA,
	"topic_2"          BYTEA,
	"topic_3"          BYTEA
);

-- NOTE: topic_N could have been consolidated as topics BYTEA[]


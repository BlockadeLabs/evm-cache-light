CREATE TABLE event (
	"event_id" BIGSERIAL PRIMARY KEY,
	"log_id"   BIGINT REFERENCES "log" (log_id) ON DELETE CASCADE UNIQUE NOT NULL,
	"name"     TEXT NOT NULL,
	"result"   JSONB
);

CREATE INDEX event_name_idx ON "event" ("name");

-- For indexing: quickly find addresses related to events
-- We could do this with JSONB, but there's a major performance impact
--"addresses"     BYTEA[]
--CREATE INDEX parsed_log_addresses_idx ON "parsed_log" USING GIN("addresses");

CREATE TABLE event_transfer (
	"event_transfer_id" BIGSERIAL PRIMARY KEY,
	"event_id"          BIGINT REFERENCES "event" (event_id) ON DELETE CASCADE NOT NULL,
	"contract_address"  BYTEA,
	"to"                BYTEA,
	"from"              BYTEA,
	"id"                NUMERIC,
	"value"             NUMERIC
);

CREATE INDEX event_transfer_event_id_idx ON "event_transfer" ("event_id");
CREATE INDEX event_transfer_from_idx ON "event_transfer" ("from");
CREATE INDEX event_transfer_to_idx ON "event_transfer" ("to");
CREATE INDEX event_transfer_contract_address_idx ON "event_transfer" ("contract_address");
CREATE INDEX event_transfer_asset_idx ON "event_transfer" ("contract_address", "id");
CREATE INDEX event_transfer_contract_to_idx ON "event_transfer" ("contract_address", "to");
CREATE INDEX event_transfer_contract_from_idx ON "event_transfer" ("contract_address", "from");
CREATE INDEX event_transfer_contract_id_to_idx ON "event_transfer" ("contract_address", "id", "to");
CREATE INDEX event_transfer_contract_id_from_idx ON "event_transfer" ("contract_address", "id", "from");

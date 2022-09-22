CREATE TABLE address (
	"address" BYTEA NOT NULL UNIQUE PRIMARY KEY
);

CREATE OR REPLACE FUNCTION f_insert_address_on_block() RETURNS TRIGGER AS
$BODY$
BEGIN
	IF NEW.miner IS NOT NULL THEN
		INSERT INTO address (address)
		VALUES (NEW.miner)
		ON CONFLICT (address) DO NOTHING;
	END IF;

	RETURN NEW;
END;
$BODY$
language plpgsql;

CREATE OR REPLACE FUNCTION f_insert_address_on_transaction() RETURNS TRIGGER AS
$BODY$
BEGIN
	IF NEW."to" IS NOT NULL THEN
		INSERT INTO address (address)
		VALUES (NEW."to")
		ON CONFLICT (address) DO NOTHING;
	END IF;

	IF NEW."from" IS NOT NULL THEN
		INSERT INTO address (address)
		VALUES (NEW."from")
		ON CONFLICT (address) DO NOTHING;
	END IF;

	IF NEW.contract_address IS NOT NULL THEN
		INSERT INTO address (address)
		VALUES (NEW.contract_address)
		ON CONFLICT (address) DO NOTHING;
	END IF;

	RETURN NEW;
END;
$BODY$
language plpgsql;

CREATE OR REPLACE FUNCTION f_insert_address_on_event_transfer() RETURNS TRIGGER AS
$BODY$
BEGIN
	IF NEW."to" IS NOT NULL THEN
		INSERT INTO address (address)
		VALUES (NEW."to")
		ON CONFLICT (address) DO NOTHING;
	END IF;

	IF NEW."from" IS NOT NULL THEN
		INSERT INTO address (address)
		VALUES (NEW."from")
		ON CONFLICT (address) DO NOTHING;
	END IF;

	RETURN NEW;
END;
$BODY$
language plpgsql;

CREATE OR REPLACE FUNCTION f_insert_address_on_contract_meta() RETURNS TRIGGER AS
$BODY$
BEGIN
	IF NEW.address IS NOT NULL THEN
		INSERT INTO address (address)
		VALUES (NEW.address)
		ON CONFLICT (address) DO NOTHING;
	END IF;

	RETURN NEW;
END;
$BODY$
language plpgsql;

DROP TRIGGER IF EXISTS t_insert_address_on_block ON block;
DROP TRIGGER IF EXISTS t_insert_address_on_transaction ON transaction;
DROP TRIGGER IF EXISTS t_insert_address_on_event_transfer ON event_transfer;
DROP TRIGGER IF EXISTS t_insert_address_on_contract_meta ON contract_meta;

CREATE TRIGGER t_insert_address_on_block
BEFORE INSERT ON block
FOR EACH ROW
EXECUTE PROCEDURE f_insert_address_on_block();

CREATE TRIGGER t_insert_address_on_transaction
BEFORE INSERT ON transaction
FOR EACH ROW
EXECUTE PROCEDURE f_insert_address_on_transaction();

CREATE TRIGGER t_insert_address_on_event_transfer
BEFORE INSERT ON event_transfer
FOR EACH ROW
EXECUTE PROCEDURE f_insert_address_on_event_transfer();

CREATE TRIGGER t_insert_address_on_contract_meta
BEFORE INSERT ON contract_meta
FOR EACH ROW
EXECUTE PROCEDURE f_insert_address_on_contract_meta();


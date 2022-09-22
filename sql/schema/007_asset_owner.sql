CREATE TABLE asset_owner (
	"asset_owner_id"   BIGSERIAL PRIMARY KEY,
	"contract_address" BYTEA NOT NULL,
	"owner"            BYTEA NOT NULL,
	"id"               NUMERIC DEFAULT NULL,
	"value"            NUMERIC DEFAULT 0
);

CREATE UNIQUE INDEX asset_owner_contract_address_owner_null_id_idx ON asset_owner (contract_address, owner, (id IS NULL)) WHERE id IS NULL;
CREATE UNIQUE INDEX asset_owner_contract_address_owner_id_idx ON asset_owner (contract_address, owner, id) WHERE id IS NOT NULL;

CREATE INDEX asset_owner_owner_idx ON "asset_owner" ("owner");
CREATE INDEX asset_owner_contract_address_idx ON "asset_owner" ("contract_address");
CREATE INDEX asset_owner_contract_address_id_idx ON "asset_owner" ("contract_address", "id");
CREATE INDEX asset_owner_contract_address_owner_idx ON "asset_owner" ("contract_address", "owner");

CREATE OR REPLACE FUNCTION f_update_asset_owner() RETURNS TRIGGER AS
$BODY$
DECLARE
	amount_from NUMERIC;
	amount_to NUMERIC;
BEGIN
	IF TG_OP = 'INSERT' THEN
		-- Insert FROM record into asset_owner
		IF NOT EXISTS (
				SELECT * FROM asset_owner
				WHERE contract_address = NEW.contract_address AND
					owner = NEW."from" AND
					(id = NEW.id OR (id IS NULL AND NEW.id IS NULL))
		) THEN
			INSERT INTO asset_owner (contract_address, owner, id)
			VALUES (NEW.contract_address, NEW."from", NEW.id)
			ON CONFLICT DO NOTHING;
		END IF;

		-- Insert TO record into asset_owner
		IF NOT EXISTS (
				SELECT * FROM asset_owner
				WHERE contract_address = NEW.contract_address AND
					owner = NEW."to" AND
					(id = NEW.id OR (id IS NULL AND NEW.id IS NULL))
		) THEN
			INSERT INTO asset_owner (contract_address, owner, id)
			VALUES (NEW.contract_address, NEW."to", NEW.id)
			ON CONFLICT DO NOTHING;
		END IF;

		SELECT SUM(COALESCE(input, 0) - COALESCE(output, 0)) INTO amount_from
		FROM event_transfer_owner
		WHERE contract_address = NEW.contract_address AND
			address = NEW."from" AND
			(id = NEW.id OR (id IS NULL AND NEW.id IS NULL));

		SELECT SUM(COALESCE(input, 0) - COALESCE(output, 0)) INTO amount_to
		FROM event_transfer_owner
		WHERE contract_address = NEW.contract_address AND
			address = NEW."to" AND
			(id = NEW.id OR (id IS NULL AND NEW.id IS NULL));

		-- Update FROM holder
		UPDATE asset_owner SET value = amount_from
		WHERE contract_address = NEW.contract_address AND
			owner = NEW."from" AND
			(id = NEW.id OR (id IS NULL AND NEW.id IS NULL));

		-- Update TO holder
		UPDATE asset_owner SET value = amount_to
		WHERE contract_address = NEW.contract_address AND
			owner = NEW."to" AND
			(id = NEW.id OR (id IS NULL AND NEW.id IS NULL));

		RETURN NEW;
	ELSIF TG_OP = 'DELETE' THEN
		-- Insert FROM record into asset_owner
		IF NOT EXISTS (
				SELECT * FROM asset_owner
				WHERE contract_address = OLD.contract_address AND
					owner = OLD."from" AND
					(id = OLD.id OR (id IS NULL AND OLD.id IS NULL))
		) THEN
			INSERT INTO asset_owner (contract_address, owner, id)
			VALUES (OLD.contract_address, OLD."from", OLD.id)
			ON CONFLICT DO NOTHING;
		END IF;

		-- Insert TO record into asset_owner
		IF NOT EXISTS (
				SELECT * FROM asset_owner
				WHERE contract_address = OLD.contract_address AND
					owner = OLD."to" AND
					(id = OLD.id OR (id IS NULL AND OLD.id IS NULL))
		) THEN
			INSERT INTO asset_owner (contract_address, owner, id)
			VALUES (OLD.contract_address, OLD."to", OLD.id)
			ON CONFLICT DO NOTHING;
		END IF;

		SELECT SUM(COALESCE(input, 0) - COALESCE(output, 0)) INTO amount_from
		FROM event_transfer_owner
		WHERE contract_address = OLD.contract_address AND
			address = OLD."from" AND
			(id = OLD.id OR (id IS NULL AND OLD.id IS NULL));

		SELECT SUM(COALESCE(input, 0) - COALESCE(output, 0)) INTO amount_to
		FROM event_transfer_owner
		WHERE contract_address = OLD.contract_address AND
			address = OLD."to" AND
			(id = OLD.id OR (id IS NULL AND OLD.id IS NULL));

		-- Update FROM holder
		UPDATE asset_owner SET value = amount_from
		WHERE contract_address = OLD.contract_address AND
			owner = OLD."from" AND
			(id = OLD.id OR (id IS NULL AND OLD.id IS NULL));

		-- Update TO holder
		UPDATE asset_owner SET value = amount_to
		WHERE contract_address = OLD.contract_address AND
			owner = OLD."to" AND
			(id = OLD.id OR (id IS NULL AND OLD.id IS NULL));

		RETURN OLD;
	END IF;
END;
$BODY$
language plpgsql;

DROP TRIGGER IF EXISTS t_update_asset_owner ON event_transfer;

CREATE TRIGGER t_update_asset_owner
AFTER INSERT OR DELETE ON event_transfer
FOR EACH ROW
EXECUTE PROCEDURE f_update_asset_owner();

-- To populate
-- INSERT INTO asset_owner (contract_address, owner, id, value)
-- SELECT contract_address, address as owner, id, SUM(COALESCE(input, 0) - COALESCE(output, 0)) AS value
-- FROM event_transfer_owner
-- GROUP BY contract_address, address, id;

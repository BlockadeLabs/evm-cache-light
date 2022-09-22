CREATE TYPE ADDRESS_TYPE as ENUM(
	'eoa',
	'contract'
);

CREATE OR REPLACE VIEW address AS
SELECT
	"miner" AS "address",
	'eoa'::ADDRESS_TYPE AS "type"
FROM
	block
WHERE
	"miner" IS NOT NULL
UNION
SELECT
	"from" AS "address",
	'eoa'::ADDRESS_TYPE AS "type"
FROM
	transaction
WHERE
	"from" IS NOT NULL
UNION
SELECT
	"to" AS "address",
	'eoa'::ADDRESS_TYPE AS "type"
FROM
	transaction
WHERE
	"to" IS NOT NULL
UNION
SELECT
	"contract_address" AS "address",
	'contract'::ADDRESS_TYPE AS "type"
FROM
	transaction
WHERE
	"contract_address" IS NOT NULL;

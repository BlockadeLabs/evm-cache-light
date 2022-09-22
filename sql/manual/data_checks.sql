-- Review and compare between asset_owner and event_transfer_owner
-- Should be 0
SELECT
	COUNT(esq.*) AS except_count
FROM (
	SELECT contract_address, address as owner, id, SUM(COALESCE(input, 0) - COALESCE(output, 0)) AS value
	FROM event_transfer_owner
	GROUP BY contract_address, address, id
	EXCEPT
	SELECT contract_address, owner, id, value FROM asset_owner
) AS esq;

-- To populate the asset_owner from event_transfer_owner
INSERT INTO asset_owner (contract_address, owner, id, value)
SELECT contract_address, address as owner, id, SUM(COALESCE(input, 0) - COALESCE(output, 0)) AS value
FROM event_transfer_owner
GROUP BY contract_address, address, id;

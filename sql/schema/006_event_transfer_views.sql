CREATE OR REPLACE VIEW event_transfer_owner AS
SELECT DISTINCT ON (et.contract_address, a.address, et.id)
	et.contract_address,
	a.address,
	et.id,
	SUM(CASE WHEN a.address = et.to OR a.address = et.from THEN 1 ELSE 0 END) AS transfers,
	SUM(CASE WHEN a.address = et.to   THEN CASE WHEN et.value IS NOT NULL THEN et.value ELSE 1 END END) AS input,
	SUM(CASE WHEN a.address = et.from THEN CASE WHEN et.value IS NOT NULL THEN et.value ELSE 1 END END) AS output
FROM
	event_transfer et,
	address a
WHERE
	et.to = a.address OR
	et.from = a.address
GROUP BY
	et.contract_address,
	a.address,
	et.id;

CREATE OR REPLACE VIEW event_transfer_count AS
SELECT DISTINCT ON (et.contract_address, a.address)
	et.contract_address,
	a.address,
	SUM(CASE WHEN a.address = et.to OR a.address = et.from THEN 1 ELSE 0 END) AS transfers,
	SUM(CASE WHEN a.address = et.to   THEN CASE WHEN et.value IS NOT NULL THEN et.value ELSE 1 END END) AS input,
	SUM(CASE WHEN a.address = et.from THEN CASE WHEN et.value IS NOT NULL THEN et.value ELSE 1 END END) AS output
FROM
	event_transfer et,
	address a
WHERE
	et.to = a.address OR
	et.from = a.address
GROUP BY
	et.contract_address,
	a.address;

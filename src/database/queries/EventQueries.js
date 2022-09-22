const hexToBytea = require('../../util/hexToBytea.js');

class EventQueries {
	static insertEvent(
		log_id,
		name,
		result
	) {
		return {
			text: `
				INSERT INTO
					event (
						log_id, name, result
					)
				VALUES (
					$1, $2, $3
				)
				ON CONFLICT DO NOTHING
				RETURNING *;
			`,
			values: [
				log_id,
				name,
				result
			]
		}
	}

	// NOTE: This cascades deletions to event_transfer
	static deleteLogEvents(
		log_id
	) {
		return {
			text: `
				DELETE FROM
					event
				WHERE
					log_id = $1;
			`,
			values: [
				log_id
			]
		}
	}

	static insertEventTransfer(
		event_id,
		contract_address,
		_to,
		_from,
		id,
		value
	) {
		return {
			text: `
				INSERT INTO
					event_transfer (
						event_id, contract_address, "to", "from", id, value
					)
				VALUES (
					$1, $2, $3, $4, $5, $6
				)
				ON CONFLICT DO NOTHING;
			`,
			values: [
				event_id,
				hexToBytea(contract_address),
				hexToBytea(_to),
				hexToBytea(_from),
				id,
				value
			]
		}
	}

	static getMostRecentContractEvent(
		address
	) {
		return {
			text: `
				SELECT
					b.number AS block_number,
					e.*
				FROM
					event e,
					log l,
					transaction t,
					block b
				WHERE
					e.log_id = l.log_id AND
					l.address = $1 AND
					t.hash = l.transaction_hash AND
					b.hash = t.block_hash
				ORDER BY
					e.log_id DESC
				LIMIT
					1;
			`,
			values: [
				hexToBytea(address)
			]
		}
	}
}      

module.exports = EventQueries;

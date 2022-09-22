const hexToBytea = require('../../util/hexToBytea.js');

class TransactionQueries {
	static addTransaction(
		block_hash,
		hash,
		nonce,
		transaction_index,
		_from,
		_to,
		value,
		gas_price,
		gas,
		input,
		status,
		contract_address
	) {
		return {
			text: `
				INSERT INTO
					transaction (
						block_hash,
						hash,
						nonce,
						transaction_index,
						"from",
						"to",
						value,
						gas_price,
						gas,
						input,
						status,
						contract_address
					)
				VALUES (
					$1,
					$2,
					$3,
					$4,
					$5,
					$6,
					$7,
					$8,
					$9,
					$10,
					$11,
					$12
				)
				ON CONFLICT (hash) DO UPDATE SET
					block_hash = EXCLUDED.block_hash,
					nonce = EXCLUDED.nonce,
					transaction_index = EXCLUDED.transaction_index,
					"from" = EXCLUDED.from,
					"to" = EXCLUDED.to,
					value = EXCLUDED.value,
					gas_price = EXCLUDED.gas_price,
					gas = EXCLUDED.gas,
					input = EXCLUDED.input,
					status = EXCLUDED.status,
					contract_address = EXCLUDED.contract_address
				RETURNING *;
			`,
			values: [
				hexToBytea(block_hash),
				hexToBytea(hash),
				nonce,
				transaction_index,
				hexToBytea(_from),
				hexToBytea(_to),
				value,
				gas_price,
				gas,
				hexToBytea(input),
				status,
				hexToBytea(contract_address)
			]
		}
	}


	static addTransactions(
		block_hash,
		transactions,
		receipts
	) {
		let values = [], numbers = [];

		let number = 0;
		for (let index in transactions) {
			let transaction = transactions[index];
			let receipt = receipts[index];
			values.push(
				hexToBytea(block_hash),
				hexToBytea(transaction.hash),
				transaction.nonce,
				transaction.transactionIndex,
				hexToBytea(transaction.from),
				hexToBytea(transaction.to),
				transaction.value,
				transaction.gasPrice,
				transaction.gas,
				hexToBytea(transaction.input),
				receipt.status,
				hexToBytea(receipt.contractAddress)
			);
			numbers.push(`(\$${++number},\$${++number},\$${++number},\$${++number},\$${++number},\$${++number},\$${++number},\$${++number},\$${++number},\$${++number},\$${++number},\$${++number})`);
		}

		return {
			text: `
				INSERT INTO
					transaction (
						block_hash,
						hash,
						nonce,
						transaction_index,
						"from",
						"to",
						value,
						gas_price,
						gas,
						input,
						status,
						contract_address
					)
				VALUES ${numbers.join(',')}
				ON CONFLICT (hash) DO UPDATE SET
					block_hash = EXCLUDED.block_hash,
					nonce = EXCLUDED.nonce,
					transaction_index = EXCLUDED.transaction_index,
					"from" = EXCLUDED.from,
					"to" = EXCLUDED.to,
					value = EXCLUDED.value,
					gas_price = EXCLUDED.gas_price,
					gas = EXCLUDED.gas,
					input = EXCLUDED.input,
					status = EXCLUDED.status,
					contract_address = EXCLUDED.contract_address
				RETURNING *;
			`,
			values: values
		}
	}


	static addLog(
		transaction_hash,
		block_number,
		log_index,
		address,
		data,
		topics
	) {
		return {
			text: `
				INSERT INTO
					log (
						transaction_hash,
						block_number,
						log_index,
						address,
						data,
						topics
					)
				VALUES (
					$1,
					$2,
					$3,
					$4,
					$5,
					$6
				)
				ON CONFLICT DO NOTHING
				RETURNING log_id;
			`,
			values: [
				hexToBytea(transaction_hash),
				block_number,
				log_index,
				hexToBytea(address),
				hexToBytea(data),
				topics.map(topic => hexToBytea(topic))
			]
		}
	}

	static addLogs(
		logs
	) {
		let values = [], numbers = [];

		let number = 0;
		for (let idx = 0; idx < logs.length; idx++) {
			let log = logs[idx];
			values.push(
				hexToBytea(log.transactionHash),
				log.blockNumber,
				log.logIndex,
				hexToBytea(log.address),
				hexToBytea(log.data),
				log.topics.map(topic => hexToBytea(topic))
			);

			numbers.push(`(\$${++number},\$${++number},\$${++number},\$${++number},\$${++number},\$${++number})`);
		}

		return {
			text: `
				INSERT INTO
					log (
						transaction_hash,
						block_number,
						log_index,
						address,
						data,
						topics
					)
				VALUES ${numbers.join(',')}
				ON CONFLICT DO NOTHING
				RETURNING log_id, log_index;
			`,
			values: values
		}
	}


	static deleteLogsByTransactionHash(
		transaction_hash
	) {
		return {
			text: `
				DELETE FROM
					log
				WHERE
					transaction_hash = $1;
			`,
			values: [
				hexToBytea(transaction_hash)
			]
		}
	}

	static deleteLogsByBlockHash(
		block_hash
	) {
		return {
			text: `
				DELETE FROM
					log
				USING
					transaction
				WHERE
					transaction.hash = log.transaction_hash AND
					transaction.block_hash = $1;
			`,
			values: [
				hexToBytea(block_hash)
			]
		}
	}

	static deleteLogs(
		blockchain_id,
		number
	) {
		return {
			text: `
				DELETE FROM
					log
				WHERE
					transaction_hash IN (
						SELECT
							hash
						FROM
							transaction
						WHERE
							block_hash IN (
								SELECT
									hash
								FROM
									block
								WHERE
									blockchain_id = $1 AND
									number = $2
							)
					);
			`,
			values: [
				blockchain_id,
				number
			]
		}
	}

	static deleteTransactions(
		blockchain_id,
		number
	) {
		return {
			text: `
				DELETE FROM
					transaction
				WHERE
					block_hash IN (
						SELECT
							hash
						FROM
							block
						WHERE
							blockchain_id = $1 AND
							number = $2
					);
			`,
			values: [
				blockchain_id,
				number
			]
		}
	}

	static getTransactionByHash(
		transaction_hash
	) {
		return {
			text: `
				SELECT
					*
				FROM
					transaction
				WHERE
					hash = $1
			`,
			values: [
				hexToBytea(transaction_hash)
			]
		}
	}

	static getTransactionLogs(
		transaction_hash
	) {
		return {
			text: `
				SELECT
					l.*,
					cm.standard,
					cm.abi
				FROM
					log l
				LEFT JOIN
					contract_meta cm ON
						cm.address = l.address
				WHERE
					l.transaction_hash = $1
			`,
			values: [
				hexToBytea(transaction_hash)
			]
		}
	}

	static getTransactionLogsByContractInBlockRange(
		address,
		start_block,
		end_block
	) {
		return {
			text: `
				SELECT
					l.*,
					cm.standard,
					cm.abi
				FROM
					log l
				JOIN
					transaction t ON
						t.hash = l.transaction_hash
				JOIN
					block b ON
						b.hash = t.block_hash AND
						b.number >= $2 AND
						b.number < $3
				LEFT JOIN
					contract_meta cm ON
						cm.address = l.address
				WHERE
					l.address = $1
			`,
			values: [
				hexToBytea(address),
				start_block,
				end_block
			]
		}
	}

	static getTransactionLogsByContractInLogRange(
		address,
		start_log_id,
		end_log_id
	) {
		return {
			text: `
				SELECT
					l.*,
					cm.standard,
					cm.abi
				FROM
					log l
				LEFT JOIN
					contract_meta cm ON
						cm.address = l.address
				WHERE
					l.address = $1 AND
					l.log_id >= $2 AND
					l.log_id < $3;
			`,
			values: [
				hexToBytea(address),
				start_log_id,
				end_log_id
			]
		}
	}

	static getBlockNumberForTransactionLog(
		log_id
	) {
		return {
			text: `
				SELECT
					b.number
				FROM
					block b,
					transaction t,
					log l
				WHERE
					l.log_id = $1 AND
					t.hash = l.transaction_hash AND
					b.hash = t.block_hash;
			`,
			values: [
				log_id
			]
		}
	}

	static getMaxLogForContract(
		contract_address
	) {
		return {
			text: `
				SELECT
					MAX(log_id)
				FROM
					log
				WHERE
					address = $1;
			`,
			values: [
				hexToBytea(contract_address)
			]
		}
	}

	static getMaxLog() {
		return {
			text : `
				SELECT
					MAX(log_id)
				FROM
					log;
			`
		}
	}
}

module.exports = TransactionQueries;

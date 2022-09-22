class DeleteQueries {

	static deleteLogsAndDependents(blockchain_id, start_number, end_number) {
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
									number >= $2 AND
									number < $3
							)
					);
			`,
			values: [
				blockchain_id,
				start_number,
				end_number
			]
		}
	}

	static deleteTransactions(blockchain_id, start_number, end_number) {
		return {
			text: `
				DELETE FROM
					transaction
				WHERE
					block_hash in (
						SELECT
							hash
						FROM
							block
						WHERE
							blockchain_id = $1 AND
							number >= $2 AND
							number < $3
					);
			`,
			values: [
				blockchain_id,
				start_number,
				end_number
			]
		}
	}

	static deleteBlocks(blockchain_id, start_number, end_number) {
		return {
			text: `
				DELETE FROM
					block
				WHERE
					blockchain_id = $1 AND
					number >= $2 AND
					number < $3
			`,
			values: [
				blockchain_id,
				start_number,
				end_number
			]
		}
	}
}

module.exports = DeleteQueries;

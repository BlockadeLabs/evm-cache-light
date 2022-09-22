const hexToBytea = require('../../util/hexToBytea.js');

class BlockQueries {
	static getLatestBlock(blockchain_id) {
		return {
			text: `
				SELECT
					*
				FROM
					block
				WHERE
					blockchain_id = $1
				ORDER BY
					number DESC
				LIMIT
					1;
			`,
			values: [
				blockchain_id
			]
		}
	}

	static getBlockTransactionCount(blockchain_id, number) {
		return {
			text: `
				SELECT
					COUNT(t.*)
				FROM
					transaction t,
					block b
				WHERE
					b.blockchain_id = $1 AND
					b.number = $2 AND
					b.hash = t.block_hash;
			`,
			values: [
				blockchain_id,
				number
			]
		}
	}

	static addBlock(
		blockchain_id,
		number,
		hash,
		parent_hash,
		gas_limit,
		gas_used,
		created_time,
		miner,
		difficulty,
		size
	) {
		return {
			text: `
				INSERT INTO
					block (
						blockchain_id,
						number,
						hash,
						parent_hash,
						gas_limit,
						gas_used,
						created_time,
						miner,
						difficulty,
						size
					)
				VALUES (
					$1,
					$2,
					$3,
					$4,
					$5,
					$6,
					TO_TIMESTAMP($7),
					$8,
					$9,
					$10
				)
				ON CONFLICT DO NOTHING
				RETURNING *;
			`,
			values: [
				blockchain_id,
				number,
				hexToBytea(hash),
				hexToBytea(parent_hash),
				gas_limit,
				gas_used,
				created_time,
				hexToBytea(miner),
				difficulty,
				size
			]
		}
	}

	static deleteBlock(
		blockchain_id,
		number
	) {
		return {
			text: `
				DELETE FROM
					block
				WHERE
					blockchain_id = $1 AND
					number = $2;
			`,
			values: [
				blockchain_id,
				number
			]
		}
	}

	static getBlockByHash(
		blockchain_id,
		hash
	) {
		return {
			text: `
				SELECT
					b.*,
					t_count.count AS transaction_count
				FROM
					block b,
					(SELECT COUNT(*) FROM transaction WHERE block_hash = $2) t_count
				WHERE
					b.blockchain_id = $1 AND
					b.hash = $2;
			`,
			values: [
				blockchain_id,
				hexToBytea(hash)
			]
		}
	}
}

module.exports = BlockQueries;

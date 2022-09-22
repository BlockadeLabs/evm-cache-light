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
		nonce,
		gas_limit,
		gas_used,
		created_time,
		sha3_uncles,
		logs_bloom,
		transactions_root,
		receipts_root,
		state_root,
		mix_hash,
		miner,
		difficulty,
		extra_data,
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
						nonce,
						gas_limit,
						gas_used,
						created_time,
						sha3_uncles,
						logs_bloom,
						transactions_root,
						receipts_root,
						state_root,
						mix_hash,
						miner,
						difficulty,
						extra_data,
						size
					)
				VALUES (
					$1,
					$2,
					$3,
					$4,
					$5,
					$6,
					$7,
					TO_TIMESTAMP($8),
					$9,
					$10,
					$11,
					$12,
					$13,
					$14,
					$15,
					$16,
					$17,
					$18
				)
				ON CONFLICT DO NOTHING
				RETURNING *;
			`,
			values: [
				blockchain_id,
				number,
				hexToBytea(hash),
				hexToBytea(parent_hash),
				hexToBytea(nonce),
				gas_limit,
				gas_used,
				created_time,
				hexToBytea(sha3_uncles),
				hexToBytea(logs_bloom),
				hexToBytea(transactions_root),
				hexToBytea(receipts_root),
				hexToBytea(state_root),
				hexToBytea(mix_hash),
				hexToBytea(miner),
				difficulty,
				hexToBytea(extra_data),
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

	static addOmmer(
		blockchain_id,
		hash,
		nibling_block_hash
	) {
		return {
			text: `
				INSERT INTO
					ommer (
						blockchain_id,
						hash,
						nibling_block_hash
					)
				VALUES (
					$1,
					$2,
					$3
				)
				ON CONFLICT (hash) DO UPDATE SET
					nibling_block_hash = EXCLUDED.nibling_block_hash
				RETURNING *;
			`,
			values: [
				blockchain_id,
				hexToBytea(hash),
				hexToBytea(nibling_block_hash)
			]
		}
	}

	static deleteOmmers(
		blockchain_id,
		number
	) {
		return {
			text: `
				DELETE FROM
					ommer
				WHERE
					nibling_block_hash IN (
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

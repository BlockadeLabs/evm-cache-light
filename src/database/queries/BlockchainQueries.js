class BlockchainQueries {
	static getBlockchainsAndNodes() {
		return {
			text: `
				SELECT
					b.*,
					bn.*
				FROM
					blockchain b,
					blockchain_node bn
				WHERE
					bn.blockchain_id = b.blockchain_id
				ORDER BY
					b.blockchain_id ASC,
					bn.blockchain_node_id ASC;
			`
		}
	}

	static addBlockchain(type, name) {
		return {
			text: `
				INSERT INTO
					blockchain (type, name)
				VALUES (
					$1, $2
				)
				ON CONFLICT DO NOTHING;
			`,
			values: [type, name]
		}
	}

	static addBlockchainNode(name, endpoint) {
		return {
			text: `
				INSERT INTO
					blockchain_node
						(blockchain_id, endpoint)
				SELECT
					blockchain_id,
					$2
				FROM
					blockchain
				WHERE
					name = $1;
			`,
			values: [name, endpoint]
		}
	}
}

module.exports = BlockchainQueries;

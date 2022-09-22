const hexToBytea = require('../../util/hexToBytea.js');

class ContractQueries {
	static addContract(
		blockchain_id,
		address,
		contract_standard,
		abi
	) {
		return {
			text: `
				INSERT INTO
					contract (
						blockchain_id,
						address,
						contract_standard_id,
						abi
					)
				VALUES (
					$1,
					$2,
					COALESCE((
						SELECT
							contract_standard_id
						FROM
							contract_standard
						WHERE
							version = 0 AND
							standard = $3
					), NULL),
					$4
				)
				ON CONFLICT DO NOTHING
				RETURNING *;
			`,
			values: [
				blockchain_id,
				hexToBytea(address),
				contract_standard,
				abi
			]
		}
	}

	static getContractsInBlockRange(
		blockchain_id,
		start_block_number,
		end_block_number
	) {
		return {
			text: `
				SELECT
					t.contract_address,
					t.input
				FROM
					transaction t,
					block b
				WHERE
					b.blockchain_id = $1 AND
					b.number >= $2 AND
					b.number < $3 AND
					b.block_id = t.block_id AND
					t.contract_address IS NOT NULL;
			`,
			values: [
				blockchain_id,
				start_block_number,
				end_block_number
			]
		}
	}

	static getContractCode(
		address
	) {
		return {
			text: `
				SELECT
					contract_address,
					input
				FROM
					transaction
				WHERE
					contract_address = $1;
			`,
			values: [
				hexToBytea(address)
			]
		}
	}

	static getTokenUriInfo(
		address
	) {
		return {
			text: `
				SELECT
					token_uri_json_interface,
					token_uri_json_interface_parameters,
					custom_token_uri,
					custom_token_uri_headers
				FROM
					contract_meta
				WHERE
					address = $1;
			`,
			values: [
				hexToBytea(address)
			]
		}
	}

	static getContractAddresses() {
		return {
			text: `
				SELECT
					cm.address
				FROM
					contract_meta cm;
			`,
			values: []
		}
	}

	static getContractMeta(
		address
	) {
		return {
			text: `
				SELECT
					cm.*,
					b.number AS created_block,
					b.hash AS created_block_hash,
					t.hash AS created_transaction_hash
				FROM
					contract_meta cm
				LEFT JOIN
					transaction t ON
						t.contract_address = cm.address
				LEFT JOIN
					block b ON
						b.hash = t.block_hash
				WHERE
					cm.address = $1 OR
					t.contract_address = $1;
			`,
			values: [
				hexToBytea(address)
			]
		}
	}

	static getContractMetaForLogSets(
		logSets
	) {
		let addresses = [];

		for (let set of logSets) {
			let address = hexToBytea(set.logs.address);
			if (addresses.indexOf(address) === -1) {
				addresses.push(address);
			}
		}

		return {
			text: `
				SELECT
					cm.*,
					b.number AS created_block,
					b.hash AS created_block_hash,
					t.hash AS created_transaction_hash
				FROM
					contract_meta cm
				LEFT JOIN
					transaction t ON
						t.contract_address = cm.address
				LEFT JOIN
					block b ON
						b.hash = t.block_hash
				WHERE
					cm.address = ANY($1) OR
					t.contract_address = ANY($1);
			`,
			values: [
				addresses
			]
		}
	}

	static upsertContractMeta(
		address,
		standard,
		abi,
		name,
		symbol,
		custom_name,
		token_uri_json_interface,
		token_uri_json_interface_parameters,
		custom_token_uri,
		custom_token_uri_headers
	) {
		return {
			text: `
				INSERT INTO
					contract_meta (
						address,
						standard,
						abi,
						name,
						symbol,
						custom_name,
						token_uri_json_interface,
						token_uri_json_interface_parameters,
						custom_token_uri,
						custom_token_uri_headers
					)
				VALUES (
					$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
				)
				ON CONFLICT (address) DO UPDATE SET
					standard                            = CASE WHEN EXCLUDED.standard                            IS NOT NULL THEN EXCLUDED.standard                            ELSE contract_meta.standard                            END,
					abi                                 = CASE WHEN EXCLUDED.abi                                 IS NOT NULL THEN EXCLUDED.abi                                 ELSE contract_meta.abi                                 END,
					name                                = CASE WHEN EXCLUDED.name                                IS NOT NULL THEN EXCLUDED.name                                ELSE contract_meta.name                                END,
					symbol                              = CASE WHEN EXCLUDED.symbol                              IS NOT NULL THEN EXCLUDED.symbol                              ELSE contract_meta.symbol                              END,
					custom_name                         = CASE WHEN EXCLUDED.custom_name                         IS NOT NULL THEN EXCLUDED.custom_name                         ELSE contract_meta.custom_name                         END,
					token_uri_json_interface            = CASE WHEN EXCLUDED.token_uri_json_interface            IS NOT NULL THEN EXCLUDED.token_uri_json_interface            ELSE contract_meta.token_uri_json_interface            END,
					token_uri_json_interface_parameters = CASE WHEN EXCLUDED.token_uri_json_interface_parameters IS NOT NULL THEN EXCLUDED.token_uri_json_interface_parameters ELSE contract_meta.token_uri_json_interface_parameters END,
					custom_token_uri                    = CASE WHEN EXCLUDED.custom_token_uri                    IS NOT NULL THEN EXCLUDED.custom_token_uri                    ELSE contract_meta.custom_token_uri                    END,
					custom_token_uri_headers            = CASE WHEN EXCLUDED.custom_token_uri_headers            IS NOT NULL THEN EXCLUDED.custom_token_uri_headers            ELSE contract_meta.custom_token_uri_headers            END;
			`,
			values: [
				hexToBytea(address),
				standard,
				abi,
				name,
				symbol,
				custom_name,
				token_uri_json_interface ? JSON.stringify(token_uri_json_interface) : null,
				token_uri_json_interface_parameters ? JSON.stringify(token_uri_json_interface_parameters) : null,
				custom_token_uri,
				custom_token_uri_headers
			]
		}
	}
}

module.exports = ContractQueries;

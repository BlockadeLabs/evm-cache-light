const log = require('loglevel');
const axios = require('axios');
const Web3Client = require('../classes/Web3Client.js');
const abiCfg = require('../config/abi.js');
const Database = require('../database/Database.js');
const BlockchainQueries = require('../database/queries/BlockchainQueries.js');
const BlockQueries = require('../database/queries/BlockQueries.js');
const TransactionQueries = require('../database/queries/TransactionQueries.js');
const ContractQueries = require('../database/queries/ContractQueries.js');
const EventQueries = require('../database/queries/EventQueries.js');
const AssetMetadataQueries = require('../database/queries/AssetMetadataQueries.js');
const byteaBufferToHex = require('../util/byteaBufferToHex.js');
const ContractIdentifier = require('../classes/ContractIdentifier.js');
const LogParser = require(__dirname + '/../classes/LogParser.js');

class ContractController {
	constructor(evmClient) {
		this.stats = {
			'heartbeat_event_insert_count' : 0,
			'heartbeat_event_insert_time' : 0
		};
		this.evmClient = evmClient;
	}

	setContractMetadata(address, abi = null, custom_data = null, callback = ()=>{}) {
		const ci = new ContractIdentifier();
		ci.determineStandard(address, (res) => {
			if (!res.standard) {
				if (abi && typeof abi === 'string' && abi.length > 0) {
					log.info(`Using provided ABI for ${address}`);
				} else if (
					res.call_results.length === 2 &&
					res.call_results.indexOf('erc20') !== -1 &&
					res.call_results.indexOf('erc721') !== -1
				) {
					log.info(`Call results determined ERC-20 and ERC-721 for ${address}, assuming ERC-721.`);
					res.standard = 'erc721';
				} else {
					log.info(`No standard determined for ${address}, and no ABI provided.`);
					return;
				}
			}

			Database.connect((Client) => {
				Client.query(ContractQueries.upsertContractMeta(
					address,
					res.standard,
					abi
				), () => {

					let custom_name = null,
						token_uri_json_interface = null,
						token_uri_json_interface_parameters = null,
						custom_token_uri = null,
						custom_token_uri_headers = null;
					if (custom_data && typeof custom_data === 'object') {
						if (custom_data.hasOwnProperty('custom_name')) {
							custom_name = custom_data.custom_name;
						}

						if (custom_data.hasOwnProperty('token_uri_json_interface')) {
							token_uri_json_interface = custom_data.token_uri_json_interface;
						}

						if (custom_data.hasOwnProperty('token_uri_json_interface_parameters')) {
							token_uri_json_interface_parameters = custom_data.token_uri_json_interface_parameters;
						}

						if (custom_data.hasOwnProperty('custom_token_uri')) {
							custom_token_uri = custom_data.custom_token_uri;
						}

						if (custom_data.hasOwnProperty('custom_token_uri_headers')) {
							custom_token_uri_headers = custom_data.custom_token_uri_headers;
						}
					}

					// Now get the name and symbol, if available
					ci.getNameSymbol(address, (res) => {
						Client.query(ContractQueries.upsertContractMeta(
							address,
							res.standard,
							abi,
							res.name || null,
							res.symbol || null,
							custom_name || null,
							token_uri_json_interface || res.token_uri_json_interface || null,
							token_uri_json_interface_parameters || null,
							custom_token_uri || null,
							custom_token_uri_headers || null
						), (result) => {
							Client.release();
							callback();
						});
					})
				});
			});
		});
	}

	async setDecodedLogs(Client, logSets) {
		let contractMetaRes = await Client.query(ContractQueries.getContractMetaForLogSets(logSets));

		// Make sure we have a valid result set
		if (!contractMetaRes || !contractMetaRes.rowCount) {
			return [];
		}

		let promises = [];
		for (let set of logSets) {
			for (let row of contractMetaRes.rows) {
				if (set.logs.address.toLowerCase() === byteaBufferToHex(row.address).toLowerCase()) {
					let contract_meta_id = row.contract_meta_id;

					// If the contract meta record does not exist, move along
					if (!contract_meta_id) {
						continue;
					}

					// Decode these logs
					const lp = new LogParser();
					let events = lp.decodeLogs([{
						...set.logs,
						log_id     : set.log_id,
						'standard' : row.standard,
						'abi'      : row.abi
					}]);

					if (!events || !Object.keys(events).length) {
						continue;
					}

					log.info(`Found ${Object.keys(events).length} log events for ${set.logs.address}`);

					for (let log_id in events) {
						if (!events.hasOwnProperty(log_id)) continue;

						promises.push(this.insertEvent(
							Client,
							log_id,
							events[log_id].contract_address,
							events[log_id].name,
							events[log_id].result
						));
					}
				}
			}
		}

		return promises;
	}

	async setDecodedLog(Client, log_id, logReceipt) {
		let contractMetaRes = await Client.query(ContractQueries.getContractMeta(logReceipt.address));

		// If the contract meta record does not exist, move along
		if (!contractMetaRes || !contractMetaRes.rowCount || !contractMetaRes.rows[0].contract_meta_id) {
			return;
		}

		// Decode these logs
		const lp = new LogParser();
		let events = lp.decodeLogs([{
			...logReceipt,
			log_id,
			'standard' : contractMetaRes.rows[0].standard,
			'abi'      : contractMetaRes.rows[0].abi
		}]);

		if (!events || !Object.keys(events).length) {
			return;
		}

		log.info(`Found ${Object.keys(events).length} log events for ${logReceipt.address}`);

		for (let log_id in events) {
			if (!events.hasOwnProperty(log_id)) continue;

			await this.insertEvent(
				Client,
				log_id,
				events[log_id].contract_address,
				events[log_id].name,
				events[log_id].result
			);
		}
	}

	async insertEvent(Client, log_id, contract_address, name, result) {
		// Drop pre-existing events
		await Client.query(EventQueries.deleteLogEvents(log_id));

		// Insert the events again
		let res = await Client.query(EventQueries.insertEvent(
			log_id,
			name,
			result
		));

		if (!res || !res.rowCount) {
			log.debug(`Could not add event per log ${log_id}`);
			return;
		}

		this.stats.heartbeat_event_insert_count++;

		// Add transfer events to a dedicated log
		if (name === 'Transfer') {
			let event_id = res.rows[0].event_id;

			await Client.query(EventQueries.insertEventTransfer(
				event_id,
				contract_address,
				result.to      || result._to,
				result.from    || result._from,
				result.tokenId || result._tokenId,
				result.value   || result._value
			));

			// Handle metadata
			await this.enqueueMetadataUpdate(Client, contract_address, result.tokenId || result._tokenId);
		} else if (name === 'TransferSingle') {
			let event_id = res.rows[0].event_id;

			await Client.query(EventQueries.insertEventTransfer(
				event_id,
				contract_address,
				result._to,
				result._from,
				result._id,
				result.hasOwnProperty('_amount') ? result._amount : result._value
			));

			// Handle metadata
			await this.enqueueMetadataUpdate(Client, contract_address, result._id);
		} else if (name === 'TransferBatch') {
			let event_id = res.rows[0].event_id;

			for (let idx = 0; idx < result._ids.length; idx++) {
				await Client.query(EventQueries.insertEventTransfer(
					event_id,
					contract_address,
					result._to,
					result._from,
					result._ids[idx],
					result.hasOwnProperty('_amounts') ? result._amounts[idx] : result._values[idx]
				));

				// Handle metadata
				await this.enqueueMetadataUpdate(Client, contract_address, result._ids[idx]);
			}
		}
	}

	async enqueueMetadataUpdate(Client, address, id) {
		try {
			if (!id || !address) {
				return;
			}

			// Convert address if it's a buffer
			address = byteaBufferToHex(address);

			// Enqueue the request
			await Client.query(AssetMetadataQueries.enqueueMetadataUpdate(address, id));
		} catch (ex) {
			log.error("Unknown error in enqueueMetadataUpdate:");
			log.error(ex);
		}
	}

	enqueueAllContractTokenMetadata(address, callback = () => {}) {
		Database.connect(async (Client) => {
			try {
				if (!address) {
					return;
				}

				// Convert address if it's a buffer
				address = byteaBufferToHex(address);

				// Enqueue the request
				await Client.query(AssetMetadataQueries.requireMetadataUpdateFlagAcrossContract(address));
			} catch (ex) {
				log.error("Unknown error in enqueueAllContractTokenMetadata:");
				log.error(ex);
			}

			callback();
		});
	}

	async iterateMetadataUpdates(limit = 50, callback = () => {}) {
		Database.connect((Client) => {
			// Now allow setting custom data
			Client.query(AssetMetadataQueries.getAssetsNeedUpdates(
				limit
			), (result) => {

				if (!result || result.rowCount === 0) {
					Client.release();
					return callback(0);
				}

				const numUpdates = result.rowCount;

				let promises = [];

				for (let idx = 0; idx < result.rows.length; idx++) {
					let address = result.rows[idx].contract_address;
					let id = result.rows[idx].id;

					promises.push(
						this.handleMetadata(Client, address, id)
					);
				}

				Promise.all(promises).then(() => {
					Client.release();
					return callback(numUpdates);
				}).catch((ex) => {
					Client.release();

					if (
						String(ex).indexOf('Invalid JSON RPC response') !== -1 ||
						String(ex).toUpperCase().indexOf('CONNECTION TIMEOUT') !== -1 ||
						String(ex).toLowerCase().indexOf('connection not open on send()') !== -1
					) {
						log.error("** JSON RPC failure or connection timeout in ContractController::handleMetadata, cycling to next node **");

						// Cycle to the next node...
						this.evmClient.cycleNodes();
					}

					return callback(numUpdates);
				});
			});
		});
	}

	async handleMetadata(Client, address, id) {
		// Convert address if it's a buffer
		address = byteaBufferToHex(address);

		try {
			// Get the token URI information
			let res = await Client.query(ContractQueries.getTokenUriInfo(address));
			if (!res || !res.rowCount) {
				return;
			}

			let tokenUriInfo = res.rows[0];

			let tokenUri;
			if (tokenUriInfo.custom_token_uri !== null) {
				// Handle custom token URIs
				tokenUri = tokenUriInfo.custom_token_uri;

				// Determine if we need to parse it
				// DO STUFF
			} else if (tokenUriInfo.token_uri_json_interface !== null) {
				// Handle JSON interface calls
				let jsonInterface = tokenUriInfo.token_uri_json_interface,
					parameters = [];

				if (tokenUriInfo.token_uri_json_interface_parameters !== null) {
					// Handle JSON interface with custom parameters

				} else {
					// Figure it out
					if (
						jsonInterface.name === 'tokenURI' ||
						jsonInterface.name === 'uri'
					) {
						parameters.push(String(id));
					}
				}

				// Encode
				let transactionData = this.evmClient.web3.eth.abi.encodeFunctionCall(
					jsonInterface, parameters
				);

				const unsignedTxObj = {
					to:   address,
					data: transactionData
				};

				// Call
				tokenUri = await this.evmClient.web3.eth.call(
					unsignedTxObj
				);

				// Convert result -- first remove the first 4 bytes32
				tokenUri = '0x' + tokenUri.replace(/^0x/, '').slice(32 * 4);
				tokenUri = this.evmClient.web3.utils.hexToAscii(tokenUri);
			} else {
				return;
			}

			// Clean the token URI
			tokenUri = tokenUri.replace(/\0/g, '');
			tokenUri = tokenUri.trim();

			// If this token URI contains the `{id}` parameter, use the ERC1155 standard
			tokenUri = tokenUri.replace(/{id}/g, parseInt(id, 10).toString(16).toLowerCase().padStart(64, '0'));

			// If it's a valid URL, then call it
			let metadata = null;
			try {
				// If this passes, it's valid
				new URL(tokenUri);

				// Restrict to a short response time
				let result = await axios.get(tokenUri, {timeout: 1000});
				metadata = result && result.data;
				try {
					metadata = JSON.stringify(metadata);
				} catch (_) {}
			} catch (_) {}

			// Store the token URI
			await Client.query(AssetMetadataQueries.upsertMetadata(address, id, tokenUri, metadata));
		} catch (ex) {
			if (
				String(ex).indexOf('Invalid JSON RPC response') !== -1 ||
				String(ex).toUpperCase().indexOf('CONNECTION TIMEOUT') !== -1 ||
				String(ex).toLowerCase().indexOf('connection not open on send()') !== -1
			) {
				throw ex;
			} else {
				log.error("Unknown error in handleMetadata:");
				log.error(ex);
			}

			// Store the token URI
			await Client.query(AssetMetadataQueries.clearMetadataUpdateFlag(address, id));
		}
	}

	backfillContractLogsByLogs(address, log_limit, start_override, callback = ()=>{}) {
		let latest_log_number = 0;

		Database.connect(async (Client) => {

			// Kick it off
			Client.query(BlockchainQueries.getBlockchainsAndNodes(), (result) => {
				if (!result || !result.rowCount) {
					log.error('No blockchain nodes found in database.');
					process.exit();
				}

				// ASSUMPTION: We're only going to watch one node at a time
				// But the SQL is built to handle multiple nodes and blockchains.
				// Regardless, one per at the moment
				let node = result.rows[0];

				// ASSUMPTION: We're only supporting Ethereum right now
				// Create a new monitor instance
				this.evmClient = new Web3Client({
					"endpoint" : node.endpoint
				});

				Client.query(TransactionQueries.getMaxLog(), (result) => {
					if (!result.rowCount) {
						log.error(`Unable to return max log`);
						process.exit(1);
					}

					latest_log_number = parseInt(result.rows[0].max, 10);
					log.info(`Latest log ID found: ${latest_log_number}`);

					getContractMeta.call(this);
				});
			});

			let contractMetaSet = false;
			async function getContractMeta() {
				Client.query(ContractQueries.getContractMeta(address), (result) => {
					// No recent event found
					if (!result.rowCount || !result.rows[0].contract_meta_id) {
						if (contractMetaSet) {
							Client.release();
							console.error(`Trying to set contract standard multiple times for ${address}`);
							process.exit(1);
						}

						// Need to add the contract
						contractMetaSet = true;
						this.setContractMetadata(address, null, null, getContractMeta.bind(this));
					} else {
						getMostRecentContractLog.call(this, result.rows[0]);
					}
				});
			}

			async function getMostRecentContractLog(meta) {
				let start_log,
					end_log;

				// Start at the beginning
				start_log = 1;

				// If we have an override
				if (start_override && parseInt(start_override, 10) >= 0) {
					start_log = parseInt(start_override, 10);
				}

				end_log = start_log + log_limit;

				// Get the lowest Log ID for this block
				let res = await Client.query(TransactionQueries.getBlockNumberForTransactionLog(start_log));
				let block_number = (res && res.rowCount && res.rows[0].number) || -1;

				log.info(`Starting contract backfill on block ${block_number} at log ${start_log}`);
				this.stats.heartbeat_event_insert_time = Date.now()/1000;

				backfill.call(this, address, start_log, end_log);
			};

			let heartbeat_count = 0;
			async function backfill(address, start_log, end_log) {
				Client.query(TransactionQueries.getTransactionLogsByContractInLogRange(
					address,
					start_log,
					end_log
				), async (result) => {
					if (start_log >= latest_log_number) {
						let res = await Client.query(TransactionQueries.getBlockNumberForTransactionLog(latest_log_number));
						let block_number = (res && res.rowCount && res.rows[0].number) || -1;

						log.info(`Reached end at block ${block_number}, between logs ${start_log} to ${end_log}: ${this.stats.heartbeat_event_insert_count} events added in ${(Date.now()/1000-this.stats.heartbeat_event_insert_time).toLocaleString(5)} seconds`);
						Client.release();
						return callback();
					}

					start_log = end_log;
					end_log = start_log + log_limit;

					if (heartbeat_count++ % 40 === 0) {
						let res = await Client.query(TransactionQueries.getBlockNumberForTransactionLog(start_log));
						let block_number = (res && res.rowCount && res.rows[0].number) || -1;

						log.info(`Heartbeat at block ${block_number}, between logs ${start_log} to ${end_log}: ${this.stats.heartbeat_event_insert_count} events added in ${(Date.now()/1000-this.stats.heartbeat_event_insert_time).toLocaleString(5)} seconds -- at ${(start_log/latest_log_number*100).toLocaleString(2)}%`);
						this.stats.heartbeat_event_insert_count = 0;
						this.stats.heartbeat_event_insert_time = Date.now()/1000;
					}

					if (!result.rowCount) {
						return backfill.call(this, address, start_log, end_log);
					}

					// Decode these logs
					const lp = new LogParser();
					let events = lp.decodeLogs(result.rows);

					if (!events || !Object.keys(events).length) {
						return backfill.call(this, address, start_log, end_log);
					}

					for (let log_id in events) {
						if (!events.hasOwnProperty(log_id)) continue;

						await this.insertEvent(
							Client,
							log_id,
							events[log_id].contract_address,
							events[log_id].name,
							events[log_id].result
						);
					}

					return backfill.call(this, address, start_log, end_log);

				});
			};
		});
	}
}

module.exports = ContractController;

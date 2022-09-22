const log = require('loglevel');
const Web3 = require('web3');
const abiCfg = require('../config/abi.js');
const Database = require('../database/Database.js');
const Web3Client = require('../classes/Web3Client.js');
const BlockchainQueries = require('../database/queries/BlockchainQueries.js');
const ContractQueries = require('../database/queries/ContractQueries.js');
const byteaBufferToHex = require('../util/byteaBufferToHex.js');

class ContractIdentifier {
	constructor() {
		this.web3 = new Web3();
	}

	async getWeb3() {
		let Client = await Database.connect();
		let result = await Client.query(BlockchainQueries.getBlockchainsAndNodes());
		Client.release();

		if (!result || !result.rowCount) {
			log.error('No blockchain nodes found in database.');
			process.exit(1);
		}

		// ASSUMPTION: We're only going to watch one node at a time
		// But the SQL is built to handle multiple nodes and blockchains.
		// Regardless, one per at the moment
		let node = result.rows[0];

		// ASSUMPTION: We're only supporting Ethereum right now
		// Create a new monitor instance
		let evmClient = new Web3Client({
			"endpoint" : node.endpoint
		});

		return evmClient.web3;
	}

	async getNameSymbol(address, callback = ()=>{}) {
		Database.connect(async (Client) => {
			let web3 = await this.getWeb3();

			Client.query(ContractQueries.getContractMeta(address), async (result) => {
				Client.release();

				if (!result || !result.rowCount || !result.rows[0].contract_meta_id) {
					log.error(`No contract metadata found for ${address}`);
					return callback({address});
				}

				let abi, record = result.rows[0];
				if (record.abi && typeof record.abi === 'object' && Object.keys(record.abi).length > 0) {
					abi = record.abi;
				} else if (typeof record.standard === 'string' && record.standard.length) {
					abi = abiCfg.abis[record.standard];
				} else {
					// Nothing to use
					log.debug("No valid ABI or standard provided to decode log.");
					return callback({address});
				}

				// Determine if we have a name function
				const contract = new web3.eth.Contract(abi, address);
				let name, symbol, token_uri_json_interface;
				try {
					name = await contract.methods.name().call();
				} catch (ex) {
					log.error(`Could not retrieve name for ${address}`);
				}

				try {
					symbol = await contract.methods.symbol().call();
				} catch (ex) {
					log.error(`Could not retrieve symbol for ${address}`);
				}

				try {
					token_uri_json_interface = await this.getTokenUriJsonInferface(address, contract, abi);
				} catch (ex) {
					log.error(`Could not retrieve tokenUriJsonInferface for ${address}`);
				}

				callback({
					address,
					name,
					symbol,
					token_uri_json_interface
				});
			});
		});
	}

	async getTokenUriJsonInferface(address, contract, abi) {
		// Get the code for analysis
		let web3 = await this.getWeb3();
		let code = await web3.eth.getCode(address);

		// If we can't find it, then attempt to see if it follows the ERC1155 Metadata URI standard
		let erc1155UriJson = abiCfg.supplemental_abis['erc1155-uri'];
		let sig = web3.eth.abi.encodeFunctionSignature(erc1155UriJson);
		sig = sig.slice(2).toLowerCase(); // Remove 0x and force lowercase jic

		if (code.indexOf(sig) !== -1) {
			log.info("Token URI JSON Interface found in ABI for ERC-1155");
			return erc1155UriJson;;
		}

		try {
			let res = await contract.methods.supportsInterface('0x0e89341c').call();
			if (res === true) {
				log.info("Token URI JSON Interface found in supportsInterface for ERC-1155");
				return abi[idx];
			}
		} catch (ex) {
			// Do nothing
			log.info("Contract has no support for supportsInterface");
		}

		// Only check for valid URI methods
		let validUriMethods = ['tokenURI'];

		// Find the part of the ABI we want
		for (let idx = 0; idx < abi.length; idx++) {
			if (abi[idx].type !== 'function') continue;
			if (validUriMethods.indexOf(abi[idx].name) === -1) continue;
			log.info("Token URI JSON Interface found in ABI for ERC-721");
			return abi[idx];
		}
	}

	async determineStandard(address, callback = ()=>{}) {
		Database.connect((Client) => {
			Client.query(ContractQueries.getContractCode(address), async (result) => {
				Client.release();

				let code;
				if (!result.rowCount || !result.rows[0].input) {
					log.info(`Address ${address} does not have contract creation transaction stored in the database.`);

					// Attempt to retrieve the code directly
					let web3 = await this.getWeb3();
					code = await web3.eth.getCode(address);
					if (!code || code.length < 4) {
						log.error(`Could not retrieve code from address. Exiting.`);
						return false;
					}
				} else {
					code = byteaBufferToHex(result.rows[0].input);
				}

				// Try to figure out the standard from the ABI
				let code_results = this.determineStandardByCode(code, false);

				// If one of these passed, then hand it back
				let standard = null;
				if (code_results.length === 1) {
					standard = code_results[0];
				} else if (code_results.length > 1) {
					log.error(`Ambiguous code analysis result for ${address}, returned ${code_results}. Attempt to determine standard by call.`);
				}

				// Failing? Try to guess the standard by calling the contract
				let call_results;
				if (!standard) {
					call_results = await this.determineStandardByCall(address, false);

					if (call_results.length === 1) {
						standard = call_results[0];
					} else if (call_results.length > 1) {
						log.error(`Ambiguous contract call analysis result for ${address}, returned ${call_results}`);
					}
				}

				callback({
					address,
					code_results,
					call_results,
					standard
				});
			});
		});
	}

	determineStandardByCode(input, verbose = false) {
		// Strictly lowercase comparisons
		input = input.toLowerCase();

		const abis = abiCfg.abis;
		const requiredEvents = abiCfg.events;
		const requiredFunctions = abiCfg.functions;

		// Keep track of potential matches
		let matches = abiCfg.contracts.slice();

		// Find a matching standard by function
		for (let contractType in requiredFunctions) {
			if (!requiredFunctions.hasOwnProperty(contractType)) continue;
			if (matches.indexOf(contractType) === -1) continue;

			contract_standard:
			for (let fIdx = 0; fIdx < requiredFunctions[contractType].length; fIdx++) {
				// Find the part of the ABI we want
				for (let idx = 0; idx < abis[contractType].length; idx++) {
					if (abis[contractType][idx].type !== 'function') continue;
					if (abis[contractType][idx].name !== requiredFunctions[contractType][fIdx]) continue;

					let sig = this.web3.eth.abi.encodeFunctionSignature(abis[contractType][idx]);
					sig = sig.slice(2).toLowerCase(); // Remove 0x and force lowercase jic

					if (input.indexOf(sig) === -1) {
						verbose && log.debug(contractType + " function: " + abis[contractType][idx].name, ": NOT FOUND");
						matches.splice(matches.indexOf(contractType), 1);
						break contract_standard;
					} else {
						verbose && log.debug(contractType + " function: " + abis[contractType][idx].name, ": FOUND");
					}
				}
			}
		}

		// Find a matching standard by event
		for (let contractType in requiredEvents) {
			if (!requiredEvents.hasOwnProperty(contractType)) continue;
			if (matches.indexOf(contractType) === -1) continue;

			contract_standard:
			for (let fIdx = 0; fIdx < requiredEvents[contractType].length; fIdx++) {
				// Find the part of the ABI we want
				for (let idx = 0; idx < abis[contractType].length; idx++) {
					if (abis[contractType][idx].type !== 'event') continue;
					if (abis[contractType][idx].name !== requiredEvents[contractType][fIdx]) continue;

					let sig = this.web3.eth.abi.encodeEventSignature(abis[contractType][idx]);
					sig = sig.slice(2).toLowerCase(); // Remove 0x and force lowercase jic

					if (input.indexOf(sig) === -1) {
						verbose && log.debug(contractType + " event: " + abis[contractType][idx].name, ": NOT FOUND");
						matches.splice(matches.indexOf(contractType), 1);
						break contract_standard;
					} else {
						verbose && log.debug(contractType + " event: " + abis[contractType][idx].name, ": FOUND");
					}
				}
			}
		}

		return matches;
	}

	async determineStandardByCall(address, verbose = false) {
		let web3 = await this.getWeb3();

		// Keep track of potential matches
		let matches = abiCfg.contracts.slice();

		for (let standard in abiCfg.abis) {
			if (!abiCfg.abis.hasOwnProperty(standard)) continue;

			const abi = abiCfg.abis[standard];

			// Determine if we have a name function
			const contract = new web3.eth.Contract(abi, address);

			// Determine which callable functions we're reviewing
			const callables = abiCfg.callableFunctions[standard];

			callable_loop:
			for (let call in callables) {
				if (!callables.hasOwnProperty(call)) continue;

				try {
					let res = await contract.methods[call](...callables[call]).call();
					verbose && log.debug(`Received result for ${call}: ${res}`);

					if (call === 'supportsInterface' && res === false) {
						matches.splice(matches.indexOf(standard), 1);
						break callable_loop;
					}
				} catch (ex) {
					verbose && log.debug(`Could not retrieve call ${call} for ${address}`);
					matches.splice(matches.indexOf(standard), 1);
					break callable_loop;
				}
			}
		}

		return matches;
	}
}

module.exports = ContractIdentifier;

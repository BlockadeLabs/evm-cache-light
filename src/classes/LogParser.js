const log = require('loglevel');
const Web3 = require('web3');
const abiCfg = require('../config/abi.js');
const Database = require('../database/Database.js');
const TransactionQueries = require('../database/queries/TransactionQueries.js');
const ContractQueries = require('../database/queries/ContractQueries.js');
const byteaBufferToHex = require('../util/byteaBufferToHex.js');

class LogParser {
	constructor() {
		this.web3 = new Web3();
	}

	decodeLogs(txLogs) {
		let decodedLogs = {};
		for (let txLog of txLogs) {
			let event = this.decodeLog(
				txLog.abi,
				txLog.standard,
				byteaBufferToHex(txLog.data),
				this.pullTopics(txLog)
			);

			if (event) {
				decodedLogs[txLog.log_id] = event;
				decodedLogs[txLog.log_id].contract_address = txLog.address;
			}
		}

		return decodedLogs;
	}

	pullTopics(txLog) {
		let topics = [];
		if (txLog.topics && txLog.topics.length) return txLog.topics;
		if (txLog.topic_0) topics.push(byteaBufferToHex(txLog.topic_0));
		if (txLog.topic_1) topics.push(byteaBufferToHex(txLog.topic_1));
		if (txLog.topic_2) topics.push(byteaBufferToHex(txLog.topic_2));
		if (txLog.topic_3) topics.push(byteaBufferToHex(txLog.topic_3));
		return topics;
	}

	pullEventSignatures(abi) {
		// Pull all event signatures
		let eventSignatures = {};

		for (let f of abi) {
			if (f.type === 'event') {
				eventSignatures[f.name] = this.web3.eth.abi.encodeEventSignature(f);
			}
		}

		return eventSignatures;
	}

	decodeLog(abi, standard, data, topics) {
		let signatures = {};
		if (abi && typeof abi === 'object' && Object.keys(abi).length > 0) {
			// ABI
			signatures = this.pullEventSignatures(abi);
		} else if (typeof standard === 'string' && standard.length) {
			// Standard
			signatures = abiCfg.eventSignatures[standard];
			abi = abiCfg.abis[standard];
		} else {
			// Nothing to use
			log.debug("No valid ABI or standard provided to decode log.");
			return;
		}

		// Determine the topic we're dealing with
		for (let event in signatures) {
			if (!signatures.hasOwnProperty(event)) continue;
			if (topics.indexOf(signatures[event]) !== -1) {
				//log.info(`Identified event: ${event}`);

				let json = abiCfg.getEventJson(abi, event);
				let inputs = json.inputs;

				// Remove topics[0] from non-anonymous events
				// https://web3js.readthedocs.io/en/v1.2.0/web3-eth-abi.html#decodelog
				if (json.anonymous === false) {
					topics.shift();
				}

				try {
					let result = this.trimDecodedLogResult(
						inputs, this.web3.eth.abi.decodeLog(inputs, data, topics)
					);

					return {
						name : event,
						result
					};
				} catch (ex) {
					log.error(`Exception at decoding log, expected event: ${event}`);
					return;
				}
			}
		}
	}

	trimDecodedLogResult(inputs, result) {
		let cleanResult = {};

		for (let input of inputs) {
			if (result.hasOwnProperty(input.name)) {
				cleanResult[input.name] = result[input.name];
			}
		}

		return cleanResult;
	}

}

module.exports = LogParser;

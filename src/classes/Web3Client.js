const Web3 = require('web3');
const log  = require('loglevel');

class Web3Client {
	constructor(config) {
		this.web3      = null;
		this.endpoints = config.hasOwnProperty('endpoints') ? config.endpoints : [config.endpoint];

		// Keep track of current node endpoint
		this.endpointIdx = 0;

		// Connect off the bat
		this.connect();
	}

	connect() {
		let provider = this.endpoints[this.endpointIdx % this.endpoints.length];
		if (provider.indexOf('ws://') !== -1 || provider.indexOf('wss://') !== -1) {
			provider = new Web3.providers.WebsocketProvider(provider, {timeout: 1500, clientConfig:{ maxReceivedFrameSize: 10000000000, maxReceivedMessageSize: 10000000000}});
		} else {
			provider = new Web3.providers.HttpProvider(provider, {timeout: 1500, clientConfig:{ maxReceivedFrameSize: 10000000000, maxReceivedMessageSize: 10000000000}});
		}

		this.web3 = new Web3(provider);
	}

	getWeb3() {
		return this.web3;
	}

	getBlock(blockHashOrNumber = "latest", callback = null) {
		return this.web3.eth.getBlock(blockHashOrNumber, true, callback);
	}

	getTransactionReceipt(txHash, callback = null) {
		return this.web3.eth.getTransactionReceipt(txHash, callback);
	}

	cycleNodes() {
		// Move to the next node
		this.endpointIdx = (this.endpointIdx + 1) % this.endpoints.length;

		log.warn(`-> Cycling node to ${this.endpoints[this.endpointIdx]}`);

		// Reconnect
		this.connect();
	}
}

module.exports = Web3Client;

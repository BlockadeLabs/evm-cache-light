const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
let argv = yargs(hideBin(process.argv)).option('address', {type: 'string'}).parse();

const abiCfg = require('../config/abi.js');
const log = require('loglevel');
const Database = require(__dirname + '/../database/Database.js');
const BlockchainQueries = require(__dirname + '/../database/queries/BlockchainQueries.js');
const Web3Client = require(__dirname + '/../classes/Web3Client.js');
const ContractIdentifier = require(__dirname + '/../classes/ContractIdentifier.js');

if (
	!argv.hasOwnProperty('address')
) {
	log.error("Missing information:");
	log.error("\t--address [address]");
	process.exit(1);
}

const address = argv.address;

Database.connect((Client) => {
	Client.query(BlockchainQueries.getBlockchainsAndNodes(), (result) => {
		Client.release();

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
		let client = new Web3Client({
			"endpoint" : node.endpoint
		});

		log.debug("Looking for earliest event for address", address);

		const ci = new ContractIdentifier();
		ci.determineStandard(address, async (res) => {

			if (!res || !res.standard) {
				log.error("Contract standard could not be identified.");
				process.exit(1);
			}

			const abi = abiCfg.abis[res.standard];

			const web3 = client.getWeb3();
			const contract = new web3.eth.Contract(abi, address);

			const maxBlock = await web3.eth.getBlockNumber();
			const BLOCK_COUNTER = 1000;

			let eventsCount = 0;

			for (let fromBlock = 7357000; fromBlock < maxBlock; fromBlock += BLOCK_COUNTER) {
				let toBlock = fromBlock + BLOCK_COUNTER - 1;

				let res = await contract.getPastEvents('allEvents', {
					fromBlock: fromBlock,
					toBlock: toBlock
				});

				eventsCount += res.length;

				console.log(eventsCount, "by block", toBlock);
			}

		});

	});
});

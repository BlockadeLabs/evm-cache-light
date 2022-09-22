const argv = require('yargs').argv;
const log = require('loglevel');
const Web3Client = require('./src/classes/Web3Client.js');
const Database = require('./src/database/Database.js');
const BlockchainQueries = require('./src/database/queries/BlockchainQueries.js');
const ContractController = require('./src/controller/ContractController.js');

const LIMIT = 50;

Database.connect(async (Client) => {

	// Kick it off
	Client.query(BlockchainQueries.getBlockchainsAndNodes(), (result) => {
		// Kill the client
		Client.release();

		if (!result || !result.rowCount) {
			log.error('No blockchain nodes found in database.');
			process.exit();
		}

		// Get all of the endpoint nodes for this blockchain
		let nodeSetups = {};
		for (let row of result.rows) {
			if (!nodeSetups.hasOwnProperty(row.blockchain_id)) {
				nodeSetups[row.blockchain_id] = [];
			}

			nodeSetups[row.blockchain_id].push(row.endpoint);
		}

		for (let blockchain_id in nodeSetups) {
			// Create a new monitor instance
			const evmClient = new Web3Client({
				"endpoints" : nodeSetups[blockchain_id]
			});

			// Now do the whole thing
			const cc = new ContractController(evmClient);
			cc.iterateMetadataUpdates(LIMIT, callback);

			function callback(numUpdated) {
				if (numUpdated > 0) {
					console.log("More metadata to update:", numUpdated);
					cc.iterateMetadataUpdates(LIMIT, callback);
				} else {
					console.log("No metadata to update, waiting...");
					setTimeout(cc.iterateMetadataUpdates.bind(cc, LIMIT, callback), 5000);
				}
			}

			log.debug(`Spun up metadata monitor for blockchain ID: ${blockchain_id}`);
		}

		log.debug("Started metadata monitors.");
	});

});

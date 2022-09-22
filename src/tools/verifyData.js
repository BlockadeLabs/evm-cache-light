const argv = require('yargs').argv;
const log = require('loglevel');
const Database = require(__dirname + '/../database/Database.js');
const BlockchainQueries = require(__dirname + '/../database/queries/BlockchainQueries.js');
const Web3Client = require(__dirname + '/../classes/Web3Client.js');
const DataVerifier = require(__dirname + '/../classes/DataVerifier.js');

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

		// Allow the user to set overrides
		let startBlockOverride = argv.hasOwnProperty('start') && parseInt(argv.start, 10);
		let endBlockOverride   = argv.hasOwnProperty('end')   && parseInt(argv.end, 10);

		// Start the monitor
		let dv = new DataVerifier({
			blockchain_id : node.blockchain_id,
			client,
			startBlockOverride,
			endBlockOverride
		});

		dv.start();

		log.debug("Started data verifier.");
	});
});

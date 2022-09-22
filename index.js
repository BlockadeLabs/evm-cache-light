const argv = require('yargs').argv;
const log = require('loglevel');
const db = require('./src/database/Database.js');
const BlockchainQueries = require('./src/database/queries/BlockchainQueries.js');
const Web3Client = require('./src/classes/Web3Client.js');
const CacheMonitor = require('./src/monitor/CacheMonitor.js');

let pool = db.getPool();
pool.connect((err, client, release) => {
	if (err) {
		log.error('Error acquiring client', err.stack);
		process.exit(1);
	}

	client.query(BlockchainQueries.getBlockchainsAndNodes(), (err, result) => {
		release();
		if (err) {
			log.error('Error executing query', err.stack);
			process.exit(1);
		}

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

			if (row.hasOwnProperty('skip') && row.skip === true) {
				console.log(`Skipping ${row.endpoint}`)
				continue;
			}

			nodeSetups[row.blockchain_id].push(row.endpoint);
		}

		for (let blockchain_id in nodeSetups) {
			// Create a new monitor instance
			let client = new Web3Client({
				"endpoints" : nodeSetups[blockchain_id]
			});

			// Allow the user to set overrides
			let startBlockOverride = argv.hasOwnProperty('start') && parseInt(argv.start, 10);
			let endBlockOverride   = argv.hasOwnProperty('end')   && parseInt(argv.end, 10);
			let rewriteBlocks      = argv.hasOwnProperty('rewriteBlocks');

			if (rewriteBlocks) {
				log.info("Will be force-rewriting all blocks encountered.");
			}

			// Start the monitor
			let cm = new CacheMonitor({
				blockchain_id : blockchain_id,
				client,
				startBlockOverride,
				endBlockOverride,
				rewriteBlocks
			});

			cm.start();

			log.debug(`Spun up client monitor for blockchain ID: ${blockchain_id}`);
		}

		log.debug("Started client monitors.");
	});
});

const argv = require('yargs').argv;
const log = require('loglevel');
const db = require('../database/Database.js');
const BlockchainQueries = require('../database/queries/BlockchainQueries.js');

if (
	!argv.hasOwnProperty('type') ||
	!argv.hasOwnProperty('name') ||
	!argv.hasOwnProperty('endpoint')
) {
	log.error("Missing information to add a blockchain to the database:");
	log.error("\tnode addBlockchain.js --type [blockchain-type] --name [name] --endpoint [endpoint]");
	process.exit(1);
}

let type = argv.type;
let name = argv.name;
let endpoint = argv.endpoint;

let pool = db.getPool();
pool.connect((err, client, release) => {
	if (err) {
		log.error('Error acquiring client', err.stack);
		process.exit(1);
	}

	client.query(BlockchainQueries.addBlockchain(type, name), (err, result) => {
		if (err) {
			log.error('Error executing query', err.stack);
			process.exit(1);
		}

		client.query(BlockchainQueries.addBlockchainNode(name, endpoint), (err, result) => {
			release();
			if (err) {
				log.error('Error executing query', err.stack);
				process.exit(1);
			}

			log.info("Done.");
			process.exit();
		});
	});
});

const argv = require('yargs').argv;
const log = require('loglevel');
const Database = require(__dirname + '/../database/Database.js');
const DeleteQueries = require(__dirname + '/../database/queries/DeleteQueries.js');

if (!argv.hasOwnProperty('start') || !argv.hasOwnProperty('end')) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode deleteBlocks.js --blockchain_id [blockchain ID] --start [start block number] --end [end block number (exclusive)]");
	process.exit(1);
}

let blockchain_id = parseInt(argv.blockchain_id, 10);
let start_number  = parseInt(argv.start, 10);
let end_number    = parseInt(argv.end, 10);

if (start_number === end_number || end_number <= 1) {
	log.error('Invalid start and end blocks');
	process.exit(1);
}

Database.connect(async (Client) => {
	let BLOCKSIZE = 1;
	for (let curr_end = end_number; curr_end >= start_number; curr_end -= BLOCKSIZE) {
		let curr_start = Math.max(start_number, curr_end - BLOCKSIZE);
		console.log("Sifting between blocks", curr_start, "and", curr_end, " --", ((end_number - curr_end) / (end_number - start_number))*100, "% Done" );
		await Client.query(DeleteQueries.deleteLogsAndDependents(blockchain_id, curr_start, curr_end));
		await Client.query(DeleteQueries.deleteTransactions(blockchain_id, curr_start, curr_end));
		await Client.query(DeleteQueries.deleteBlocks(blockchain_id, curr_start, curr_end));
	}
	Client.release();
	process.exit();
});

const argv = require('yargs').argv;
const log = require('loglevel');
const Database = require(__dirname + '/../database/Database.js');

if (!argv.hasOwnProperty('start')) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode updateLogSetBlockNumber.js --start [start block number]");
	process.exit(1);
}

let start_number = parseInt(argv.start, 10) || 0;

Database.connect(async (Client) => {
	// Get the last block number to review
	let res = await Client.query(`SELECT MAX(number) as max_block FROM block;`);
	let end_number = res && res.rows && res.rows[0] && parseInt(res.rows[0].max_block, 10);

	if (!end_number) {
		console.error("Could not retrieve max block");
		process.exit(1);
	}

	const PROMISE_SIZE = 20;

	for (let current_block_number = start_number; current_block_number <= end_number; current_block_number+=PROMISE_SIZE) {
		if (current_block_number % (PROMISE_SIZE * 10) < PROMISE_SIZE) {
			console.log("At block", current_block_number, "of", end_number, "--", ((current_block_number - start_number) / (end_number - start_number))*100, "% Done");
		}

		// Queue up all of the tasks
		let promises = [];

		let promise_block_number = current_block_number;
		do {
			promises.push(
				Client.query({
					text : `
						UPDATE log
						SET block_number = sq.block_number
						FROM (
							SELECT
								l.log_id,
								b.number AS block_number
							FROM
								block b
							JOIN
								transaction t ON t.block_hash = b.hash
							JOIN
								log l ON l.transaction_hash = t.hash
							WHERE
								b.number = $1
						) AS sq
						WHERE sq.log_id = log.log_id;
					`,
					values : [
						promise_block_number
					]
				})
			);
		}
		while (promise_block_number++ < current_block_number + PROMISE_SIZE);

		await Promise.all(promises);
		//process.exit(1);
	}

	Client.release();
	process.exit();
});

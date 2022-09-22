const argv = require('yargs').argv;
const log = require('loglevel');
const ContractController = require(__dirname + '/../controller/ContractController.js');

if (!argv.hasOwnProperty('log_limit') ||
	!argv.hasOwnProperty('address')
) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode backfillContractLogsByLogs.js\n\t--log_limit [number of logs to search]\n\t--address [contract address]\n\t(optional) --start [log ID number]")
	process.exit(1);
}

(async (address, log_limit, start = null) => {
	const cc = new ContractController();
	cc.backfillContractLogsByLogs(address, log_limit, start, () => {
		console.log("Done.");
		process.exit();
	});
})(argv.address, argv.log_limit, argv.start);

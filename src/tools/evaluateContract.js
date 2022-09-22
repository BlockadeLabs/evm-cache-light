const argv = require('yargs').argv;
const log = require('loglevel');
const ContractIdentifier = require(__dirname + '/../classes/ContractIdentifier.js');

if (!argv.hasOwnProperty('address')) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode evaluateContract.js --address [contract address]")
	process.exit(1);
}

(async (address) => {
	const ci = new ContractIdentifier();
	ci.determineStandard(address, (res) => {
		console.log("Matches for", res.address, res.code_results, res.call_results);
		process.exit();
	});
})(argv.address);

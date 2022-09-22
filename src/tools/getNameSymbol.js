const argv = require('yargs').argv;
const log = require('loglevel');
const ContractIdentifier = require(__dirname + '/../classes/ContractIdentifier.js');

if (!argv.hasOwnProperty('address')) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode getNameSymbol.js --address [contract address]")
	process.exit(1);
}

(async (address) => {
	const ci = new ContractIdentifier();
	ci.getNameSymbol(address, (res) => {
		console.log("Name and symbol for", res.address, res.name, res.symbol);
		process.exit();
	});
})(argv.address);

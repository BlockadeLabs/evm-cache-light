const argv = require('yargs').argv;
const log = require('loglevel');
const ContractController = require(__dirname + '/../controller/ContractController.js');

if (!argv.hasOwnProperty('address')) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode refreshContractTokensMetadata.js\n\t--address [contract address]");
	process.exit(1);
}

(async (address, custom_data = null) => {
	const cc = new ContractController();
	cc.enqueueAllContractTokenMetadata(address, () => {
		console.log("Done.");
		process.exit();
	});
})(
	String(argv.address)
);

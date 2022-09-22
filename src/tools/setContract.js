const argv = require('yargs').argv;
const log = require('loglevel');
const ContractController = require(__dirname + '/../controller/ContractController.js');

if (!argv.hasOwnProperty('address')) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode setContract.js\n\t--address [contract address]\n\t(optional)--abi [contract abi string]\n\t(name)--name [custom name]")
	process.exit(1);
}

(async (address, abi = null, name = null) => {
	let data = {
		'custom_name' : name
	};

	const cc = new ContractController();
	cc.setContractMetadata(address, abi, data, () => {
		console.log("Done.");
		process.exit();
	});
})(argv.address, argv.abi, argv.name);

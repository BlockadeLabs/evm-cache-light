const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).option('address', {type: 'string'}).parse();

const log = require('loglevel');
const ContractController = require(__dirname + '/../controller/ContractController.js');

if (!argv.hasOwnProperty('address')) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode setContract.js\n\t--address [contract address]\n\t(optional)--abi [contract abi string]\n\t(name)--name [custom name]\n\t(optional) --token_uri_json_interface [custom token uri contract method]\n\t(optional) --token_uri_json_interface_parameters [custom token uri contract method parameter mapping]");
	process.exit(1);
}

(async (address, abi = null, name = null) => {
	let data = {
		'custom_name'                         : name,
		'token_uri_json_interface'            : argv.token_uri_json_interface,
		'token_uri_json_interface_parameters' : argv.token_uri_json_interface_parameters
	};

	const cc = new ContractController();
	cc.setContractMetadata(address, abi, data, () => {
		console.log("Done.");
		process.exit();
	});
})(argv.address, argv.abi, argv.name);

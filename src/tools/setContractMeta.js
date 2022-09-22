const argv = require('yargs').argv;
const log = require('loglevel');
const ContractController = require(__dirname + '/../controller/ContractController.js');

if (!argv.hasOwnProperty('address')) {
	log.error("Incorrect arguments for tool:");
	log.error("\tnode setContractMeta.js\n\t--address [contract address]\n\t(optional) --name [custom name]\n\t(optional) --token_uri_json_interface [custom token uri contract method]\n\t(optional) --token_uri_json_interface_parameters [custom token uri contract method parameter mapping]")
	process.exit(1);
}

(async (address, custom_data = null) => {
	const cc = new ContractController();
	cc.setContractCustom(address, custom_data, () => {
		console.log("Done.");
		process.exit();
	});
})(
	argv.address,
	{
		'custom_name'                         : argv.name,
		'token_uri_json_interface'            : argv.token_uri_json_interface,
		'token_uri_json_interface_parameters' : argv.token_uri_json_interface_parameters
	}
);

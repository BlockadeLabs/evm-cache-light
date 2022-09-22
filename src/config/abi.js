// Requirements
const fs = require('fs');
const web3 = new (require('web3'))();

const abis = {
	'erc20'   : JSON.parse(fs.readFileSync(__dirname + "/abi/v0/erc20.json", 'utf8')),
	//'erc165'  : JSON.parse(fs.readFileSync(__dirname + "/abi/v0/erc165.json", 'utf8')),
	'erc721'  : JSON.parse(fs.readFileSync(__dirname + "/abi/v0/erc721.json", 'utf8')),
	'erc1155' : JSON.parse(fs.readFileSync(__dirname + "/abi/v0/erc1155.json", 'utf8'))
};

const supplemental_abis = {
	'erc1155-uri' : JSON.parse(fs.readFileSync(__dirname + "/abi/v0/erc1155-metadata-uri.json", 'utf8'))
};

let events = {
	'erc20' : [
		'Transfer',
		'Approval'
	],
	'erc721' : [
		'Transfer',
		'Approval',
		'ApprovalForAll'
	],
	'erc1155' : [
		'TransferSingle',
		'TransferBatch',
		'ApprovalForAll',
		'URI'
	]
};

let functions = {
	'erc20' : [
		'balanceOf',
		'transfer',
		'transferFrom', // Missing from some older erc-20 contracts
		'approve',
		'totalSupply'
	],
	'erc721' : [
		'balanceOf',
		'ownerOf',
		'safeTransferFrom',
		'transferFrom',
		'approve',
		'setApprovalForAll',
		'getApproved',
		'isApprovedForAll'
	],
	'erc1155' : [
		'safeTransferFrom',
		'safeBatchTransferFrom',
		//'balanceOf', // Failing, for some reason
		'balanceOfBatch',
		'setApprovalForAll',
		'isApprovedForAll'
	]
};

let callableFunctions = {
	'erc20' : {
		'name' : [],
		'symbol' : [],
		'decimals' : [],
		'totalSupply' : []
	},
	'erc721' : {
		'supportsInterface' : ['0x80ac58cd']
	},
	'erc1155' : {
		'supportsInterface' : ['0xd9b67a26']
	}
};

// Pull all event signatures
let eventSignatures = {
	'erc20'   : {},
	'erc721'  : {},
	'erc1155' : {}
};

for (let contract in events) {
	if (!events.hasOwnProperty(contract)) continue;
	for (let event of events[contract]) {
		let eventJson = getEventJson(abis[contract], event);
		eventSignatures[contract][event] = web3.eth.abi.encodeEventSignature(eventJson);
	}
}

function getEventJson(abi, event) {
	for (let f of abi) if (f.type === 'event' && f.name === event) return f;
}

module.exports = {
	contracts : Object.keys(abis),
	abis,
	supplemental_abis,
	events,
	functions,
	callableFunctions,
	eventSignatures,
	getEventJson
};

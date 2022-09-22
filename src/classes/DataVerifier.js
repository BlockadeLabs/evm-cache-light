const log   = require('loglevel');
const sleep = require('../util/sleep.js');
const Database = require('../database/Database.js');

const BlockQueries = require('../database/queries/BlockQueries.js');

class CacheMonitor {
	constructor(options) {
		this.blockchain_id = options.blockchain_id;
		this.evmClient = options.client;
		this.startBlockOverride = options.startBlockOverride;
		this.endBlockOverride = options.endBlockOverride;
		this.client = null; // Covered in start()
	}

	async start() {
		let start_number;
		if (this.startBlockOverride !== false) {
			start_number = this.startBlockOverride;
			log.info("Using start block number override:", start_number);
		} else {
			start_number = 0;
			log.info("No start block, starting at 0");
		}

		this.verifyBlock(start_number);
	}

	async verifyBlock(block_number) {
		if (this.endBlockOverride !== false && block_number >= this.endBlockOverride) {
			log.info("Reached endBlockOverride:", this.endBlockOverride);
			process.exit();
		}

		// Start by verifying the transaction counts
		this.evmClient.getWeb3().eth.getBlockTransactionCount(block_number, async (err, count) => {
			if (block_number % 1000 === 0) {
				log.info(`At block #${block_number}`);
			}

			Database.connect((Client) => {
				Client.query(BlockQueries.getBlockTransactionCount(this.blockchain_id, block_number), (result) => {
					Client.release();

					let dbcount = parseInt(result.rows[0].count || -1, 10);
					if (count !== dbcount) {
						log.info(`Mismatch from database at block ${block_number}, web3 = ${count}, db = ${dbcount}`);
					}

					this.verifyBlock(block_number+1);
				});
			});
		});
	}
}

module.exports = CacheMonitor;

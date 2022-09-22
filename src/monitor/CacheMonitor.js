const log = require('loglevel');
const config = require('../config/config.js');
const Database = require('../database/Database.js');
const sleep = require('../util/sleep.js');
const byteaBufferToHex = require('../util/byteaBufferToHex.js');

const BlockQueries = require('../database/queries/BlockQueries.js');
const TransactionQueries = require('../database/queries/TransactionQueries.js');
const ContractQueries = require('../database/queries/ContractQueries.js');

const ContractController = require('../controller/ContractController.js');

const { performance } = require('perf_hooks');

class CacheMonitor {
	constructor(options) {
		this.blockchain_id = options.blockchain_id;
		this.evmClient = options.client;
		this.startBlockOverride = options.startBlockOverride;
		this.endBlockOverride = options.endBlockOverride;
		this.rewriteBlocks = options.rewriteBlocks === true;
		this.Client = null; // Covered in start()

		this.reviewBlockLimit = config.REVIEW_BLOCK_LIMIT;
		this.comprehensiveReviewBlockLimit = config.COMPREHENSIVE_REVIEW_BLOCK_LIMIT;
		this.comprehensiveReviewCounter = 0;
		this.comprehensiveReviewCountMod = 250;

		this.timeoutID;
		this.timeoutMs = 30000;

		this.cc = new ContractController(this.evmClient);

		this.contractMetaAddresses = [];
	}

	async start() {
		Database.connect((Client) => {
			Client.query(ContractQueries.getContractAddresses(), async (result) => {

				this.contractMetaAddresses = result.rows.map((row) => byteaBufferToHex(row.address).toLowerCase());

				Client.query(BlockQueries.getLatestBlock(this.blockchain_id), async (result) => {
					this.Client = Client;

					let latest_number;
					if (this.startBlockOverride !== false) {
						latest_number = this.startBlockOverride;
						log.info("Using start block number override:", latest_number);
					} else if (!result || !result.rowCount) {
						latest_number = 0;
						log.info("No latest block, starting at 0");
					} else {
						// Rerun the current latest number - see truncate below
						latest_number = parseInt(result.rows[0].number, 10);
						log.info("Retrieved latest block:", latest_number);
					}

					// First we're going to truncate everything related to the current block
					// so we can stop and start without missing data in-between
					await this.flushBlock(latest_number);

					this.mainLoop(latest_number);
				});
			});
		});
	}

	async flushBlock(block_number, verbose = true) {
		log.info("Flushing", block_number);

		await this.Client.query(TransactionQueries.deleteLogs(
			this.blockchain_id,
			block_number
		));

		if (verbose) {
			log.info("Logs deleted, cascading to events and related tables");
		}

		await this.Client.query(TransactionQueries.deleteTransactions(
			this.blockchain_id,
			block_number
		));

		if (verbose) {
			log.info("Transactions deleted");
		}

		await this.Client.query(BlockQueries.deleteBlock(
			this.blockchain_id,
			block_number
		));

		log.info("Completed flushing", block_number);
	}

	async mainLoop(block_number) {
		let ml_a_perf = performance.now();

		// If we timeout, then kill the process
		if (this.timeoutID) {
			clearTimeout(this.timeoutID);
		}
		this.timeoutID = setTimeout(() => { log.error("-- Timeout reached, kill process --"); process.exit(1); }, this.timeoutMs);

		// TODO -- wait to see this issue come up again
		// Handle any stuck SQL calls here
		//await this.killStuckSqlCalls();

		if (this.endBlockOverride !== false && block_number >= this.endBlockOverride) {
			log.info("Reached endBlockOverride:", this.endBlockOverride);
			process.exit();
		}

		if (this.rewriteBlocks === true) {
			await this.flushBlock(block_number, false);
		}

		this.getBlock(block_number, {
			'atBlockchainHead' : async (block_number) => {

				// Keep track of any changed blocks
				let changedBlocks = [], waitingBlocks = 0;

				log.info(`Performing a routine review of the last ${this.reviewBlockLimit} blocks.`);

				for (
					let prior_block_number = block_number - this.reviewBlockLimit;
					prior_block_number < block_number - 1;
					prior_block_number++
				) {
					waitingBlocks++;

					this.getBlock.call(this, prior_block_number, {
						'foundDuringReviewBlock' : async (reviewed_block_number, block_hash) => {
							log.info(`* Found new previous block at number ${reviewed_block_number}: ${block_hash}`);
						},
						'blockReviewResponse' : async(reviewed_block_number, is_changed, callback = () => {}) => {
							if (is_changed) {
								log.info(`** Adding changed block ${reviewed_block_number}`);
								changedBlocks.push({
									block: reviewed_block_number,
									callback: callback
								});
							}

							// Reduce the number of blocks in waiting
							waitingBlocks--;

							//log.info(`Remaining waiting blocks: ${waitingBlocks}`);

							// If we've hit zero, return to main loop
							if (waitingBlocks == 0) {
								if (changedBlocks.length) {
									changedBlocks.sort((a, b) => { if (a.block < b.block) return -1; return 1; })

									log.info(`** Reviewing all changed blocks **`);

									for (let pair of changedBlocks) {
										log.info(`** Reviewing block ${pair.block}`);
										await pair.callback();
									}
								} else {
									// Wait before checking for the next block
									await sleep(config.BLOCK_HEAD_WAIT_TIME);
								}

								// Try this block again
								return this.mainLoop(parseInt(block_number, 10));
							}
						}
					});
				}
			},
			'blockAlreadyExists' : async (block_number, block_hash) => {
				// Move to the next block
				log.info(`Block with hash ${block_hash} found, skipping.`);
				this.mainLoop(parseInt(block_number, 10) + 1);
			},
			'moveToNextBlock' : async (block_number) => {
				log.debug("mainLoop:", performance.now() - ml_a_perf, "ms");

				// Move to the next block
				this.mainLoop(parseInt(block_number, 10) + 1);
			}
		});
	}

	async getBlock(block_number, callbacks = {}) {
		// Lock and key to prevent multiple callback hell
		let localErrorRecovered = false;

		this.evmClient.getBlock(block_number, async (err, block, t1, t2, t3) => {
			if (err) {
				// Don't call back on errors
				if (callbacks.hasOwnProperty('blockReviewResponse')) {
					callbacks.blockReviewResponse.call(this, block_number, false);
				}

				// If we get an invalid JSON RPC response, the node is down, cycle to the next one
				if (
					String(err).indexOf('Invalid JSON RPC response') !== -1 ||
					String(err).toUpperCase().indexOf('CONNECTION TIMEOUT') !== -1
				) {
					if (!localErrorRecovered) {
						// Gate the cycle & mainloop from happening a second time
						localErrorRecovered = true;

						log.error("** JSON RPC or connection timeout failure in CacheMonitor::getBlock, cycling to next node **");

						// Cycle to the next node...
						this.evmClient.cycleNodes();

						// And try again
						return this.mainLoop(parseInt(block_number, 10));
					} else {

						// For debugging
						log.error("** Received duplicate local timeout or JSON RPC error, already cycled **");

						return;
					}
				} else {
					// Print the error
					log.error("Unknown error:", err);

					// Sleep a bit before we fail out, because this can cause a death spiral of removing blocks
					await sleep(2500);
					process.exit(1);
				}
			} else if (!block) {
				if (callbacks.hasOwnProperty('atBlockchainHead')) {
					callbacks.atBlockchainHead.call(this, block_number);
				}

				// This is fine
				if (callbacks.hasOwnProperty('blockReviewResponse')) {
					callbacks.blockReviewResponse.call(this, block_number, false);
				}

				return;
			}

			// Make sure that we haven't already stored this block & make sure tx count is valid
			let checkRes = await this.Client.query(BlockQueries.getBlockByHash(
				this.blockchain_id, block.hash
			));

			if (checkRes && checkRes.rowCount) {
				// Default, not a changed block, on review
				let is_changed = false;

				if (block.transactions.length === parseInt(checkRes.rows[0].transaction_count, 10)) {
					// Block transactions are valid for this hash, but what about the number as a whole?
					// This handles previous blocks at this height that have been uncled
					let numCheckRes = await this.Client.query(BlockQueries.getBlockTransactionCount(
						this.blockchain_id, block_number
					));

					if (numCheckRes && numCheckRes.rowCount && block.transactions.length === parseInt(numCheckRes.rows[0].count, 10)) {
						// Everything is in order, ignore and move on
						if (callbacks.hasOwnProperty('blockAlreadyExists')) {
							callbacks.blockAlreadyExists.call(this, block_number, block.hash);
						}
					} else {
						log.info(`At block #${block_number}, found stale transactions. Previous transaction count: ${numCheckRes.rows[0].count}, expected: ${block.transactions.length}`);

						// Stale
						is_changed = true;

						// There are stale blocks at this height, let's start fresh
						//storeBlockAssocData.call(this, block);
					}
				} else {
					// Alternatively, just taking whatever the current head is in the database
					// should give us all the information we need, unless we have an attack that
					// reorgs beyond the regular number of blocks within a given timeframe
					log.info(`At a re-instated block, #${block_number}, restoring data. Previous transaction count: ${checkRes.rows[0].transaction_count}, expected: ${block.transactions.length}`);

					// Stale
					is_changed = true;

					// Go ahead and store all of the data all over again, which
					// migrates any moved data back to the de-facto block
					//storeBlockAssocData.call(this, block);
					if (!callbacks.hasOwnProperty('blockReviewResponse')) {
						storeBlockAssocData.call(this, block);
					}
				}

				// Need to come back to this
				if (callbacks.hasOwnProperty('blockReviewResponse')) {
					callbacks.blockReviewResponse.call(this, block_number, is_changed, storeBlockAssocData.bind(this, block));
				}

				// Stop here.
				return;

			} else {
				if (callbacks.hasOwnProperty('foundDuringReviewBlock')) {
					callbacks.foundDuringReviewBlock.call(this, block_number, block.hash);
				} else {
					log.info(`Found new block at #${block.number}`);
				}
			}

			// Save the block
			this.Client.query(BlockQueries.addBlock(
				this.blockchain_id,
				block.number,
				block.hash,
				block.parentHash,
				block.gasLimit,
				block.gasUsed,
				block.timestamp,
				block.miner,
				block.difficulty,
				block.size
			), async (result) => {
				if (!result || !result.rowCount) {
					this.Client.release();
					log.error('No result returned for');
					log.error(block);
					log.error('^^ No result returned ^^');
					process.exit(1);
				}

				// Need to come back to this
				if (callbacks.hasOwnProperty('blockReviewResponse')) {
					callbacks.blockReviewResponse.call(this, block_number, true, storeBlockAssocData.bind(this, block));
				} else {
					storeBlockAssocData.call(this, block);
				}
			});
		});

		async function storeBlockAssocData(block) {
			let st_a_perf = performance.now();

			// Queue up all of the tasks
			let promises = [];

			// Use a transaction for all of the promises
			await this.Client.query('BEGIN;');

			// Delete all associated data at this number prior to adding data
			// We do this because some transactions are replaced by new transactions with
			// the same nonce, but higher gas prices -- so they aren't replaced automatically
			await this.Client.query(TransactionQueries.deleteLogs(
				this.blockchain_id,
				block.number
			));

			await this.Client.query(TransactionQueries.deleteTransactions(
				this.blockchain_id,
				block.number
			));

			if (block.transactions && block.transactions.length) {
				promises.push(this.addTransactions(block.hash, block.transactions));
			}

			try {

				let values = await Promise.all(promises);

				// Commit the transaction for all of the promises
				await this.Client.query('COMMIT;');

				log.debug("storeBlockAssocData:", performance.now() - st_a_perf, "ms");

				if (callbacks.hasOwnProperty('moveToNextBlock')) {
					callbacks.moveToNextBlock.call(this, block.number);
				}

				return;
			} catch (error) {
				// Rollback the transaction for all of the promises
				await this.Client.query('ROLLBACK;');

				// If we get an invalid JSON RPC response, the node is down, cycle to the next one
				if (
					String(error).indexOf('Invalid JSON RPC response') !== -1 ||
					String(error).toUpperCase().indexOf('CONNECTION TIMEOUT') !== -1
				) {
					log.error("** JSON RPC or connection timeout failure in CacheMonitor::storeBlockAssocData, cycling to next node **");

					// Cycle to the next node...
					this.evmClient.cycleNodes();

					// And try again
					return this.mainLoop(parseInt(block_number, 10));
				}

				await sleep(1000);
				log.error('Promises failed for retrieving all block data');
				log.error(`Error: ${error}`);
				process.exit(1);
			}
		}
	}

	async captureWatchedTransactions(input_transactions, input_receipts) {
		let transactions = [], receipts = [];

		for (let idx in input_transactions) {
			let input_transaction = input_transactions[idx];
			let input_receipt = input_receipts[idx];

			// If on the transaction level, store and back out
			if (
				input_transaction.to && this.contractMetaAddresses.indexOf(input_transaction.to.toLowerCase()) !== -1 ||
				this.contractMetaAddresses.indexOf(input_transaction.from.toLowerCase()) !== -1 ||
				(input_receipt.contractAddress && this.contractMetaAddresses.indexOf(input_receipt.contractAddress.toLowerCase()) !== -1)
			) {
				transactions.push(input_transaction);
				receipts.push(input_receipt);
				continue;
			}

			for (let log of input_receipt.logs) {
				if (
					this.contractMetaAddresses.indexOf(log.address.toLowerCase()) !== -1
				) {
					transactions.push(input_transaction);
					receipts.push(input_receipt);
					break;
				}
			}
		}

		return {
			transactions,
			receipts
		};
	}

	async addTransactions(block_hash, input_transactions) {
		let promises = [];

		// Get all receipts
		for (let idx = 0; idx < input_transactions.length; idx++) {
			promises.push(
				this.getTransactionReceipt(block_hash, input_transactions[idx])
			);
		}

		let input_receipts = await Promise.all(promises);


		/**
		 * At this point, we have all of the transactions and reciepts.
		 * 
		 * We only want to store the transactions and logs for relevant
		 * contracts that we are monitoring...
		 * 
		 * So we want to review the transaction data: to, from, contract_address
		 * and we want to review the log data: address
		 * 
		 **/
		let {transactions, receipts} = await this.captureWatchedTransactions(input_transactions, input_receipts);

		console.log("Found", transactions.length, "viable transactions out of", input_transactions.length);

		if (transactions.length === 0) {
			return Promise.all([]);
		}

		// Add all transactions at once
		let results = await this.Client.query(TransactionQueries.addTransactions(
			block_hash,
			transactions,
			receipts
		));

		// First we delete the logs in case we have to update them
		// There's no easier way for us to identify logs that have to be "updated"
		// based on the transaction being included in another block -- this changes
		// the log_index, so it's better to just wipe the associated logs and re-insert
		// ALSO, doing this will cascade all log row deletes to the associated event
		// tables that we're using for parsed logs
		await this.Client.query('set enable_seqscan = off;');
		await this.Client.query(TransactionQueries.deleteLogsByBlockHash(block_hash));
		await this.Client.query('set enable_seqscan = on;');

		// Collect all of the logs
		let logs = [];
		for (let receipt of receipts) {
			for (let log of receipt.logs) {
				log.transactionHash = receipt.transactionHash;
				logs.push(log);
			}
		}

		// Add the logs & any events
		let logSets = [];
		let LOG_SET_MAX_SIZE = 1000;
		for (let chunkIdx = 0; chunkIdx < logs.length; chunkIdx += LOG_SET_MAX_SIZE) {

			// Get the subset of the receipts
			let localLogs = logs.slice(chunkIdx, Math.min(logs.length, chunkIdx + LOG_SET_MAX_SIZE));

			results = await this.Client.query(TransactionQueries.addLogs(
				localLogs
			));

			for (let idx = 0; idx < localLogs.length; idx++) {
				let matchingResult;
				for (let row of results.rows) {
					if (parseInt(row.log_index, 10) === localLogs[idx].logIndex) {
						matchingResult = row;
					}
				}

				if (!matchingResult) {
					log.error("Could not find matching log index for log receipt");
					continue;
				}

				logSets.push({
					log_id : matchingResult.log_id,
					logs : localLogs[idx]
				});
			}
		}

		promises = [this.cc.setDecodedLogs(this.Client, logSets)];

		return Promise.all(promises);
	}

	async getTransactionReceipt(block_hash, transaction) {
		let receipt = await this.evmClient.getTransactionReceipt(transaction.hash);

		if (!receipt) {
			log.info(`Transaction receipt not found for block. Dropping out to be re-inserted at a later iteration.\n\tBlock hash: ${block_hash}\n\tTX hash: ${transaction.hash}`);
			return;
		}

		return receipt;
	}

}

module.exports = CacheMonitor;

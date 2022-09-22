// Required libraries
const log = require('loglevel');

class Client {
	constructor(client, release) {
		this.client = client;
		this.isReleased = false;
		this.release = () => {
			if (!this.isReleased) {
				this.isReleased = true;
				release();
			}
		};
	}

	async query(query, callback = null) {
		let queryCallback = null;
		if (callback && typeof callback === 'function') {
			queryCallback = (err, results) => {
				if (err) {
					this.release();
					log.error('Error with query', err.stack);
					process.exit(1);
				}

				callback(results);
			};
		}

		return this.client.query(query, queryCallback);
	}
}

module.exports = Client;

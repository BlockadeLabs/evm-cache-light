module.exports = function(hexString) {
	// If not a valid hex string, leave us now
	if (!hexString || hexString.indexOf('0x') !== 0) {
		return hexString;
	}

	// Make sure we have an even number of hex values
	if (hexString.length % 2 !== 0) {
		hexString = hexString.slice(0, 2) + "0" + hexString.slice(2);
	}

	// Format for postgresql BYTEA type
	return hexString.replace(/^0x/, '\\x');
};

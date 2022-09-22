module.exports = function(buffer) {
	if (!Buffer.isBuffer(buffer)) {
		return buffer;
	}

	return '0x' + buffer.toString('hex');
};

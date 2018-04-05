/* eslint promise/avoid-new:"off" */

module.exports = {
	getData: req => (new Promise((resolve, reject) => {
		return req.webtaskContext.storage.get((readError, data) => {
			if (readError) {
				return reject(readError);
			}
			return resolve(data);
		});
	})),
	writeData: (req, update) => (new Promise((resolve, reject) => {
		return req.webtaskContext.storage.set(update, { force: 1 }, (writeError) => {
			if (writeError) return reject(writeError);

			return resolve(true);
		});
	}))
};

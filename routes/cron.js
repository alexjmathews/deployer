const express = require('express');

module.exports = () => {
	const router = express.Router();

	router.post('/', (req, res) => {
		console.log(req.body);
		return res.status(200)
			.json({
				cron: `job-${Date.now()}`
			});
	});

	return router;
};

const express = require('express');

const domains = {
	'factoryfour.com': {
		dist: 'abc',
		repo: 'factoryfour',
		allowLatest: false
	},
	'app.factoryfour.com': {
		dist: 'abc',
		repo: 'react-factoryfour',
		allowLatest: false
	},
	'dev-app.factoryfour.com': {
		dist: 'abc',
		repo: 'react-factoryfour',
		allowLatest: true
	}
};

const admins = {
	U2MF72A3X: 'nikita',
	U037H1T8V: 'alex'
};

const error = err => ({
	attachments: [
		{
			fallback: 'An error occured attempting to deploy',
			text: `Error attempting deploy: ${err}`,
			color: 'danger'
		}
	]
});

module.exports = () => {
	const router = express.Router();

	router.post('/', (req, res) => {
		console.log(req.body);
		const text = req.body.text;
		const spl = text.split(' ');

		if (spl.length !== 3) {
			return res.status(200)
				.json(error('Input not long enough'));
		}
		let domain;
		try {
			domain = spl[0].split('|')[1].slice(0, -1);
			if (!domains[domain]) {
				return res.status(200)
					.json(error(`Domain (${domain}) was not recognized`));
			}
		} catch (e) {
			return res.status(200)
				.json(error('Unable to parse domain'));
		}
		let admin;
		let adminName;
		try {
			admin = spl[2].split('|')[0].substring(2);
			adminName = spl[2].split('|')[1].slice(0, -1);
			if (!admins[admin]) {
				return res.status(200)
					.json(error(`Admin (@${adminName}) was not recognized`));
			}
		} catch (e) {
			return res.status(200)
				.json(error('Unable to parse admin'));
		}

		// set target send approval

		return res.status(200)
			.json({
				domain
			});
	});

	return router;
};

const express = require('express');
const semver = require('semver');
const aws = require('../src/aws.js');
const initApproval = require('../src/initApproval.js');

const domains = {
	'factoryfour.com': {
		dist: 'E2UE1ZTLJTMWZF',
		appName: 'Production FactoryFour Website',
		repo: 'factoryfour',
		bucket: 'factoryfour-dev-app',
		allowLatest: false
	},
	'app.factoryfour.com': {
		dist: 'E2KR4BHIY2KIZZ',
		appName: 'Production FactoryFour Application',
		repo: 'react-factoryfour',
		bucket: 'factoryfour-dev-app',
		allowLatest: false
	},
	'dev-app.factoryfour.com': {
		dist: 'E1ZFZO5NY2VPIN',
		appName: 'Dev FactoryFour Application',
		repo: 'react-factoryfour',
		bucket: 'factoryfour-dev-app',
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
		const user = req.body.user_id;
		const channel = req.body.channel_id;
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
		let specifiedTarget;
		try {
			specifiedTarget = spl[1];
			if (specifiedTarget !== 'latest' && !semver.validRange(specifiedTarget)) {
				return res.status(200)
					.json(error(`Specified Target (${specifiedTarget}) was not valid semver`));
			}
		} catch (e) {
			return res.status(200)
				.json(error('Unable to parse target'));
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

		const config = domains[domain];
		// set target send approval
		return Promise.all([
			aws.fetchVersions(req.webtaskContext.secrets, config.bucket),
			aws.fetchCurrentVersion(req.webtaskContext.secrets, config.dist),
		])
			.then(([versions, currentVersion]) => {
				const target = semver.maxSatisfying(versions, specifiedTarget);
				if (!target) {
					return res.status(200)
						.json(error(`No valid target was found for specified target (${specifiedTarget})`));
				}
				res.status(200)
					.json({
						text: 'Success! Starting up deployment ...'
					});

				const deployment = {
					domain, config, currentVersion, target, specifiedTarget, user, admin, channel
				};
				return initApproval(req, deployment);
			})
			.catch((err) => {
				console.error(err);
				if (!res.headerSent) {
					return res.status(200)
						.json(error('Unable to check s3 for versions'));
				}
				return err;
			});
	});

	return router;
};

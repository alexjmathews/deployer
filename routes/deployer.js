const express = require('express');
const aws = require('../src/aws.js');
const semver = require('semver');

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

const success = (domain, appName, currentVersion, target, specifiedTarget, user, approver) => ({
	response_type: 'in_channel',
	attachments: [
		{
			fallback: `<@${user}> is deploying ${domain} to ${target}`,
			pretext: `Starting a deployment on ${domain}`,
			title: appName,
			title_link: domain,
			text: `Specified Target was \`${specifiedTarget}\`. Approval requested from <@${approver}>`,
			author_name: `Requested by <@${user}>`,
			fields: [
				{
					title: 'Current Version',
					value: currentVersion,
					short: true
				},
				{
					title: 'Target Version',
					value: target,
					short: true
				}
			],
			color: '#36a64f'
		}
	]
});

module.exports = () => {
	const router = express.Router();

	router.post('/', (req, res) => {
		const user = req.body.user_id;
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
				return res.status(200)
					.json(success(domain, config.appName, 'v1.0.0', target, specifiedTarget, user, admin));
			})
			.catch((err) => {
				console.error(err);
				return res.status(200)
					.json(error('Unable to check s3 for versions'));
			});
	});

	return router;
};

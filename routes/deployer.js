const express = require('express');
const semver = require('semver');
const { WebClient } = require('@slack/client');
const aws = require('../src/aws.js');
const { getData } = require('../src/data.js');
const initApproval = require('../src/initApproval.js');

const domains = {
	'factoryfour.com': {
		dist: 'E2UE1ZTLJTMWZF',
		appName: 'Production FactoryFour Website',
		repo: 'factoryfour',
		bucket: 'factoryfour-dist-info',
		allowLatest: false
	},
	'app.factoryfour.com': {
		dist: 'E2KR4BHIY2KIZZ',
		appName: 'Production FactoryFour Application',
		repo: 'react-factoryfour',
		bucket: 'factoryfour-dist-app',
		allowLatest: false
	},
	'dev-app.factoryfour.com': {
		dist: 'E1JHRN95HB5UUD',
		appName: 'Dev FactoryFour Application',
		repo: 'react-factoryfour',
		bucket: 'factoryfour-dev-app',
		allowLatest: true
	},
	'dev-vendor.fusiform.co': {
		dist: 'E1ZFZO5NY2VPIN',
		appName: 'Dev CAST Vendor Application',
		repo: 'ng-vendor',
		bucket: 'fusiform-dev-vendor',
		allowLatest: true
	},
	'dev-clinic.fusiform.co': {
		dist: 'E2QUPFHPVP60LW',
		appName: 'Dev CAST Clinic Application',
		repo: 'ng-clinic',
		bucket: 'fusiform-dev-clinic',
		allowLatest: true
	},
	'vendor.fusiform.co': {
		dist: 'E221EDK0GC9E7Q',
		appName: 'Prod CAST Vendor Application',
		repo: 'ng-vendor',
		bucket: 'fusiform-dist-vendor',
		allowLatest: false
	},
	'clinic.fusiform.co': {
		dist: 'E2XNBJD3VFZDHC',
		appName: 'Prod CAST Clinic Application',
		repo: 'ng-clinic',
		bucket: 'fusiform-dist-clinic',
		allowLatest: false
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

// Remove deployment from data
const closeOverridden = (req, deployment) => {
	const web = new WebClient(req.webtaskContext.secrets.SLACK_TOKEN);
	deployment.slackMessage.message.attachments[0] = Object.assign(
		deployment.slackMessage.message.attachments[0],
		{
			fallback: 'Deployment overriden',
			pretext: `Deployment on ${deployment.domain} overriden`,
			color: 'danger',
			footer: 'Status: Closed',
			footer_icon: '',
			ts: Date.now() / 1000
		}
	);
	return web.chat.update({
		channel: deployment.channel,
		text: '',
		ts: deployment.slackMessage.ts,
		attachments: deployment.slackMessage.message.attachments
	});
};

module.exports = () => {
	const router = express.Router();

	router.post('/', (req, res) => {
		const user = req.body.user_id;
		const channel = req.body.channel_id;
		const text = req.body.text;
		const spl = text.split(' ');

		if (spl.length < 3) {
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
		let override = false;
		if (spl[3] && spl[3] === 'override') {
			override = true;
		}

		const config = domains[domain];
		// set target send approval
		return Promise.all([
			aws.fetchVersions(req.webtaskContext.secrets, config.bucket),
			aws.fetchCurrentVersion(req.webtaskContext.secrets, config.dist),
			getData(req)
		])
			.then(([versions, currentVersion, data]) => {
				if (data[domain] && !override) {
					const curDep = data[domain];
					return res.status(200)
						.json(error(`A deployment for ${domain} already exists (target: *${curDep.target}* - status: *${curDep.status}*). Add \`override\` to the end of your command to start a new deployment`));
				}
				const proms = [];
				if (data[domain]) {
					proms.push(closeOverridden(req, data[domain]));
				}

				let target;
				if (specifiedTarget === 'latest' && config.allowLatest) {
					target = 'latest';
				} else {
					target = semver.maxSatisfying(versions, specifiedTarget);
					if (!target) {
						return res.status(200)
							.json(error(`No valid target was found for specified target (${specifiedTarget})`));
					}
				}
				console.log(target);
				res.status(200)
					.json({
						text: 'Success! Initiating deployment ...'
					});

				const deployment = {
					domain, config, currentVersion, override, target, specifiedTarget, user, admin, channel, status: 'pending'
				};
				proms.push(initApproval(req, deployment));
				return Promise.all(proms);
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

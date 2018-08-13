const express = require('express');
const { WebClient } = require('@slack/client');
const { getData, writeData } = require('../src/data.js');
const { getDistributionsStatuses, invalidateBase } = require('../src/aws.js');

const complete = (req, deployment) => {
	deployment.slackMessage.message.attachments[0] = Object.assign(
		deployment.slackMessage.message.attachments[0],
		{
			fallback: 'Deployment Complete',
			pretext: `Deployed to ${deployment.domain}`,
			text: `Specified Target was \`${deployment.specifiedTarget}\`. Approved by <@${deployment.admin}>`,
			footer: 'Status: Complete',
			footer_icon: '',
			fields: [
				{
					title: 'Previous Version',
					value: deployment.currentVersion,
					short: true
				},
				{
					title: 'Current Version',
					value: deployment.target,
					short: true
				}
			],
			color: 'good',
			ts: Date.now() / 1000
		}
	);
	const web = new WebClient(req.webtaskContext.secrets.SLACK_TOKEN);

	return web.chat.update({
		channel: deployment.channel,
		text: '',
		ts: deployment.slackMessage.ts,
		attachments: deployment.slackMessage.message.attachments
	})
		.then(() => {
			return invalidateBase(req, deployment);
		})
		.then(() => {
			return deployment.domain;
		});
};

const timeout = (req, deployment) => {
	deployment.slackMessage.message.attachments[0] = Object.assign(
		deployment.slackMessage.message.attachments[0],
		{
			fallback: 'Deployment Timeout',
			pretext: `Unable to deploy ${deployment.domain} due to timeout`,
			text: `Specified Target was \`${deployment.specifiedTarget}\`. Approved by <@${deployment.admin}>`,
			footer: 'Status: Failure',
			footer_icon: '',
			fields: [
				{
					title: 'Current Version',
					value: deployment.currentVersion,
					short: true
				},
				{
					title: 'Attempted Version',
					value: deployment.target,
					short: true
				}
			],
			color: 'danger',
			ts: Date.now() / 1000
		}
	);
	const web = new WebClient(req.webtaskContext.secrets.SLACK_TOKEN);

	return web.chat.update({
		channel: deployment.channel,
		text: '',
		ts: deployment.slackMessage.ts,
		attachments: deployment.slackMessage.message.attachments
	})
		.then((res) => {
			console.log(res);
			return deployment.domain;
		});
};

const clear = (req, toClear) => {
	return getData(req)
		.then((data) => {
			const update = data;
			toClear.forEach((domain) => {
				delete update[domain];
			});
			return writeData(req, update);
		});
};

module.exports = () => {
	const router = express.Router();

	router.post('/', (req, res) => {
		let deployments;
		let allStatuses;
		let updates;
		return getData(req)
			.then((data) => {
				if (!data || Object.keys(data).length === 0) {
					res.status(200)
						.json({
							message: 'Nothing to update'
						});
					throw new Error('safe');
				}
				deployments = data;
				return getDistributionsStatuses(req.webtaskContext.secrets);
			})
			.then((statuses) => {
				updates = [];
				allStatuses = statuses;
				Object.keys(deployments).forEach((dep) => {
					const deploy = deployments[dep];
					const id = deploy.config.dist;
					const current = statuses[id];
					if (deploy.approved && current === 'Deployed') {
						updates.push(complete(req, deploy));
					}
					if (!deploy.approved && Date.now() - deploy.createdAt > 1000 * 60 * 15) {
						updates.push(timeout(req, deploy));
					}
				});
				return Promise.all(updates);
			})
			.then((updatesIn) => {
				updates = updatesIn;
				return clear(req, updates);
			})
			.then(() => {
				return res.status(200)
					.json({
						cron: `job-${Date.now()}`,
						allStatuses,
						updates
					});
			})
			.catch((err) => {
				if (err.message === 'safe') {
					return;
				}
				console.error(err);
				res.status(500)
					.json({
						err: err.message || err
					});
			});
	});

	return router;
};

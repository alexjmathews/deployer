/* eslint promise/avoid-new:"off" */
const express = require('express');
const { WebClient } = require('@slack/client');
const { getData, writeData } = require('../src/data.js');
const { updateDistribution } = require('../src/aws.js');

const accept = (prevMessage, dep) => {
	const output = {
		attachments: prevMessage.attachments,
		response_type: 'ephemeral'
	};
	output.attachments[0].pretext = `Approved Deployment on ${dep.domain}`;
	output.attachments[0].text = `Specified Target was \`${dep.specifiedTarget}\`.`;
	output.attachments[0].color = 'good';
	output.attachments[1] = {
		fallback: 'Success',
		title: ':white_check_mark: Starting Deployment ...'
	};
	return output;
};

const rejectDep = (prevMessage, dep) => {
	const output = {
		attachments: prevMessage.attachments,
		response_type: 'ephemeral'
	};
	output.attachments[0].pretext = `Rejected Deployment on ${dep.domain}`;
	output.attachments[0].text = `Specified Target was \`${dep.specifiedTarget}\`.`;
	output.attachments[0].color = 'danger';
	output.attachments[1] = {
		fallback: 'Success',
		title: ':woman-gesturing-no::skin-tone-5: Rejected Deployment.',
		color: 'danger'
	};
	return output;
};

const error = err => ({
	attachments: [
		{
			fallback: 'An error occured attempting to deploy',
			text: `Error approving deploy: ${err}`,
			color: 'danger'
		}
	]
});

// Remove deployment from data
const closeDeployment = (req, data, deployment) => {
	delete data[deployment.domain];
	const web = new WebClient(req.webtaskContext.secrets.SLACK_TOKEN);
	return writeData(req, data)
		.then(() => {
			deployment.slackMessage.message.attachments[0] = Object.assign(
				deployment.slackMessage.message.attachments[0],
				{
					fallback: 'Deployment rejected',
					pretext: `Deployment on ${deployment.domain} rejected by admin :woman-gesturing-no::skin-tone-5:`,
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
		});
};

// Run origin shift
// Update deployment in data
const startDeployment = (req, data, deployment) =>
	updateDistribution(req.webtaskContext.secrets, deployment)
		.then(() => {
			const update = Object.assign({}, data, {
				[deployment.domain]: Object.assign({}, deployment, {
					status: 'originShift'
				})
			});

			return writeData(req, update);
		})
		.then(() => {
			deployment.slackMessage.message.attachments[0] = Object.assign(
				deployment.slackMessage.message.attachments[0],
				{
					fallback: 'Switching Origins',
					pretext: `Migrating origins to target on ${deployment.domain}`,
					text: `Specified Target was \`${deployment.specifiedTarget}\`. Approved by <@${deployment.admin}>`,
					footer: 'Status: Origin Switch',
					color: '#eda45a',
					ts: Date.now() / 1000
				}
			);
			const web = new WebClient(req.webtaskContext.secrets.SLACK_TOKEN);

			return web.chat.update({
				channel: deployment.channel,
				text: '',
				ts: deployment.slackMessage.ts,
				attachments: deployment.slackMessage.message.attachments
			});
		});

module.exports = () => {
	const router = express.Router();

	router.post('/actions', (req, res) => {
		const payload = JSON.parse(req.body.payload);
		const prevMessage = payload.original_message;
		const result = payload.actions[0].value;

		return getData(req)
			.then((data) => {
				const domain = payload.callback_id.split('|')[0];
				const deployment = data[domain];

				if (!deployment) {
					return res.status(200)
						.json(error('Could not find deployment'));
				}
				if (deployment.callback_id !== payload.callback_id) {
					return res.status(200)
						.json(error('Could not submit approval - callback mismatch'));
				}

				if (deployment.status !== 'pending') {
					return res.status(200)
						.json(error('Could not submit approval - not in pending'));
				}

				if (result === 'approve') {
					res.status(200)
						.json(accept(prevMessage, deployment));
					return startDeployment(req, data, deployment);
				}
				res.status(200)
					.json(rejectDep(prevMessage, deployment));
				return closeDeployment(req, data, deployment);
			})
			.catch((err) => {
				console.error(err);
				if (!res.headersSent) {
					return res.status(200)
						.json(error('Could not submit approval'));
				}
				return err;
			});
	});

	return router;
};

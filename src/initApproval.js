/* eslint promise/avoid-new:"off" */
const { WebClient } = require('@slack/client');
const uuid = require('uuid/v4');
const { getData, writeData } = require('./data.js');

const success = dep => ({
	channel: dep.channel,
	response_type: 'ephemeral',
	attachments: [
		{
			fallback: `<@${dep.user}> is deploying ${dep.domain} to ${dep.target}`,
			pretext: `Initiating a deployment on ${dep.domain}`,
			title: dep.config.appName,
			title_link: dep.domain,
			text: `Specified Target was \`${dep.specifiedTarget}\`. Approval requested from <@${dep.admin}>`,
			author_name: `Initiated by <@${dep.user}>${dep.override ? ' with override' : ''}`,
			fields: [
				{
					title: 'Current Version',
					value: dep.currentVersion,
					short: true
				},
				{
					title: 'Target Version',
					value: dep.target,
					short: true
				}
			],
			color: '#9958F0',
			footer: 'Status: Pending Approval',
			footer_icon: 'https://static.factoryfour.com/misc/rings-loading.gif',
			ts: Date.now() / 1000
		}
	]
});

const approval = dep => ({
	channel: dep.adminChannel,
	response_type: 'ephemeral',
	attachments: [
		{
			fallback: `<@${dep.user}> is deploying ${dep.domain} to ${dep.target}`,
			pretext: `Pending approval for deployment on ${dep.domain}`,
			title: dep.config.appName,
			title_link: dep.domain,
			text: `Specified target was \`${dep.specifiedTarget}\`. Your approval is required to continue.`,
			author_name: `Initiated by <@${dep.user}>${dep.override ? ' with override' : ''}`,
			fields: [
				{
					title: 'Current Version',
					value: dep.currentVersion,
					short: true
				},
				{
					title: 'Target Version',
					value: dep.target,
					short: true
				}
			],
			attachment_type: 'default',
			color: 'warning'
		},
		{
			callback_id: dep.callback_id,
			fallback: 'Approve?',
			title: 'Approve or Deny deployment',
			actions: [
				{
					name: 'approve',
					text: 'Approve',
					type: 'button',
					value: 'approve',
					style: 'primary'
				},
				{
					name: 'reject',
					text: 'Reject',
					type: 'button',
					value: 'reject',
					style: 'danger'
				}
			]
		}
	]
});

const write = (req, deployment) => {
	let depOut;
	return getData(req)
		.then((data) => {
			const fetchedData = data || {};
			const id = uuid();
			depOut = Object.assign({}, deployment, {
				callback_id: `${deployment.domain}|${id}`,
				createdAt: Date.now()
			});
			const update = Object.assign({}, fetchedData, {
				[deployment.domain]: depOut
			});
			return writeData(req, update);
		})
		.then(() => depOut);
};

const writeTs = (req, deployment) => {
	return getData(req)
		.then((data) => {
			const fetchedData = data || {};
			const update = Object.assign({}, fetchedData, {
				[deployment.domain]: deployment
			});
			return writeData(req, update);
		})
		.then(() => deployment);
};

module.exports = (req, deployment) => {
	const { admin } = deployment;
	let deploymentEntity = Object.assign({}, deployment);

	const web = new WebClient(req.webtaskContext.secrets.SLACK_TOKEN);
	return write(req, deployment)
		.then((depwithId) => {
			deploymentEntity = Object.assign({}, deploymentEntity, depwithId);
			return web.chat.postMessage(success(deployment));
		})
		.then((result) => {
			deploymentEntity = Object.assign({}, deploymentEntity, {
				slackMessage: result
			});
			return writeTs(req, deploymentEntity);
		})
		.then(() => web.im.open({
			user: admin,
			return_im: true
		}))
		.then((data) => {
			const adminChannel = data.channel.id;
			deploymentEntity = Object.assign({}, deploymentEntity, {
				adminChannel
			});
			return web.chat.postMessage(approval(deploymentEntity));
		});
};

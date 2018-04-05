/* eslint promise/avoid-new:"off" */
const { WebClient } = require('@slack/client');
const uuid = require('uuid/v4');

const success = dep => ({
	channel: dep.channel,
	response_type: 'ephemeral',
	attachments: [
		{
			fallback: `<@${dep.user}> is deploying ${dep.domain} to ${dep.target}`,
			pretext: `Starting a deployment on ${dep.domain}`,
			title: dep.config.appName,
			title_link: dep.domain,
			text: `Specified Target was \`${dep.specifiedTarget}\`. Approval requested from <@${dep.admin}>`,
			author_name: `Initiated by <@${dep.user}>`,
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
			color: 'good'
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
			text: `Specified Target was \`${dep.specifiedTarget}\`. Your approval is required to continue.`,
			author_name: `Initiated by <@${dep.user}>`,
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
			],
			color: 'warning'
		}
	]
});

const writeDeployment = (req, deployment) => (new Promise((resolve, reject) =>
	req.webtaskContext.storage.get((readError, data) => {
		const fetchedData = data || {};
		const id = uuid();
		const depOut = Object.assign({}, deployment, {
			callback_id: id,
			createdAt: Date.now()
		});
		const updateData = Object.assign({}, fetchedData, {
			[id]: depOut
		});
		return req.webtaskContext.storage.set(updateData, { force: 1 }, (writeError) => {
			if (writeError) return reject(writeError);

			return resolve(depOut);
		});
	})));

module.exports = (req, deployment) => {
	const { admin } = deployment;
	let deploymentEntity = Object.assign({}, deployment);

	const web = new WebClient(req.webtaskContext.secrets.SLACK_TOKEN);
	return writeDeployment(req, deployment)
		.then((depwithId) => {
			deploymentEntity = Object.assign({}, deploymentEntity, depwithId);
			return web.chat.postMessage(success(deployment));
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

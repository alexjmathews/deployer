/* eslint promise/avoid-new:"off" */
const express = require('express');
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
		title: ':small_red_triangle_down: Rejected Deployment.',
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
	return writeData(req, data);
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
				console.log(deployment);

				if (!deployment) {
					return res.status(200)
						.json(error('Could not find deployment'));
				}

				if (deployment.callback_id !== payload.callback_id) {
					return res.status(200)
						.json(error('Could not submit approval'));
				}

				if (deployment.status !== 'pending') {
					return res.status(200)
						.json(error('Could not submit approval'));
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

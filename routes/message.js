/* eslint promise/avoid-new:"off" */
const express = require('express');

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
		title: ':white_check_mark: Starting Deployment ...',
		color: 'good'
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
			text: `Error attempting deploy: ${err}`,
			color: 'danger'
		}
	]
});

const getData = req => (new Promise((resolve, reject) => {
	return req.webtaskContext.storage.get((readError, data) => {
		if (readError) {
			return reject(readError);
		}
		return resolve(data);
	});
}));

module.exports = () => {
	const router = express.Router();

	router.post('/actions', (req, res) => {
		const payload = JSON.parse(req.body.payload);
		const prevMessage = payload.original_message;
		const result = payload.actions[0].value;

		return getData(req)
			.then((data) => {
				const deployment = data[payload.callback_id];
				console.log(deployment);
				if (result === 'approve') {
					return res.status(200)
						.json(accept(prevMessage, deployment));
				}
				return res.status(200)
					.json(rejectDep(prevMessage, deployment));
			})
			.catch((err) => {
				console.error(err);
				if (!res.headerSent) {
					return res.status(200)
						.json(error('Could not submit approval'));
				}
				return err;
			});
	});

	return router;
};

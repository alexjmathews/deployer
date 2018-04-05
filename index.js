const express = require('express');
const Webtask = require('webtask-tools');
const bodyParser = require('body-parser');

const cron = require('./routes/cron.js');
const deployer = require('./routes/deployer.js');
const message = require('./routes/message.js');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
	console.log('hello');
	res.sendStatus(200);
});

app.use('/', cron());
app.use('/app/', deployer());
app.use('/message/', message());

app.delete('/', (req, res) => req.webtaskContext.storage.set({}, { force: 1 }, (writeError) => {
	if (writeError) {
		return res.status(500)
			.json({
				error: writeError.message || writeError
			});
	}

	return res.status(200).json({ cleared: true });
}));

module.exports = Webtask.fromExpress(app);

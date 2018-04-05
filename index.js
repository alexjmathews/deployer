const express = require('express');
const Webtask = require('webtask-tools');
const bodyParser = require('body-parser');

const cron = require('./routes/cron.js');
const deployer = require('./routes/deployer.js');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
	console.log('hello');
	res.sendStatus(200);
});

app.use('/', cron());
app.use('/app/', deployer());

module.exports = Webtask.fromExpress(app);

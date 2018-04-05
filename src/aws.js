/* eslint promise/avoid-new:"off" */

const AWS = require('aws-sdk');
const semver = require('semver');

const pluck = secrets => ({
	accessKeyId: secrets.AWS_KEY_ID,
	secretAccessKey: secrets.AWS_SECRET_KEY
});

const fetchVersions = (secrets, Bucket) => (new Promise((resolve, reject) => {
	AWS.config.update(pluck(secrets));
	const S3 = new AWS.S3();

	S3.listObjectsV2({
		Bucket,
		Delimiter: '/'
	}, (err, data) => {
		if (err) {
			reject(err);
			return;
		}
		const versions = data.CommonPrefixes.reduce((memo, pre) => {
			const clean = pre.Prefix.slice(0, -1);
			if (!semver.valid(clean)) {
				return memo;
			}
			memo.push(clean);
			return memo;
		}, []);

		resolve(versions);
	});
}));

const fetchCurrentVersion = (secrets, distribution) => (new Promise((resolve, reject) => {
	AWS.config.update(pluck(secrets));
	const cloudfront = new AWS.CloudFront();

	cloudfront.getDistribution({ Id: distribution }, (err, data) => {
		if (err) {
			return reject(err);
		}
		const dist = data.Distribution;
		const defaultOrigin = dist.DistributionConfig.DefaultCacheBehavior.TargetOriginId;
		const origins = dist.DistributionConfig.Origins.Items;
		console.log(defaultOrigin, origins.map(item => item.Id));
		return resolve(true);
	});
}));

module.exports = {
	fetchVersions,
	fetchCurrentVersion
};

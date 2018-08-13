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

		const current = origins.find(element => defaultOrigin === element.Id);
		return resolve(current.OriginPath.substring(1));
	});
}));

const getDistributionsStatuses = secrets => (new Promise((resolve, reject) => {
	AWS.config.update(pluck(secrets));
	const cloudfront = new AWS.CloudFront();

	cloudfront.listDistributions({ }, (err, data) => {
		if (err) {
			return reject(err);
		}
		const map = {};
		data.DistributionList.Items.forEach((elem) => {
			map[elem.Id] = elem.Status;
		});
		return resolve(map);
	});
}));

const updateDistribution = (secrets, deployment) => (new Promise((resolve, reject) => {
	if (!deployment) {
		return reject(new Error('No deployment found'));
	}
	AWS.config.update(pluck(secrets));
	const cloudfront = new AWS.CloudFront();

	const Id = deployment.config.dist;
	const { bucket } = deployment.config;
	const { target } = deployment;

	cloudfront.getDistributionConfig({ Id }, (configerr, config) => {
		if (configerr) {
			return reject(configerr);
		}

		const NOrigin = {
			Id: `S3-${bucket}/${target}`,
			DomainName: `${bucket}.s3.amazonaws.com`,
			OriginPath: `/${target}`,
			CustomHeaders: {
				Quantity: 0,
				Items: []
			},
			S3OriginConfig: {
				OriginAccessIdentity: ''
			}
		};
		config.DistributionConfig.Origins.Items = [NOrigin];
		config.DistributionConfig.Origins.Quantity = 1;
		config.DistributionConfig.DefaultCacheBehavior.TargetOriginId = NOrigin.Id;
		config.Id = Id;
		config.IfMatch = config.ETag;
		delete config.ETag;

		return cloudfront.updateDistribution(config, (updateErr, result) => {
			if (updateErr) {
				return reject(updateErr);
			}
			return resolve(result);
		});
	});
	return resolve(true);
}));

const invalidateBase = (secrets, deployment) => new Promise((resolve, reject) => {
	if (!deployment) {
		return reject(new Error('No deployment found'));
	}
	AWS.config.update(pluck(secrets));
	const cloudfront = new AWS.CloudFront();

	const Id = deployment.config.dist;
	return cloudfront.createInvalidation({
		DistributionId: Id,
		InvalidationBatch: {
			CallerReference: `${Date.now()}`,
			Paths: {
				Quantity: 1,
				Items: [
					'/*'
				]
			}
		}
	}, (err, data) => {
		if (err) {
			return reject(err);
		}
		return resolve(data);
	});
});

module.exports = {
	fetchVersions,
	getDistributionsStatuses,
	fetchCurrentVersion,
	updateDistribution,
	invalidateBase
};

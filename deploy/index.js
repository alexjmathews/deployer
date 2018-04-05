const AWS = require('aws-sdk');
const semver = require('semver');

AWS.config.update({ accessKeyId: 'AKIAI3YY2RWQP4STA2YQ', secretAccessKey: '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' });

const cloudfront = new AWS.CloudFront();
// cloudfront.listDistributions({}, function(err, data) {
// 	if (err) {
// 		console.error(err);
// 		return;
// 	}
// 	const distirbutions = data.DistributionList.Items;
// 	console.log(distirbutions.map((dist) => `${dist.Aliases.Items}-${dist.Id}`));
// });



cloudfront.getDistributionConfig({ Id: 'E1ZFZO5NY2VPIN' }, (configerr, config) => {
	if (configerr) {
		console.error(configerr);
		return;
	}
	// config.DistributionConfig.
	const bucket = 'fusiform-dev-vendor';
	const target = 'v2.13.1';
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
	config.Id = 'E1ZFZO5NY2VPIN';
	config.IfMatch = config.ETag;
	delete config.ETag;

	cloudfront.updateDistribution(config, (updateErr, result) => {
		if (updateErr) {
			console.error(updateErr);
			return;
		}
		console.log(result);
	});
});

// const S3 = new AWS.S3();

// S3.listObjectsV2({
// 	Bucket: 'factoryfour-dev-app',
// 	Delimiter: '/'
// }, (err, data) => {
// 	if (err) {
// 		console.error(err);
// 		return;
// 	}
// 	const versions = data.CommonPrefixes.reduce((memo, pre) => {
// 		const clean = pre.Prefix.slice(0, -1);
// 		if (!semver.valid(clean)) {
// 			return memo;
// 		}
// 		memo.push(clean);
// 		return memo;
// 	}, []);

// 	const max = semver.maxSatisfying(versions, 'x.x.x');
// 	console.log(max);
// });

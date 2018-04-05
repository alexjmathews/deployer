const AWS = require('aws-sdk');
const semver = require('semver');

AWS.config.update({ accessKeyId: 'AKIAI3YY2RWQP4STA2YQ', secretAccessKey: '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' });



// const cloudfront = new AWS.CloudFront();
// cloudfront.listDistributions({}, function(err, data) {
// 	if (err) {
// 		console.error(err);
// 		return;
// 	}
// 	const distirbutions = data.DistributionList.Items;
// 	console.log(distirbutions.map((dist) => `${dist.Aliases.Items}-${dist.Id}`));
// });

// cloudfront.getDistribution({ Id: 'E1ZFZO5NY2VPIN' }, (err, data) => {
// 	if (err) {
// 		console.error(err);
// 		return;
// 	}
// 	console.log(JSON.stringify(data.Distribution, null, 4))
// });

const S3 = new AWS.S3();

S3.listObjectsV2({
	Bucket: 'factoryfour-dev-app',
	Delimiter: '/'
}, (err, data) => {
	if (err) {
		console.error(err);
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

	const max = semver.maxSatisfying(versions, 'x.x.x');
	console.log(max);
});

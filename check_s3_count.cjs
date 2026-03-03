const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    region: 'us-east-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy_key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy_secret'
    }
});

const BUCKET_NAME = 'encartes-jlmarketing-fotos2026';

async function countObjects() {
    let count = 0;
    let continuationToken = undefined;
    try {
        do {
            const command = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                ContinuationToken: continuationToken
            });
            const response = await s3Client.send(command);
            if (response.Contents) {
                count += response.Contents.length;
            }
            continuationToken = response.NextContinuationToken;
        } while (continuationToken);
        console.log(`Total objects in S3 bucket: ${count}`);
    } catch (err) {
        console.error('Error counting objects:', err);
    }
}

countObjects();

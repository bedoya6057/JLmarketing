const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');

// Configure AWS S3 Client
const s3Client = new S3Client({
    region: 'us-east-2', // User specified Ohio
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'dummy_key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'dummy_secret'
    }
});

const BUCKET_NAME = 'encartes-jlmarketing-fotos2026';
const photosDir = path.join(__dirname, 'photos_backup');
const CONCURRENCY_LIMIT = 30; // 30 concurrent uploads for speed

async function uploadFile(filePath, fileName, retries = 3) {
    const fileContent = fs.readFileSync(filePath);
    let contentType = mime.lookup(filePath) || 'application/octet-stream';

    // AWS S3 standard public URL format: https://bucket-name.s3.region.amazonaws.com/filename
    const params = {
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: fileContent,
        ContentType: contentType
    };

    try {
        await s3Client.send(new PutObjectCommand(params));
        return true;
    } catch (error) {
        if (retries > 0) {
            return uploadFile(filePath, fileName, retries - 1);
        }
        throw error;
    }
}

async function startUpload() {
    console.log(`Scanning local photo backup directory...`);
    if (!fs.existsSync(photosDir)) {
        console.error('Directory "photos_backup" not found!');
        return;
    }

    const files = fs.readdirSync(photosDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg'));
    console.log(`Found ${files.length} images to upload to S3 bucket '${BUCKET_NAME}'`);

    let uploadedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
        const batch = files.slice(i, i + CONCURRENCY_LIMIT);

        const promises = batch.map(async (fileName) => {
            const filePath = path.join(photosDir, fileName);
            try {
                await uploadFile(filePath, fileName);
                uploadedCount++;
            } catch (err) {
                console.error(`❌ Failed to upload ${fileName}:`, err.message);
                errorCount++;
            }
        });

        await Promise.allSettled(promises);

        const processed = i + batch.length;
        const progress = ((processed / files.length) * 100).toFixed(1);
        if (processed % (CONCURRENCY_LIMIT * 10) === 0 || processed === files.length) {
            console.log(`[${progress}%] Uploaded ${uploadedCount}/${files.length} | ❌ Errors: ${errorCount}`);
        }
    }

    console.log(`\n✅ UPLOAD TO S3 COMPLETE`);
    console.log(`Successfully uploaded: ${uploadedCount}`);
    console.log(`Failed: ${errorCount}`);
}

startUpload().catch(console.error);

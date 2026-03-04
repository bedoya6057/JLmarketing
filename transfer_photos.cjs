const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');

// --- Config ---
const directoryPath = path.join('C:', 'Users', 'sodexo', 'Laptop Sodexo Sincronizada', 'OneDrive', 'Documentos', 'Sodexo', 'Laptop Sodexo', 'Documentos', 'Nueva carpeta', 'clon jlmarketin', 'Exceles');

const s3Client = new S3Client({
    region: 'us-east-2'
});

const BUCKET_NAME = 'encartes-jlmarketing-fotos2026';
const CONCURRENCY_LIMIT = 50;

async function runTransfer() {
    console.log(`Scanning: ${directoryPath}`);
    const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.xlsx'));

    // 1. Gather all unique URLs from excel
    const uniqueUrls = new Set();

    for (const file of files) {
        // Solo archivos de febrero (opcional: o procesar todos para estar seguros)
        if (!file.toUpperCase().includes('FEB')) continue;

        console.log(`Extracting URLs from: ${file}`);
        const filePath = path.join(directoryPath, file);
        const workbook = xlsx.readFile(filePath);

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            if (data.length <= 1) continue;

            const headers = data[0];
            const photoCols = [];

            for (let i = 0; i < headers.length; i++) {
                const header = (headers[i] || '').toString().toUpperCase();
                if (header.includes('FOTO')) {
                    photoCols.push(i);
                }
            }

            if (photoCols.length === 0) continue;

            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;

                for (const colIdx of photoCols) {
                    const cellVal = row[colIdx];
                    if (cellVal && typeof cellVal === 'string' && cellVal.startsWith('http')) {
                        uniqueUrls.add(cellVal);
                    }
                }
            }
        }
    }

    const urlArray = Array.from(uniqueUrls);
    console.log(`Found ${urlArray.length} unique image URLs to transfer.`);

    // Check credentials BEFORE doing HTTP work
    if (!process.env.AWS_ACCESS_KEY_ID) {
        require('dotenv').config({ path: path.join(__dirname, '.env') });
        s3Client.config.credentials = async () => ({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        });
    }

    let successCount = 0;
    let errorCount = 0;

    const downloadAsBuffer = (url, retry = 0) => {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                if (res.statusCode === 429 && retry < 3) {
                    setTimeout(() => resolve(downloadAsBuffer(url, retry + 1)), 2000 * (retry + 1));
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`Status: ${res.statusCode}`));
                    return;
                }
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        });
    };

    console.log(`Starting transfer to AWS bucket '${BUCKET_NAME}' in batches of ${CONCURRENCY_LIMIT}...`);

    for (let i = 0; i < urlArray.length; i += CONCURRENCY_LIMIT) {
        const batchUrls = urlArray.slice(i, i + CONCURRENCY_LIMIT);

        const promises = batchUrls.map(async (url) => {
            const parts = url.split('/');
            let filename = parts[parts.length - 1];
            filename = filename.split('?')[0];
            filename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');

            try {
                // Download from old URL into memory
                const buffer = await downloadAsBuffer(url);

                // Upload to S3
                const params = {
                    Bucket: BUCKET_NAME,
                    Key: filename,
                    Body: buffer,
                    ContentType: mime.lookup(filename) || 'image/jpeg'
                };
                await s3Client.send(new PutObjectCommand(params));
                successCount++;
            } catch (err) {
                errorCount++;
                console.error(`Failed ${url}: ${err.message}`);
                // Stop after few errors to debug quickly
                if (errorCount > 3) {
                    console.error("Too many errors. Aborting.");
                    process.exit(1);
                }
            }
        });

        await Promise.allSettled(promises);
        const processed = Math.min(i + batchUrls.length, urlArray.length);
        const progress = ((processed / urlArray.length) * 100).toFixed(1);
        console.log(`[${progress}%] Transferred ${successCount}/${urlArray.length} | ❌ Errors: ${errorCount}`);
    }

    console.log('\n✅ DIRECT TRANSFER S3 COMPLETE');
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${errorCount}`);
}

runTransfer().catch(console.error);

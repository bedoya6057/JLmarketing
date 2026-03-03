const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Adjust batch size and retry logic
const BATCH_SIZE = 15; // Download 15 photos at a time to avoid rate limiting
const MAX_RETRIES = 3;

const urlsFile = path.join(__dirname, 'photo_urls_to_download.json');
const outputDir = path.join(__dirname, 'photos_backup');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const allUrls = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));

// Function to download a single file
function downloadFile(url, dest, retries = 0) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const client = url.startsWith('https') ? https : http;

        const request = client.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else if ([301, 302].includes(response.statusCode)) {
                // Handle redirect
                file.close();
                fs.unlink(dest, () => { }); // Delete the empty file
                downloadFile(response.headers.location, dest, retries).then(resolve).catch(reject);
            } else {
                file.close();
                fs.unlink(dest, () => { });
                reject(new Error(`Server responded with ${response.statusCode}: ${response.statusMessage}`));
            }
        }).on('error', (err) => {
            file.close();
            fs.unlink(dest, () => { });
            reject(err);
        });

        // Set timeout
        request.setTimeout(15000, () => {
            request.destroy();
            reject(new Error('Request Timeout'));
        });
    }).catch(err => {
        if (retries < MAX_RETRIES) {
            // console.log(`Retrying (${retries + 1}/${MAX_RETRIES}): ${url}`);
            return downloadFile(url, dest, retries + 1);
        } else {
            throw err;
        }
    });
}

async function startDownload() {
    console.log(`Starting download of ${allUrls.length} photos to ${outputDir}...`);

    let downloadedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
        const batch = allUrls.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (url) => {
            try {
                // Extract filename from the standard Supabase URL: .../object/public/bucket/filename.jpg
                const urlParts = url.split('/');
                let filename = urlParts[urlParts.length - 1];

                // Some filenames might have query parameters (?t=123)
                filename = filename.split('?')[0];

                // Keep it safe for windows
                filename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');

                const destPath = path.join(outputDir, filename);

                // Skip if already exists (resume capability)
                if (fs.existsSync(destPath)) {
                    skippedCount++;
                    return;
                }

                await downloadFile(url, destPath);
                downloadedCount++;
            } catch (error) {
                console.error(`❌ Error downloading ${url}: ${error.message}`);
                errorCount++;
            }
        });

        await Promise.allSettled(promises);

        // Progress log
        const processed = i + batch.length;
        const progress = ((processed / allUrls.length) * 100).toFixed(1);
        if (processed % (BATCH_SIZE * 5) === 0 || processed === allUrls.length) {
            console.log(`[${progress}%] Processed ${processed}/${allUrls.length} | ⬇️ Downloaded: ${downloadedCount} | ⏭️ Skipped: ${skippedCount} | ❌ Errors: ${errorCount}`);
        }
    }

    console.log(`\n✅ DOWNLOAD COMPLETE`);
    console.log(`Result: ${downloadedCount} new, ${skippedCount} skipped, ${errorCount} failed.`);
}

startDownload().catch(console.error);

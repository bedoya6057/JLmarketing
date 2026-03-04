const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const https = require('https');
const http = require('http');

// --- Config ---
const directoryPath = path.join('C:', 'Users', 'sodexo', 'Laptop Sodexo Sincronizada', 'OneDrive', 'Documentos', 'Sodexo', 'Laptop Sodexo', 'Documentos', 'Nueva carpeta', 'clon jlmarketin', 'Exceles');
const outputDir = path.join(__dirname, 'photos_backup');
const CONCURRENCY_LIMIT = 50;

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

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
            } else if (response.statusCode === 429 && retries < 3) {
                file.close();
                fs.unlink(dest, () => { });
                setTimeout(() => resolve(downloadFile(url, dest, retries + 1)), 2000 * (retries + 1));
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

        request.setTimeout(15000, () => {
            request.destroy();
            reject(new Error('Request Timeout'));
        });
    }).catch(err => {
        if (retries < 3) {
            return downloadFile(url, dest, retries + 1);
        } else {
            throw err;
        }
    });
}

async function startDownload() {
    console.log(`Scanning: ${directoryPath}`);
    const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.xlsx'));

    const uniqueUrls = new Set();
    for (const file of files) {
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
                if (header.includes('FOTO')) photoCols.push(i);
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
    console.log(`Found ${urlArray.length} unique image URLs to download.`);
    console.log(`Starting download of ${urlArray.length} photos to ${outputDir}...`);

    let downloadedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < urlArray.length; i += CONCURRENCY_LIMIT) {
        const batch = urlArray.slice(i, i + CONCURRENCY_LIMIT);
        const promises = batch.map(async (url) => {
            try {
                const urlParts = url.split('/');
                let filename = urlParts[urlParts.length - 1];
                filename = filename.split('?')[0];
                filename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const destPath = path.join(outputDir, filename);

                if (fs.existsSync(destPath)) {
                    skippedCount++;
                    return;
                }

                await downloadFile(url, destPath);
                downloadedCount++;
            } catch (error) {
                console.error(`❌ Error ${url}: ${error.message}`);
                errorCount++;
            }
        });

        await Promise.allSettled(promises);

        const processed = Math.min(i + batch.length, urlArray.length);
        const progress = ((processed / urlArray.length) * 100).toFixed(1);
        console.log(`[${progress}%] Processed ${processed}/${urlArray.length} | ⬇️ Downloaded: ${downloadedCount} | ⏭️ Skipped: ${skippedCount} | ❌ Errors: ${errorCount}`);
    }

    console.log(`\n✅ DOWNLOAD COMPLETE`);
    console.log(`Result: ${downloadedCount} new, ${skippedCount} skipped, ${errorCount} failed.`);
}

startDownload().catch(console.error);

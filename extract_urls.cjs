const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const directoryPath = path.join('C:', 'Users', 'sodexo', 'Laptop Sodexo Sincronizada', 'OneDrive', 'Documentos', 'Sodexo', 'Laptop Sodexo', 'Documentos', 'Nueva carpeta', 'clon jlmarketin', 'Exceles');
const outputJsonPath = path.join(__dirname, 'photo_urls_to_download.json');

async function extractUrls() {
    console.log(`Analyzing directory: ${directoryPath}`);
    const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.xlsx'));
    console.log(`Found ${files.length} Excel files.`);

    const allUrls = new Set();
    let totalRowsProcessed = 0;

    for (const file of files) {
        console.log(`Processing: ${file}`);
        const filePath = path.join(directoryPath, file);
        const workbook = xlsx.readFile(filePath);

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            if (data.length <= 1) continue; // Skip empty or header-only sheets

            const headers = data[0];
            const photoColumnIndices = [];

            // Find indices of columns that might contain photos
            headers.forEach((h, index) => {
                if (typeof h === 'string' && h.toLowerCase().includes('foto')) {
                    photoColumnIndices.push({ index, name: h });
                }
            });

            if (photoColumnIndices.length === 0) continue;

            // Extract URLs
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row) continue;
                totalRowsProcessed++;

                for (const col of photoColumnIndices) {
                    const cellValue = row[col.index];
                    if (typeof cellValue === 'string' && cellValue.trim() !== '') {
                        // Sometimes there are multiple URLs in one cell, or weird formatting.
                        // We extract anything that starts with http
                        const urls = cellValue.split(/[\s,]+/).filter(u => u.startsWith('http'));
                        for (const url of urls) {
                            // Validate it's from the lovable supabase to avoid junk
                            if (url.includes('mznbbplygemkbolqcjjn.supabase.co/storage')) {
                                allUrls.add(url);
                            }
                        }
                    }
                }
            }
        }
    }

    const uniqueUrls = Array.from(allUrls);
    console.log(`\n--- SUMMARY ---`);
    console.log(`Total rows scanned: ${totalRowsProcessed}`);
    console.log(`Total unique valid photo URLs found: ${uniqueUrls.length}`);

    fs.writeFileSync(outputJsonPath, JSON.stringify(uniqueUrls, null, 2));
    console.log(`Saved URLs to ${outputJsonPath}`);
}

extractUrls().catch(console.error);

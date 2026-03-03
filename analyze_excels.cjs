const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const directoryPath = path.join('C:', 'Users', 'sodexo', 'Laptop Sodexo Sincronizada', 'OneDrive', 'Documentos', 'Sodexo', 'Laptop Sodexo', 'Documentos', 'Nueva carpeta', 'clon jlmarketin', 'Exceles');

async function analyzeDirectory() {
    console.log(`Analyzing directory: ${directoryPath}`);
    const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.xlsx'));
    console.log(`Found ${files.length} Excel files.`);

    if (files.length === 0) return;

    // Analyze the first file to understand the column structure
    const firstFile = path.join(directoryPath, files[0]);
    console.log(`\nAnalyzing structure of: ${files[0]}`);

    const workbook = xlsx.readFile(firstFile);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    if (data.length > 0) {
        const headers = data[0];
        console.log(`Headers found:`, headers);

        let photoColumns = headers.filter(h => typeof h === 'string' && h.toLowerCase().includes('foto'));
        console.log(`Potential photo columns:`, photoColumns);

        if (data.length > 1) {
            console.log(`Sample data from first row:`);
            headers.forEach((h, i) => {
                if (photoColumns.includes(h)) {
                    console.log(`  ${h}: ${data[1][i]}`);
                }
            });
        }
    }
}

analyzeDirectory().catch(console.error);

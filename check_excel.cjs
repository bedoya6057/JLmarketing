const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const directoryPath = path.join('C:', 'Users', 'sodexo', 'Laptop Sodexo Sincronizada', 'OneDrive', 'Documentos', 'Sodexo', 'Laptop Sodexo', 'Documentos', 'Nueva carpeta', 'clon jlmarketin', 'Exceles');
const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.xlsx'));

if (files.length > 0) {
    const file = files[0];
    console.log(`Reading ${file}...`);
    const workbook = xlsx.readFile(path.join(directoryPath, file));
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const headers = data[0];
    const fotoIndex = headers.findIndex(h => h && h.toString().toUpperCase() === 'FOTO');
    if (fotoIndex > -1 && data.length > 1) {
        console.log(`Foto URL starting row 1:`, data[1][fotoIndex]);
    } else {
        console.log(`Column FOTO not found or no data.`);
    }
}

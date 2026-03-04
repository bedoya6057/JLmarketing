const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// Configuración Supabase
const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';
const supabase = createClient(supabaseUrl, supabaseKey);

const directoryPath = path.join('C:', 'Users', 'sodexo', 'Laptop Sodexo Sincronizada', 'OneDrive', 'Documentos', 'Sodexo', 'Laptop Sodexo', 'Documentos', 'Nueva carpeta', 'clon jlmarketin', 'Exceles');
const BUCKET_NAME = 'encartes-jlmarketing-fotos2026';
const REGION = 'us-east-2';
const NEW_AWS_BASE_URL = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/`;

function computeExpectedS3Url(originalUrl) {
    if (!originalUrl) return null;
    const parts = originalUrl.split('/');
    let filename = parts[parts.length - 1];
    filename = filename.split('?')[0];
    filename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return NEW_AWS_BASE_URL + filename;
}

function checkImageExists(url) {
    return new Promise((resolve) => {
        https.request(url, { method: 'HEAD' }, (res) => {
            resolve(res.statusCode === 200);
        }).on('error', () => resolve(false)).end();
    });
}

async function verifyExcelRows(fileName, isExhibicion) {
    console.log(`\n\n=== Validando Excel: ${fileName} ===`);
    const filePath = path.join(directoryPath, fileName);
    const workbook = xlsx.readFile(filePath);

    let validRows = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        if (data.length <= 1) continue;

        const headers = data[0];
        const fotoIdx = headers.findIndex(h => h && h.toString().toUpperCase().includes('FOTO'));

        let tiendaIdx = headers.findIndex(h => h && ['TIENDA', 'LOCAL'].includes(h.toString().toUpperCase().trim()));
        let productoIdx = headers.findIndex(h => h && h.toString().toUpperCase().trim() === 'PRODUCTO');
        // Let's fallback to "CATEGORIA" or "ENCARTE" parameter if it's exhibicion

        if (fotoIdx > -1) {
            for (let i = 1; i < data.length; i++) {
                if (data[i][fotoIdx] && data[i][fotoIdx].startsWith('http')) {
                    validRows.push({
                        tienda: tiendaIdx > -1 ? data[i][tiendaIdx] : null,
                        producto: productoIdx > -1 ? data[i][productoIdx] : null,
                        originalUrl: data[i][fotoIdx]
                    });
                }
            }
        }
    }

    if (validRows.length === 0) {
        console.log("No se encontraron filas con fotos en este Excel.");
        return;
    }

    // Tomamos 3 filas al azar de este Excel
    const sampleSize = Math.min(3, validRows.length);
    const samples = validRows.sort(() => 0.5 - Math.random()).slice(0, sampleSize);

    for (let sample of samples) {
        console.log(`\n-- Evaluando Fila Aleatoria --`);
        console.log(`Buscando en Supabase: Tienda=${sample.tienda}, Producto=${sample.producto}`);
        console.log(`Link original (Excel): ${sample.originalUrl}`);

        const expectedAWSUrl = computeExpectedS3Url(sample.originalUrl);
        console.log(`Link esperado (AWS): ${expectedAWSUrl}`);

        // Consultar a Supabase
        const tableName = isExhibicion ? 'respuestas_exhibicion' : 'respuestas';
        let query = supabase.from(tableName).select('foto').eq('foto', expectedAWSUrl).limit(1);

        const { data, error } = await query;
        if (error) {
            console.error(`Error Supabase: ${error.message}`);
        } else if (data && data.length > 0) {
            console.log(`✅ ¡ENCONTRADO EN LA BASE DE DATOS! El registro de la tabla ${tableName} tiene exactamente este link.`);

            // Probar si el S3 link sirve en la vida real
            process.stdout.write(`Testeando el link de AWS S3 por HTTP... `);
            const exists = await checkImageExists(expectedAWSUrl);
            if (exists) {
                console.log(`✅ ¡ÉXITO! La imagen fisica existe en Amazon S3 y carga correctamente.`);
            } else {
                console.log(`❌ FALLÓ. La base de datos tiene el link, pero S3 dice Not Found. (Rate limit o no subio bien)`);
            }
        } else {
            console.log(`❌ NO ENCONTRADO EN BD. El record con ese AWS link no se encontró en Supabase.`);
        }
    }
}

async function runTests() {
    const files = fs.readdirSync(directoryPath).filter(f => f.toUpperCase().includes('FEB') && f.endsWith('.xlsx'));

    // Choose 1 ENCARTE and 1 EXHIBICION
    const encartes = files.filter(f => !f.toUpperCase().includes('EXHIBICION'));
    const exhs = files.filter(f => f.toUpperCase().includes('EXHIBICION'));

    if (encartes.length > 0) await verifyExcelRows(encartes[0], false);
    if (exhs.length > 0) await verifyExcelRows(exhs[0], true);

    process.exit(0);
}

runTests();

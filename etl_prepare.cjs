const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const directoryPath = path.join('C:', 'Users', 'sodexo', 'Laptop Sodexo Sincronizada', 'OneDrive', 'Documentos', 'Sodexo', 'Laptop Sodexo', 'Documentos', 'Nueva carpeta', 'clon jlmarketin', 'Exceles');
const outputRespuestas = path.join(__dirname, 'db_respuestas.json');
const outputExhibicion = path.join(__dirname, 'db_respuestas_exhibicion.json');

const BATCH_SIZE = 1000;

function parseDateFromExcel(excelDate) {
    if (!excelDate) return null;
    if (typeof excelDate === 'number') {
        const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Excel Windows 1900 format
        return date.toISOString();
    }
    return excelDate.toString(); // Fallback
}

// Map function for Encarteses (respuestas)
function mapToRespuestas(row, headers, fileName) {
    const getValue = (keyName) => {
        const index = headers.findIndex(h => h && h.toUpperCase() === keyName.toUpperCase());
        return index > -1 ? row[index] : null;
    };

    const getBool = (v) => {
        if (v === true || v === 1) return true;
        if (!v || typeof v !== 'string') return false;
        const normalized = v.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalized === 'SI') return true;
        if (normalized === 'NO') return false;
        return false;
    };
    const getNum = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

    // Format new domain for photos:
    // Old: https://mznbbplygemkbolqcjjn.supabase.co/storage/v1/object/public/encarte-photos/filename.jpg
    // New: We just want to keep the URL text, or better yet, rewrite it to your new Supabase URL?
    // Actually, it's safer to just point to the relative filename if possible, or build the new URL.
    // Let's rewrite URLs to point to your new Supabase project ID "ypwubwjpeqbpsujmopfy"
    const transformPhoto = (url) => {
        if (!url || typeof url !== 'string') return null;
        return url;
    };

    return {
        año: getNum(getValue('AÑO')),
        mes_cod: getNum(getValue('MES_COD')),
        mes: getValue('MES'),
        fecha: parseDateFromExcel(getValue('FECHA')) || new Date().toISOString(),
        encarte: getValue('ENCARTE'),
        encargado: getValue('ENCARGADO'),
        encargado_2: getValue('ENCARGADO 2'),
        ciudad_cadena: getValue('CIUDAD/CADENA'),
        ciudad: getValue('CIUDAD'),
        bandera: getValue('BANDERA'),
        tienda: getValue('TIENDA'),
        macrocategoria: getValue('MACROCATEGORIA'),
        categoria: getValue('CATEGORIA'),
        cod_interno: getValue('COD INTERNO'),
        producto: getValue('PRODUCTO'),
        precio_encarte: getNum(getValue('PRECIO ENCARTE')),
        precio_encontrado: getNum(getValue('PRECIO ENCONTRADO')),
        precio_tarjeta: getNum(getValue('PRECIO TARJETA')),
        presencia_producto: getBool(getValue('PRESENCIA PRODUCTO')),
        presencia_cartel: getBool(getValue('PRESENCIA CARTEL')),
        presencia_cartel_con_tarjeta: getBool(getValue('PRESENCIA CARTEL CON TARJETA')),
        obs_1: getValue('OBS 1'),
        foto: transformPhoto(getValue('FOTO') || getValue('FOTO SALIDA') || getValue('FOTO REGISTRO')), // Prioritize actual photo
        foto_registro: transformPhoto(getValue('FOTO REGISTRO')),
        foto_salida: transformPhoto(getValue('FOTO SALIDA')),
        origen_excel: fileName // GUARDAMOS EL NOMBRE DEL ARCHIVO
    };
}

// Map function for Exhibicion
function mapToExhibicion(row, headers, fileName) {
    const getValue = (keyName) => {
        const index = headers.findIndex(h => h && h.toUpperCase() === keyName.toUpperCase());
        return index > -1 ? row[index] : null;
    };

    // We will apply the same rewrite to new Supabase
    const transformPhoto = (url) => {
        if (!url || typeof url !== 'string') return null;
        return url;
    };

    const getBool = (v) => {
        if (v === true || v === 1) return true;
        if (!v || typeof v !== 'string') return false;
        const normalized = v.toString().trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalized === 'SI') return true;
        if (normalized === 'NO') return false;
        return false;
    };

    return {
        bandera: getValue('BANDERA'),
        ciudad: getValue('CIUDAD'),
        cod_producto: getValue('COD PRODUCTO') || getValue('COD INTERNO'),
        codigo_exhibicion: getValue('CODIGO EXHIBICION'),
        descripcion_producto: getValue('DESCRIPCION PRODUCTO') || getValue('PRODUCTO') || 'Sin descripción',
        encargado: getValue('ENCARGADO'),
        encargado_2: getValue('ENCARGADO 2') || getValue('ENCARGADO_APOYO'),
        fecha: parseDateFromExcel(getValue('FECHA')) || new Date().toISOString(),
        foto: transformPhoto(getValue('FOTO') || getValue('FOTO PRODUCTO')),
        foto_registro: transformPhoto(getValue('FOTO REGISTRO') || getValue('FOTO INGRESO')),
        linea: getValue('LINEA'),
        observaciones: getValue('OBSERVACIONES'),
        precio_tarjeta: parseFloat(getValue('PRECIO TARJETA')),
        presencia_cartel_con_tarjeta: getBool(getValue('PRESENCIA CARTEL CON TARJETA')),
        presencia_exhibicion: getValue('PRESENCIA EXHIBICION'),
        seccion: getValue('SECCION'),
        tienda: getValue('TIENDA'),
        tipo_exhibicion: getValue('TIPO DE EXHIBICION') || getValue('TIPO EXHIBICION'),
        ubicacion: getValue('UBICACION'),
        origen_excel: fileName
    };
}

async function prepareETL() {
    console.log(`Analyzing directory: ${directoryPath}`);
    const files = fs.readdirSync(directoryPath).filter(f => f.endsWith('.xlsx'));

    const dbRespuestas = [];
    const dbExhibiciones = [];

    for (const file of files) {
        console.log(`Processing: ${file}`);
        const isExhibicion = file.toLowerCase().includes('exhibicion');
        const filePath = path.join(directoryPath, file);
        const workbook = xlsx.readFile(filePath);

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

            if (data.length <= 1) continue;

            const headers = data[0];

            // Validate headers briefly
            const hasProducto = headers.some(h => typeof h === 'string' && h.toUpperCase().includes('PRODUCTO'));
            if (!hasProducto) continue; // Skip irrelevant sheets

            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row || row.length === 0) continue;

                if (isExhibicion) {
                    const mapped = mapToExhibicion(row, headers, file);
                    // Filter empty rows
                    if (mapped.tienda || mapped.descripcion_producto) {
                        dbExhibiciones.push(mapped);
                    }
                } else {
                    const mapped = mapToRespuestas(row, headers, file);
                    if (mapped.encarte || mapped.tienda) {
                        dbRespuestas.push(mapped);
                    }
                }
            }
        }
    }

    console.log(`\n--- SUMMARY ---`);
    console.log(`Total rows mapped to 'respuestas' (Encartes): ${dbRespuestas.length}`);
    console.log(`Total rows mapped to 'respuestas_exhibicion': ${dbExhibiciones.length}`);

    fs.writeFileSync(outputRespuestas, JSON.stringify(dbRespuestas, null, 2));
    fs.writeFileSync(outputExhibicion, JSON.stringify(dbExhibiciones, null, 2));

    console.log(`Saved transformed data to JSON files locally.`);
}

prepareETL().catch(console.error);

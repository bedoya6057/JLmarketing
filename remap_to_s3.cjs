const fs = require('fs');
const path = require('path');

// Leer los archivos JSON de DB que generamos antes
const dbRespuestasFile = path.join(__dirname, 'db_respuestas.json');
const dbExhibicionesFile = path.join(__dirname, 'db_respuestas_exhibicion.json');

const BUCKET_NAME = 'encartes-jlmarketing-fotos2026';
const REGION = 'us-east-2';
const NEW_AWS_BASE_URL = `https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/`;

function updateUrlsInArray(arr) {
    let updatedRows = 0;
    const newArr = arr.map(row => {
        let changed = false;

        const rewriteLogic = (url) => {
            if (!url) return null;
            // The old urls mapped them either originally or we rewrote it to 'ypwubwj...supabase.co'
            // We need to extract just the FILENAME from the end of it
            const parts = url.split('/');
            let filename = parts[parts.length - 1];
            filename = filename.split('?')[0]; // Remove query params
            filename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_'); // Same sanitize we used to save to disk

            changed = true;
            return NEW_AWS_BASE_URL + filename;
        };

        if (row.foto) row.foto = rewriteLogic(row.foto);
        if (row.foto_registro) row.foto_registro = rewriteLogic(row.foto_registro);
        if (row.foto_salida) row.foto_salida = rewriteLogic(row.foto_salida);

        if (changed) updatedRows++;
        return row;
    });

    return { newArr, updatedRows };
}

function reMapDatabases() {
    console.log('Remapping PostgreSQL values to new AWS S3 URLs...');

    if (fs.existsSync(dbRespuestasFile)) {
        let encartesData = JSON.parse(fs.readFileSync(dbRespuestasFile, 'utf8'));
        const { newArr, updatedRows } = updateUrlsInArray(encartesData);
        fs.writeFileSync(dbRespuestasFile, JSON.stringify(newArr, null, 2));
        console.log(`✅ Updated Encartes: Mapped AWS URLs on ${updatedRows} registers.`);
    }

    if (fs.existsSync(dbExhibicionesFile)) {
        let exhibicionData = JSON.parse(fs.readFileSync(dbExhibicionesFile, 'utf8'));
        const { newArr, updatedRows } = updateUrlsInArray(exhibicionData);
        fs.writeFileSync(dbExhibicionesFile, JSON.stringify(newArr, null, 2));
        console.log(`✅ Updated Exhibiciones: Mapped AWS URLs on ${updatedRows} registers.`);
    }
}

reMapDatabases();

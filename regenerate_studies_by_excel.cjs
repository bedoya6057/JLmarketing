const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const crypto = require('crypto');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

const supabase = createClient(supabaseUrl, supabaseKey);

function generateDeterministicUUID(input) {
    const hash = crypto.createHash('md5').update(input).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-8${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
}

// Limpia extensiones como "_2026-02-25.xlsx" y prefijos
function cleanExcelName(filename) {
    if (!filename) return "Estudio Desconocido";
    let name = filename.replace('.xlsx', '');
    name = name.replace(/_\d{4}-\d{2}-\d{2}$/, '');
    name = name.replace(/^exhibicion_/i, '');
    return name.trim();
}

const BATCH_SIZE = 500;

async function rebuildStudiesFromJSONs() {
    console.log("🛠️ Iniciando reconstrucción y actualización histórica...");

    const filesToMerge = [
        { json: 'db_respuestas_exhibicion.json', masterTable: 'exhibiciones', detailTable: 'respuestas_exhibicion', relIdKey: 'exhibicion_id' },
        { json: 'db_respuestas.json', masterTable: 'encartes', detailTable: 'respuestas', relIdKey: 'encarte_id' }
    ];

    for (const job of filesToMerge) {
        console.log(`\n===========================================`);
        console.log(`[>>] Procesando ${job.masterTable.toUpperCase()}...`);
        const jsonPath = path.join(__dirname, job.json);

        if (!fs.existsSync(jsonPath)) {
            console.log(`❌ No encontrado: ${job.json}`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const groupsMap = new Map();

        // El usuario necesita agrupar sus fotos y registros historicos
        // basándose en el excel original de donde fue extraido.
        console.log(`Organizando ${data.length} registros desde el JSON local...`);

        // Agrupar y crear Maestros
        data.forEach(row => {
            const cleanName = cleanExcelName(row.origen_excel);
            // El groupKey determina cuantas carpetas ("Estudios") maestras se van a crear
            // Agrupamos estrictamente por Archivo Excel para generar 1 solo Estudio por Excel
            const groupKey = `${row.origen_excel}`;
            const masterUUID = generateDeterministicUUID(groupKey);

            if (!groupsMap.has(groupKey)) {
                groupsMap.set(groupKey, {
                    masterData: {
                        id: masterUUID,
                        nombre: cleanName,
                        fecha: row.fecha || new Date().toISOString().split('T')[0],
                        bandera: row.bandera || 'Generica',
                        ciudad: row.ciudad || 'Nacional',
                        estado: 'completado', // Estudio finalizado (historico)
                        created_by: 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e' // Admin dummy
                    },
                    // Listamos cada fila de RAW data que va a ir a Supabase
                    childRowsToUpsert: []
                });
            }

            // Inyectamos el masterID a la fila raw
            const rowWithParentLink = { ...row };
            rowWithParentLink[job.relIdKey] = masterUUID;
            rowWithParentLink.created_by = 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e';

            // Eliminar ForeignKeys si no son UUIDs reales
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (rowWithParentLink.encargado_2 && !String(rowWithParentLink.encargado_2).match(uuidPattern)) {
                delete rowWithParentLink.encargado_2;
            }
            if (rowWithParentLink.encargado && !String(rowWithParentLink.encargado).match(uuidPattern)) {
                delete rowWithParentLink.encargado;
            }

            // Limpiamos strings vacios para que Postgres no llore
            Object.keys(rowWithParentLink).forEach(k => {
                if (rowWithParentLink[k] === "") delete rowWithParentLink[k];
            });

            delete rowWithParentLink.origen_excel;

            if (job.detailTable === 'respuestas') delete rowWithParentLink.foto_salida;

            groupsMap.get(groupKey).childRowsToUpsert.push(rowWithParentLink);
        });

        // 1. INYECTAR LOS MAESTROS
        console.log(`\n>> Limpiando Maestros históricos previos en [${job.masterTable}]...`);
        await supabase.from(job.masterTable).delete().eq('created_by', 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e');

        const uniqueMasters = Array.from(groupsMap.values()).map(g => g.masterData);
        console.log(`[+] Creados ${uniqueMasters.length} Estudios Maestros de ${job.masterTable}`);

        for (let i = 0; i < uniqueMasters.length; i += 50) {
            const chunk = uniqueMasters.slice(i, i + 50);
            const { error } = await supabase.from(job.masterTable).upsert(chunk, { onConflict: 'id' });
            if (error) console.error(`Error inyectando cabeceras ${job.masterTable}:`, error);
        }

        // 2. RESUBIR RESPUESTAS CON EL ENLACE HECHO (UPSERT a Supabase borra el UUID nulo anterior o inserta)
        console.log(`\n[+] Actualizando detalles en la base de datos (${job.detailTable})...`);
        const allChildren = Array.from(groupsMap.values()).flatMap(v => v.childRowsToUpsert);
        const deduplicated = [];

        // Supabase requiere IDs en Upsert si queremos sobrescribir. A falta de ellos (es complejo extraer su UUID autogenerado via REST y hacer match porque no hay un key unico mas q todos los datos juntos),
        // Lo que haremos es vaciar la tabla actual e insertar estos +50k super rapido en bulks,
        // ya que el JSON contiene EL 100% de la informacion recien extraida con el nombre limpio.
        // Pero vaciar la tabla puede ser riesgoso si algun registro de PRUEBA actual se hizo en vivo ayer.
        // Haremos insert directo con onConflict ignorado, o Upsert si le proveemos un ID precreado al JSON para el futuro.

        // Dado que la ETL la corrimos fresca, vaciar e insertar asegura 100% consistencia.
        console.log(`>> Vaciando histórico sucio previo en [${job.detailTable}] ...`);

        // DELETE from table where created_by is our migration dummy
        await supabase.from(job.detailTable).delete().eq('created_by', 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e');

        console.log(`>> Inyectando RAW final con enlaces correctos a Maestros ...`);
        let success = 0;
        for (let i = 0; i < allChildren.length; i += BATCH_SIZE) {
            const batch = allChildren.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(job.detailTable).insert(batch);
            if (error) {
                console.error(`Error insert batch ${i}:`, error.message);
            } else {
                success += batch.length;
                console.log(`Progreso ${job.detailTable}: ${success} / ${allChildren.length}`);
            }
        }
    }

    console.log("\n✅ RECONSTRUCCIÓN FINALIZADA PERFECTAMENTE.");
}

rebuildStudiesFromJSONs();

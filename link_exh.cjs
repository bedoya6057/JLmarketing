const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function linkExh() {
    console.log("Obteniendo exhibiciones de la tabla maestra...");
    const { data: exhibiciones, error: errEnc } = await supabase.from('exhibiciones').select('id, bandera, fecha');
    if (errEnc) return console.error(errEnc);

    // Crear mapa (bandera_fecha) -> UUID
    const exhMap = {};
    for (const en of exhibiciones) {
        if (!en.bandera || !en.fecha) continue;
        const key = `${en.bandera.trim().toLowerCase()}_${en.fecha.substring(0, 10)}`;
        exhMap[key] = en.id;
    }

    console.log(`Buscando respuestas_exhibicion con exhibicion_id nulo...`);
    let allRespuestas = [];
    let page = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: pageData, error } = await supabase
            .from('respuestas_exhibicion')
            .select('id, bandera, fecha')
            .is('exhibicion_id', null)
            .range(page * limit, (page + 1) * limit - 1);

        if (error) return console.error(error);
        if (pageData.length > 0) {
            allRespuestas = allRespuestas.concat(pageData);
            page++;
        }
        if (pageData.length < limit) hasMore = false;
    }

    console.log(`Encontradas ${allRespuestas.length} respuestas_exhibicion. Preparando batch...`);

    let successCount = 0;
    const recordsToUpdate = [];

    for (const resp of allRespuestas) {
        if (!resp.bandera || !resp.fecha) continue;
        const key = `${resp.bandera.trim().toLowerCase()}_${resp.fecha.substring(0, 10)}`;
        let matchedId = exhMap[key];

        if (matchedId) {
            recordsToUpdate.push({
                id: resp.id,
                exhibicion_id: matchedId,
                created_by: 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e' // Satisfy RLS
            });
        }
    }

    console.log(`Actualizando ${recordsToUpdate.length} registros...`);
    const batchSize = 1000;
    for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
        const batch = recordsToUpdate.slice(i, i + batchSize);
        const { error } = await supabase.from('respuestas_exhibicion').upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
        if (error) {
            console.error(`Error chunk ${i}:`, error.message);
        } else {
            successCount += batch.length;
            console.log(`✅ Actualizados ${successCount}/${recordsToUpdate.length}`);
        }
    }
    console.log("🎉 Proceso finalizado.");
}

linkExh();

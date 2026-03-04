const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function linkEncarteIds() {
    console.log("Obteniendo encartes de la tabla maestra...");
    const { data: encartes, error: errEnc } = await supabase.from('encartes').select('id, nombre');
    if (errEnc) {
        console.error("Error al obtener encartes:", errEnc.message);
        return;
    }

    // Crear mapa Nombre -> UUID
    const encarteMap = {};
    for (const en of encartes) {
        encarteMap[en.nombre.trim().toLowerCase()] = en.id;
    }

    console.log(`Buscando respuestas con encarte_id nulo...`);

    let allRespuestas = [];
    let page = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: respuestasPage, error: errResp } = await supabase
            .from('respuestas')
            .select('id, encarte')
            .is('encarte_id', null)
            .range(page * limit, (page + 1) * limit - 1);

        if (errResp) {
            console.error("Error al obtener respuestas sin id:", errResp.message);
            return;
        }

        if (respuestasPage.length > 0) {
            allRespuestas = allRespuestas.concat(respuestasPage);
            page++;
        }

        if (respuestasPage.length < limit) {
            hasMore = false;
        }
    }

    console.log(`Encontradas ${allRespuestas.length} respuestas sin encarte_id. Iniciando parcheo masivo en bloques...`);

    let successCount = 0;
    let fallbackCount = 0;
    const batchSize = 1000;
    const recordsToUpdate = [];

    // Emparejar
    for (const resp of allRespuestas) {
        if (!resp.encarte) continue;

        const cleanName = resp.encarte.trim().toLowerCase();
        let matchedId = encarteMap[cleanName];

        // Intento de fallback (algunos Excels tienen espacios extra)
        if (!matchedId) {
            const fuzzyMatch = Object.keys(encarteMap).find(key => key.includes(cleanName) || cleanName.includes(key));
            if (fuzzyMatch) {
                matchedId = encarteMap[fuzzyMatch];
                fallbackCount++;
            }
        }

        if (matchedId) {
            recordsToUpdate.push({
                id: resp.id,
                encarte_id: matchedId,
                created_by: 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e' // Satisfy RLS
            });
        }
    }

    console.log(`Se prepararon ${recordsToUpdate.length} actualizaciones (con ${fallbackCount} coincidencias difusas). Ejecutando upsert...`);

    // Subir en chunks usando Promise.all
    for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
        const batch = recordsToUpdate.slice(i, i + batchSize);
        // Usamos upsert ya que enviamos id + encarte_id para actualizar ese campo
        const { error } = await supabase.from('respuestas').upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
        if (error) {
            console.error(`Error en chunk ${i}:`, error.message);
        } else {
            successCount += batch.length;
            console.log(`✅ Actualizados ${successCount}/${recordsToUpdate.length}`);
        }
    }

    console.log("🎉 Proceso finalizado.");
}

linkEncarteIds();

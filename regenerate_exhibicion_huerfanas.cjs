const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const crypto = require('crypto');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

const supabase = createClient(supabaseUrl, supabaseKey);

// Función para generar un UUID V4 determinista basado en un string (hash)
function generateDeterministicUUID(input) {
    const hash = crypto.createHash('md5').update(input).digest('hex');
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-8${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
}

async function regenerateExhibicionesConHuérfanos() {
    console.log("\n🔍 Escaneando 'respuestas_exhibicion' huérfanas agrupando por Fecha+Bandera+Ciudad...");

    let allGroupsMap = new Map();
    let from = 0;
    let limit = 5000;
    let hasMore = true;

    while (hasMore) {
        // En esta vuelta buscamos los que tengan exhibicion_id NULL
        const { data, error } = await supabase.from('respuestas_exhibicion').select('id, fecha, bandera, ciudad').is('exhibicion_id', null).range(from, from + limit - 1);
        if (error) { console.error("Error pidiendo datos", error); break; }

        if (data.length === 0) {
            hasMore = false;
        } else {
            console.log(`Cargadas ${data.length} respuestas_exhibicion huérfanas (Desde ${from})`);
            data.forEach(row => {
                // Normalizar la llave para que todas las respuestas de misma fecha-bandera-ciudad vayan al mismo Maestro
                const groupKey = `${row.fecha}_${row.bandera}_${row.ciudad}`;
                const masterUUID = generateDeterministicUUID(groupKey);

                if (!allGroupsMap.has(groupKey)) {
                    allGroupsMap.set(groupKey, {
                        masterData: {
                            id: masterUUID,
                            nombre: `Exhibición Histórica - ${row.bandera}`,
                            fecha: row.fecha || new Date().toISOString().split('T')[0],
                            bandera: row.bandera || 'Generica',
                            ciudad: row.ciudad || 'Nacional',
                            estado: 'completado',
                            created_by: 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e' // ID del migrador
                        },
                        childIds: [] // Guardamos los IDs de respuestas para atarlos después
                    });
                }
                // Metemos la respuesta huérfana en la bolsa del Maestro
                allGroupsMap.get(groupKey).childIds.push(row.id);
            });
            from += limit;
        }
    }

    const uniqueGroups = Array.from(allGroupsMap.values());
    console.log(`\n✅ Calculadas ${uniqueGroups.length} exhibiciones maestras únicas para agrupar.`);

    if (uniqueGroups.length > 0) {
        console.log("\n[1/2] Inyectando Exhibiciones Maestras en Supabase...");

        const mastersToInsert = uniqueGroups.map(g => g.masterData);
        for (let i = 0; i < mastersToInsert.length; i += 50) {
            const chunk = mastersToInsert.slice(i, i + 50);
            const { error } = await supabase.from('exhibiciones').upsert(chunk, { onConflict: 'id' });
            if (error) {
                console.error("❌ Error subiendo lote de Exhibiciones:", error.message || error);
            }
        }
        console.log("🚀 Exhibiciones Maestras inyectadas exitosamente.");

        console.log("\n[2/2] Actualizando 'exhibicion_id' de las Respuestas huérfanas...");
        let totalUpdated = 0;

        for (const group of uniqueGroups) {
            const masterId = group.masterData.id;
            const childIds = group.childIds;

            // Actualizamos los hijos en sub-chunks para no hacer URLs muy largas en la API REST
            for (let j = 0; j < childIds.length; j += 100) {
                const idChunk = childIds.slice(j, j + 100);
                const { error } = await supabase
                    .from('respuestas_exhibicion')
                    .update({ exhibicion_id: masterId })
                    .in('id', idChunk);

                if (error) {
                    console.error(`Error actualizando Hijos del Master ${masterId}:`, error.message);
                } else {
                    totalUpdated += idChunk.length;
                }
            }
        }
        console.log(`🚀 Vinculación FINALIZADA. Se actualizaron ${totalUpdated} respuestas_exhibicion exitosamente.`);
    } else {
        console.log("No se encontraron respuestas huérfanas pendientes.");
    }
}

regenerateExhibicionesConHuérfanos();

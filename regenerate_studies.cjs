const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

if (!supabaseUrl || !supabaseKey) {
    console.error("No se encontraron las credenciales de Supabase");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function regenerateEncartes() {
    console.log("🔍 Escaneando IDs de encartes únicos dentro de 'respuestas'...");

    // Al no poder hacer un SELECT DISTINCT en RestAPI Supabase plano, sacamos los grupos vía raw data
    // Traemos de a 5000 para no reventar memoria
    let allIdsMap = new Map();

    let from = 0;
    let limit = 5000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase.from('respuestas').select('encarte_id, fecha, bandera, ciudad, encarte').range(from, from + limit - 1);
        if (error) { console.error("Error pidiendo datos", error); break; }

        if (data.length === 0) {
            hasMore = false;
        } else {
            console.log(`Cargadas ${data.length} respuestas (Desde ${from})`);
            data.forEach(row => {
                if (row.encarte_id && !allIdsMap.has(row.encarte_id)) {
                    // Capturar la metadata del primer producto que encontremos para este encarte_id
                    allIdsMap.set(row.encarte_id, {
                        id: row.encarte_id,
                        nombre: row.encarte || `Encarte Histórico - ${row.bandera}`,
                        fecha: row.fecha || new Date().toISOString().split('T')[0],
                        bandera: row.bandera || 'Generica',
                        ciudad: row.ciudad || 'Nacional',
                        estado: 'completado', // Auto-terminado ya que es histórico
                        created_by: 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e' // ID del migrador
                    });
                }
            });
            from += limit;
        }
    }

    const uniqueEncartes = Array.from(allIdsMap.values());
    console.log(`\n✅ Encontrados ${uniqueEncartes.length} encartes únicos a partir de respuestas.`);

    if (uniqueEncartes.length > 0) {
        console.log("Inyectando Encartes en Supabase...");
        const { error } = await supabase.from('encartes').upsert(uniqueEncartes, { onConflict: 'id' });
        if (error) {
            console.error("❌ Error subiendo Encartes:", error);
        } else {
            console.log("🚀 Encartes regenerados exitosamente.");
        }
    }
}

async function regenerateExhibiciones() {
    console.log("\n🔍 Escaneando IDs únicos dentro de 'respuestas_exhibicion'...");

    let allIdsMap = new Map();
    let from = 0;
    let limit = 5000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase.from('respuestas_exhibicion').select('encarte_id, fecha, bandera, ciudad, encarte_nombre').range(from, from + limit - 1);
        if (error) { console.error("Error pidiendo datos", error); break; }

        if (data.length === 0) {
            hasMore = false;
        } else {
            console.log(`Cargadas ${data.length} exhibiciones (Desde ${from})`);
            data.forEach(row => {
                if (row.encarte_id && !allIdsMap.has(row.encarte_id)) {
                    allIdsMap.set(row.encarte_id, {
                        id: row.encarte_id,
                        nombre: row.encarte_nombre || `Exhibición Histórica - ${row.bandera}`,
                        fecha: row.fecha || new Date().toISOString().split('T')[0],
                        bandera: row.bandera || 'Generica',
                        ciudad: row.ciudad || 'Nacional',
                        estado: 'completado',
                        created_by: 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e'
                    });
                }
            });
            from += limit;
        }
    }

    const uniqueExhibiciones = Array.from(allIdsMap.values());
    console.log(`\n✅ Encontradas ${uniqueExhibiciones.length} exhibiciones maestras únicas.`);

    if (uniqueExhibiciones.length > 0) {
        console.log("Inyectando Exhibiciones en Supabase...");
        const { error } = await supabase.from('exhibiciones').upsert(uniqueExhibiciones, { onConflict: 'id' });
        if (error) {
            console.error("❌ Error subiendo Exhibiciones:", error);
        } else {
            console.log("🚀 Exhibiciones regeneradas exitosamente.");
        }
    }
}

async function start() {
    await regenerateEncartes();
    await regenerateExhibiciones();
    console.log("\n=== PROCESO DE REGENERACIÓN FINALIZADO ===");
}

start();

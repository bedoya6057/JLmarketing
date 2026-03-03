const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function regenerateExhibiciones() {
    console.log("\n🔍 Escaneando IDs únicos dentro de 'respuestas_exhibicion'...");

    let allIdsMap = new Map();
    let from = 0;
    let limit = 5000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase.from('respuestas_exhibicion').select('exhibicion_id, fecha, bandera, ciudad').range(from, from + limit - 1);
        if (error) { console.error("Error pidiendo datos", error); break; }

        if (data.length === 0) {
            hasMore = false;
        } else {
            console.log(`Cargadas ${data.length} respuestas_exhibicion (Desde ${from})`);
            data.forEach(row => {
                if (row.exhibicion_id && !allIdsMap.has(row.exhibicion_id)) {
                    allIdsMap.set(row.exhibicion_id, {
                        id: row.exhibicion_id,
                        nombre: `Exhibición Histórica - ${row.bandera}`,
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
        // Agrupamos en chunks de a 50 por si acaso
        for (let i = 0; i < uniqueExhibiciones.length; i += 50) {
            const chunk = uniqueExhibiciones.slice(i, i + 50);
            const { error } = await supabase.from('exhibiciones').upsert(chunk, { onConflict: 'id' });
            if (error) console.error("❌ Error subiendo lote de Exhibiciones:", error.message || error);
        }
        console.log("🚀 Exhibiciones regeneradas exitosamente.");
    }
}

regenerateExhibiciones();

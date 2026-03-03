require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function testQuery() {
    // Query progreso_encuestador
    const { data, error } = await supabase
        .from('progreso_encuestador')
        .select('user_id, tienda, encarte_id, foto_salida_url')
        .not('foto_salida_url', 'is', null)
        .limit(10);

    console.log("Progreso Encartesi:", data, error);
}

testQuery();

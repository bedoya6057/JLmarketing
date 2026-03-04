const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vqqwcdkswyqaxzomqihz.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''; // I will load this using the same process as others

async function main() {
    require('dotenv').config({ path: '.env' });
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const supabase = createClient(url, key);

    const { data: encartes, error: err1 } = await supabase.from('respuestas').select('foto, foto_registro').not('foto', 'is', null).limit(5);
    if (err1) console.error("Error encartes:", err1);
    console.log("Encartes links:", encartes);

    const { data: exhibicion, error: err2 } = await supabase.from('respuestas_exhibicion').select('foto, foto_registro').not('foto', 'is', null).limit(5);
    if (err2) console.error("Error exhibicion:", err2);
    console.log("Exhibicion links:", exhibicion);
}

main();

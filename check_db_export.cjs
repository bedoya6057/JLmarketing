const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
    console.log("Comprobando 'respuestas'...");
    const { data: resp, error: errResp } = await supabase
        .from('respuestas')
        .select('*')
        .limit(5);

    if (errResp) {
        console.error("Error al consultar respuestas:", errResp.message);
    } else {
        console.log("Muestra de 'respuestas':");
        console.dir(resp, { depth: null });

        const count = await supabase.from('respuestas').select('*', { count: 'exact', head: true });
        console.log(`Total count in respuestas: ${count.count}`);
    }
}

checkDatabase();

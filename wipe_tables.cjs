const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
// Service role key used in upload_to_supabase.cjs
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

if (!supabaseUrl || !supabaseKey) {
    console.error("No se encontraron las credenciales de Supabase en .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function wipeTables() {
    console.log("Eliminando datos de la tabla 'respuestas'...");
    const { error: err1 } = await supabase
        .from('respuestas')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (err1) {
        console.error("Error al borrar respuestas:", err1.message);
    } else {
        console.log("✅ Tabla 'respuestas' limpiada correctamente.");
    }

    console.log("Eliminando datos de la tabla 'respuestas_exhibicion'...");
    const { error: err2 } = await supabase
        .from('respuestas_exhibicion')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (err2) {
        console.error("Error al borrar respuestas_exhibicion:", err2.message);
    } else {
        console.log("✅ Tabla 'respuestas_exhibicion' limpiada correctamente.");
    }
}

wipeTables();

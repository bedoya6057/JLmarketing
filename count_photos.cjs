const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function countPhotos() {
    console.log("Contando fotos en la tabla 'respuestas' (Encartes)...");

    // Contamos registros donde 'foto' y 'foto_registro' no sean nulos
    const { count: countRespFoto, error: err1 } = await supabase
        .from('respuestas')
        .select('*', { count: 'exact', head: true })
        .not('foto', 'is', null);

    const { count: countRespFotoRegistro, error: err2 } = await supabase
        .from('respuestas')
        .select('*', { count: 'exact', head: true })
        .not('foto_registro', 'is', null);

    console.log(`- Encartes con 'foto' (producto): ${countRespFoto}`);
    console.log(`- Encartes con 'foto_registro' (ingreso): ${countRespFotoRegistro}`);

    console.log("\nContando fotos en la tabla 'respuestas_exhibicion' (Exhibiciones)...");

    const { count: countExhFoto, error: err3 } = await supabase
        .from('respuestas_exhibicion')
        .select('*', { count: 'exact', head: true })
        .not('foto', 'is', null)
        .neq('foto', '');

    const { count: countExhFotoRegistro, error: err4 } = await supabase
        .from('respuestas_exhibicion')
        .select('*', { count: 'exact', head: true })
        .not('foto_registro', 'is', null)
        .neq('foto_registro', '');

    console.log(`- Exhibiciones con 'foto' (producto): ${countExhFoto}`);
    console.log(`- Exhibiciones con 'foto_registro' (ingreso): ${countExhFotoRegistro}`);
}

countPhotos();

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: encartes } = await supabase.from('encartes').select('id, nombre, estado');
    console.log("Master encartes count:", encartes.length);
    const names = encartes.map(e => e.nombre);
    console.log("Is ENCARTE LIBRERIA VEA FEB 5 in there?:", names.includes('ENCARTE LIBRERIA VEA FEB 5'));

    const { data: resp } = await supabase.from('respuestas').select('id, encarte').is('encarte_id', null).limit(5);
    console.log("Null encarte_id (respuestas) encarte vals:", resp.map(r => r.encarte));

    const { data: exhibiciones } = await supabase.from('exhibiciones').select('id, bandera, fecha');
    console.log("Is Plaza Vea - 2026-02-06 in there?:", exhibiciones.some(e => e.bandera === 'Plaza Vea' && e.fecha.startsWith('2026-02-06')));

    const { data: respex } = await supabase.from('respuestas_exhibicion').select('id, bandera, fecha').is('exhibicion_id', null).limit(5);
    console.log("Null exhibicion_id (respex) bandera/fecha vals:", respex.map(r => `${r.bandera} - ${r.fecha}`));
}
check();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExhibiciones() {
    const { data: exhibiciones, error } = await supabase.from('exhibiciones').select('*').limit(5);
    console.log("Exhibiciones:", exhibiciones);

    const { data: respExh } = await supabase.from('respuestas_exhibicion').select('id, bandera, tienda, fecha').limit(5);
    console.log("Respuestas Exhibicion:", respExh);
}

checkExhibiciones();

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ypwubwjpeqbpsujmopfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk3ODAyNiwiZXhwIjoyMDg3NTU0MDI2fQ.AqV8n3KukZX56z-ZKp012QPSpPnszdFuUu4aFR4VHSg';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createMasterRecords() {
    console.log("Creating missing Encartes...");
    const encartesData = JSON.parse(fs.readFileSync('db_respuestas.json', 'utf8'));
    const uniqueEncartes = [...new Set(encartesData.map(r => r.encarte).filter(Boolean))];

    for (const name of uniqueEncartes) {
        const { data } = await supabase.from('encartes').select('id').eq('nombre', name).single();
        if (!data) {
            console.log(`Creating Encarte: ${name}`);
            const { error } = await supabase.from('encartes').insert({
                nombre: name,
                estado: 'activo',
                fecha: new Date().toISOString().split('T')[0],
                created_by: 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e'
            });
            if (error) console.error("Error Encarte:", error);
        }
    }

    console.log("Creating missing Exhibiciones...");
    const exhData = JSON.parse(fs.readFileSync('db_respuestas_exhibicion.json', 'utf8'));
    const uniqueExh = [];
    const seen = new Set();
    for (const r of exhData) {
        if (!r.bandera || !r.fecha) continue;
        const key = `${r.bandera.trim().toLowerCase()}_${r.fecha.substring(0, 10)}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueExh.push({ bandera: r.bandera.trim(), fecha: r.fecha });
        }
    }

    const { data: existingExh } = await supabase.from('exhibiciones').select('bandera, fecha');
    const existingSet = new Set(existingExh.map(e => `${e.bandera.trim().toLowerCase()}_${e.fecha.substring(0, 10)}`));

    for (const u of uniqueExh) {
        const key = `${u.bandera.toLowerCase()}_${u.fecha.substring(0, 10)}`;
        if (!existingSet.has(key)) {
            console.log(`Creating Exhibicion: ${u.bandera} - ${u.fecha.substring(0, 10)}`);
            const { error } = await supabase.from('exhibiciones').insert({
                nombre: `Exhibición ${u.bandera} - ${u.fecha.substring(0, 10)}`,
                fecha: u.fecha,
                bandera: u.bandera,
                estado: 'activa',
                created_by: 'e1d2fc0d-6467-4e79-8e8a-5949d26a0a5e'
            });
            if (error) console.error("Error Exhibicion:", error);
        }
    }

    console.log("Master records created!");
}

createMasterRecords();

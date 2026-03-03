const fs = require('fs');
const envStr = fs.readFileSync('.env', 'utf8');
const lines = envStr.split('\n').map(l => l.trim());
const urlLine = lines.find(l => l.startsWith('VITE_SUPABASE_URL='));
const keyLine = lines.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='));
const url = urlLine.split('=')[1].replace(/["']/g, '');
const key = keyLine.split('=')[1].replace(/["']/g, '');

async function check() {
    const r1 = await fetch(`${url}/rest/v1/progreso_encuestador_exhibicion?limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log("progreso_encuestador_exhibicion =>", await r1.json());

    const r2 = await fetch(`${url}/rest/v1/progreso_encuestador?limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    console.log("progreso_encuestador =>", await r2.json());
}
check();

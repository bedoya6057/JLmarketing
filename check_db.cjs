const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n');
let url = '', key = '';
for (let line of env) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/["'\r]/g, '');
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim().replace(/["'\r]/g, '');
}

console.log("URL:", url);

fetch(`${url}/rest/v1/progreso_encuestador_exhibicion?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
}).then(r => r.json()).then(data => {
    console.log("Exhibicion:", data);
}).catch(console.error);

fetch(`${url}/rest/v1/progreso_encuestador?limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
}).then(r => r.json()).then(data => {
    console.log("Encarte:", data);
}).catch(console.error);

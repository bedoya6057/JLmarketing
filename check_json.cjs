const fs = require('fs');
const data = JSON.parse(fs.readFileSync('db_respuestas.json', 'utf8'));
const exhibiciones = JSON.parse(fs.readFileSync('db_respuestas_exhibicion.json', 'utf8'));

console.log("First Encarte element:", JSON.stringify(data.find(d => d.foto), null, 2));
console.log("First Exhibicion element:", JSON.stringify(exhibiciones.find(d => d.foto), null, 2));

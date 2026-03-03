const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://ypwubwjpeqbpsujmopfy.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwd3Vid2pwZXFicHN1am1vcGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NzgwMjYsImV4cCI6MjA4NzU1NDAyNn0.Ta5UwahHAQM0mHmfm87GotQ9B8EmBDZrmh0_8H8ErtM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
    const { data, error } = await supabase.from('respuestas').select('*').limit(1);
    if (error) {
        console.error("Error querying respuestas:", error);
    } else if (data && data.length > 0) {
        console.log("Columns in respuestas table:", Object.keys(data[0]).join(', '));
    } else {
        // try to get an empty row structure
        const { data: emptyData, error: emptyError } = await supabase.from('respuestas').select('*').limit(0).csv();
        if (emptyData) {
            console.log("Columns from CSV header:", emptyData.split('\n')[0]);
        } else {
            console.log("Could not fetch schema", emptyError);
        }
    }
}

checkColumns();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCompletion() {
    const { data, error } = await supabase.from('progreso_encuestador').select('*').limit(1);
    console.log(data);
}
checkCompletion();

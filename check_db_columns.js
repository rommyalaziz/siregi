import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.*)/)[1].trim().replace(/['"]/g, '');
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.*)/)[1].trim().replace(/['"]/g, '');

console.log('Supabase URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  try {
    const { data, error } = await supabase
      .from('mdisgo_branches')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    console.log('Columns of mdisgo_branches:', Object.keys(data[0] || {}));
    console.log('Sample row:', data[0]);
  } catch (err) {
    console.error('Error:', err);
  }
}

check();

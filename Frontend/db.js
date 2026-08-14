import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_API_KEY || process.env.SUPABASE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Test the connection
supabase
  .from('your_table')
  .select('*')
  .limit(1)
  .then(({ data, error }) => {
    if (error) console.error('Connection error:', error);
    else console.log('Connected:', data);
  });

export default supabase;

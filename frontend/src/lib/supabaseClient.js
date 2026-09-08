import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in frontend/.env — auth will not work.'
  );
}

// Anon/public client — safe to use in the browser. Row Level Security
// policies (not this key) are what actually protect the data.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tgkfqfcjijjraqmrbxxa.supabase.co';
const supabaseAnonKey = 'sb_publishable_CaS0boKV_p8WvPYnUSH_ng_fZ25GncB';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

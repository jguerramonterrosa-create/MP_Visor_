import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nogoiwpluafbqzwtgjny.supabase.co';
const supabaseAnonKey = 'sb_publishable_dan4Tzb5qgckVQYYs_RgNA_8jSWmtO3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

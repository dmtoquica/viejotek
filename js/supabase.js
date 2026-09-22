import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export const SUPABASE_URL = "https://cbbcwemgxnp...supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "REPLACE_WITH_SUPABASE_PUBLISHABLE_KEY";
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
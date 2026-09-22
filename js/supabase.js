import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// These two public client values will be completed from Supabase Project Settings > API.
export const SUPABASE_URL = "REPLACE_WITH_SUPABASE_PROJECT_URL";
export const SUPABASE_PUBLISHABLE_KEY = "REPLACE_WITH_SUPABASE_PUBLISHABLE_KEY";
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
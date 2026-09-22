import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://cbbcwemgxnpggpmdlcuhg.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_aCKyzFMrNEq9Z04pPuBHHQ_GIYedBNj";
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
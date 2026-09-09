import { createClient } from "@supabase/supabase-js";
export const mode = import.meta.env.VITE_DATA_MODE || "demo";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  mode === "supabase" && url && key ? createClient(url, key) : null;
export const configurationError =
  mode === "supabase" && !supabase
    ? "Supabase mode requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Demo fallback is disabled."
    : null;

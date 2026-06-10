import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://welmbkewhooyspcgtcdw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlbG1ia2V3aG9veXNwY2d0Y2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjE3NTMsImV4cCI6MjA5NjU5Nzc1M30.INrEERUDcZkWCSwiaVrK5ziggMG9V3wZvgOf_7T2EGk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

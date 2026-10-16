/**
 * Team sync server (Supabase). The publishable / anon key is designed to be public: the server only
 * exposes the two functions in supabase/setup.sql, and every record is encrypted on the phone.
 * Can also be set in the app under Settings → Team sync → Server.
 */
const env = (import.meta as any).env || {};
export const SYNC_URL: string = env.VITE_SYNC_URL || "https://xrjnmsmfdwndjebxlnag.supabase.co";
export const SYNC_KEY: string = env.VITE_SYNC_KEY || "sb_publishable_3Ayo7DR-LRdbZiWdsXtifw_Dd5l4nT7";

// Web push (public half of the VAPID key pair; the private half is a Supabase secret).
export const VAPID_PUBLIC_KEY = "BFZ5gM90PRmvvaND_wgeoNsKPguQ-ssgOEjrQEJenOu_xMWLsDM_04WnRUOPs8ZsD1KVfO4ksX5fg70ohXAjLjk";

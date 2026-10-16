/**
 * Team sync server (Supabase). The publishable / anon key is designed to be public: the server only
 * exposes the two functions in supabase/setup.sql, and every record is encrypted on the phone.
 * Can also be set in the app under Settings → Team sync → Server.
 */
const env = (import.meta as any).env || {};
export const SYNC_URL: string = env.VITE_SYNC_URL || "";
export const SYNC_KEY: string = env.VITE_SYNC_KEY || "";

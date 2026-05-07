// Clientes separados por contexto — usa el que corresponde:
// - En componentes del navegador: import { createClient } from '@/lib/supabase/client'
// - En Server Components / API routes: import { createClient } from '@/lib/supabase/server'
export { createClient as createBrowserSupabase } from './supabase/client'
export { createClient as createServerSupabase } from './supabase/server'

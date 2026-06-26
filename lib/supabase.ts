import { createClient } from '@supabase/supabase-js'

// Usa le variabili d'ambiente. NON lasciare chiavi hardcodate nel repo.
//const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
//const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

const supabaseUrl = 'https://fzhuhegksmarvvqgdovu.supabase.co'
const supabaseAnonKey = 'sb_publishable_bj3t8_KE54spWqaC8dUGJg_iCW37e-3'


if (!supabaseUrl || !supabaseAnonKey) {
	// Se mancano le env vars, il comportamento dipende dall'ambiente di esecuzione.
	// Lanciare errore aiuta a individuare la configurazione mancante.
	throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables')
}

// Client da usare nel browser / client-side. Soggetto alle policy RLS del DB.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Factory per creare un client server-side con la Service Role Key.
// ATTENZIONE: usare SOLO in codice eseguito lato server (API routes, server components).
export function createServerSupabase(serviceRoleKey?: string) {
	const key = serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY
	if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable for server client')
	return createClient(supabaseUrl, key)
}
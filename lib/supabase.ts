import { createClient } from '@supabase/supabase-js'

// Inserisci le tue VERE chiavi tra le virgolette per fare questo test
const supabaseUrl = "https://fzhuhegksmarvvqgdovu.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6aHVoZWdrc21hcnZ2cWdkb3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NTI5NDcsImV4cCI6MjA5NzQyODk0N30.wZjOWPNG_CNf9b25_SWbHy55CtCigANPrSTNYlMA26Y"

export const supabase = createClient(supabaseUrl, supabaseKey)
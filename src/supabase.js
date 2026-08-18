import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jnjojqjfvfrhlqsvgzrf.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impuam9qcWpmdmZyaGxxc3ZnenJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTQxOTYsImV4cCI6MjA5ODQ5MDE5Nn0.6Z1RG-z7_L76sAaShzDTOD0po9EoyaAAPbfyfmEX95I'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
})

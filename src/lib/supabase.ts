import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wkkjshkzllxlaonepcvu.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indra2pzaGt6bGx4bGFvbmVwY3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTQ1NTEsImV4cCI6MjA4ODI3MDU1MX0.RZDJUvkGj66sGC7a7j1TWk5rqgTCvVMIU4wti42Jw-I'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
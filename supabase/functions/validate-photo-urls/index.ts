import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ValidationResult {
  id: string;
  foto: string;
  status: number;
  valid: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create clients
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Check if user is admin
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: roleData } = await supabaseAuth.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    })

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body for options
    let options = { 
      table: 'respuestas_exhibicion',
      batchSize: 100,
      offset: 0,
      fixInvalid: false 
    }
    
    try {
      const body = await req.json()
      options = { ...options, ...body }
    } catch {
      // Use defaults
    }

    // Fetch records with photos
    const { data: records, error: fetchError } = await supabaseAdmin
      .from(options.table)
      .select('id, foto')
      .not('foto', 'is', null)
      .neq('foto', '')
      .range(options.offset, options.offset + options.batchSize - 1)

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!records || records.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No more records to validate',
        validated: 0,
        invalid: [],
        offset: options.offset
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate each URL
    const results: ValidationResult[] = []
    const invalidUrls: ValidationResult[] = []

    for (const record of records) {
      if (!record.foto) continue
      
      try {
        // Clean the URL if it has escaped characters
        let url = record.foto
        url = url.replace(/\\/g, '')
        
        const response = await fetch(url, { method: 'HEAD' })
        const result: ValidationResult = {
          id: record.id,
          foto: record.foto,
          status: response.status,
          valid: response.ok
        }
        results.push(result)
        
        if (!response.ok) {
          invalidUrls.push(result)
          
          // Optionally fix invalid URLs by setting to null
          if (options.fixInvalid) {
            await supabaseAdmin
              .from(options.table)
              .update({ foto: null })
              .eq('id', record.id)
          }
        }
      } catch (error) {
        const result: ValidationResult = {
          id: record.id,
          foto: record.foto,
          status: 0,
          valid: false
        }
        results.push(result)
        invalidUrls.push(result)
        
        if (options.fixInvalid) {
          await supabaseAdmin
            .from(options.table)
            .update({ foto: null })
            .eq('id', record.id)
        }
      }
    }

    return new Response(JSON.stringify({
      validated: results.length,
      validCount: results.filter(r => r.valid).length,
      invalidCount: invalidUrls.length,
      invalid: invalidUrls,
      nextOffset: options.offset + options.batchSize,
      fixApplied: options.fixInvalid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

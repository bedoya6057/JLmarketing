import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MatchResult {
  recordId: string;
  photoUrl: string;
  matchType: string;
  tienda: string;
  codProducto: string;
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

    // Parse request body
    let options = { 
      table: 'respuestas_exhibicion',
      dryRun: true,
      limit: 50
    }
    
    try {
      const body = await req.json()
      options = { ...options, ...body }
    } catch {
      // Use defaults
    }

    console.log('Starting photo matching with options:', options)

    // 1. Get records without photos based on table type
    interface RecordWithoutPhoto {
      id: string;
      study_id: string;
      producto_id: string | null;
      tienda: string | null;
      cod_producto: string | null;
      created_at: string;
      created_by: string | null;
    }

    let recordsWithoutPhotos: RecordWithoutPhoto[] = []

    if (options.table === 'respuestas_exhibicion') {
      const { data, error } = await supabaseAdmin
        .from('respuestas_exhibicion')
        .select('id, exhibicion_id, producto_id, tienda, cod_producto, created_at, created_by')
        .or('foto.is.null,foto.eq.')
        .order('created_at', { ascending: false })
        .limit(options.limit)

      if (error) throw new Error(`Error fetching records: ${error.message}`)
      
      recordsWithoutPhotos = (data || []).map(r => ({
        id: r.id,
        study_id: r.exhibicion_id || '',
        producto_id: r.producto_id,
        tienda: r.tienda,
        cod_producto: r.cod_producto,
        created_at: r.created_at || '',
        created_by: r.created_by
      }))
    } else {
      const { data, error } = await supabaseAdmin
        .from('respuestas')
        .select('id, encarte_id, producto_id, tienda, cod_interno, created_at, created_by')
        .or('foto.is.null,foto.eq.')
        .order('created_at', { ascending: false })
        .limit(options.limit)

      if (error) throw new Error(`Error fetching records: ${error.message}`)
      
      recordsWithoutPhotos = (data || []).map(r => ({
        id: r.id,
        study_id: r.encarte_id || '',
        producto_id: r.producto_id,
        tienda: r.tienda,
        cod_producto: r.cod_interno,
        created_at: r.created_at || '',
        created_by: r.created_by
      }))
    }

    console.log(`Found ${recordsWithoutPhotos.length} records without photos`)

    if (recordsWithoutPhotos.length === 0) {
      return new Response(JSON.stringify({
        message: 'No records without photos found',
        matched: 0,
        results: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. List all photos in storage bucket
    const { data: storageFiles, error: storageError } = await supabaseAdmin.storage
      .from('encarte-photos')
      .list('', { limit: 5000, sortBy: { column: 'created_at', order: 'desc' } })

    if (storageError) {
      throw new Error(`Error listing storage: ${storageError.message}`)
    }

    // Get files from all folders
    const allFiles: { name: string; folder: string; created_at: string }[] = []
    
    // First level files
    for (const item of storageFiles || []) {
      if (item.id) {
        allFiles.push({ 
          name: item.name, 
          folder: '', 
          created_at: item.created_at || '' 
        })
      }
    }

    // Get folders and their contents
    const folders = (storageFiles || []).filter(f => !f.id)
    for (const folder of folders) {
      const { data: folderFiles } = await supabaseAdmin.storage
        .from('encarte-photos')
        .list(folder.name, { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } })
      
      for (const file of folderFiles || []) {
        if (file.id) {
          allFiles.push({ 
            name: file.name, 
            folder: folder.name, 
            created_at: file.created_at || '' 
          })
        }
      }
    }

    console.log(`Found ${allFiles.length} files in storage`)

    // 3. Get all foto URLs already in use
    const { data: usedPhotos } = await supabaseAdmin
      .from(options.table)
      .select('foto')
      .not('foto', 'is', null)
      .neq('foto', '')

    const usedUrls = new Set((usedPhotos || []).map(r => r.foto))

    // 4. Match records to photos
    const matches: MatchResult[] = []
    const updates: { id: string; foto: string }[] = []

    for (const record of recordsWithoutPhotos) {
      const recordTime = new Date(record.created_at).getTime()
      const codProducto = record.cod_producto || ''
      const tiendaName = (record.tienda || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const studyId = record.study_id

      // Look for matching photo by:
      // 1. Product ID in filename
      // 2. Tienda name in filename
      // 3. Timestamp within 5 minute window

      for (const file of allFiles) {
        const fileName = file.name.toLowerCase()
        const filePath = file.folder ? `${file.folder}/${file.name}` : file.name
        
        // Build public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('encarte-photos')
          .getPublicUrl(filePath)
        
        const publicUrl = urlData.publicUrl

        // Skip if already in use
        if (usedUrls.has(publicUrl)) continue

        let matchType = ''

        // Check if filename contains producto_id
        if (record.producto_id && fileName.includes(record.producto_id)) {
          matchType = 'producto_id'
        }
        // Check if filename contains cod_producto
        else if (codProducto && fileName.includes(codProducto.toLowerCase())) {
          matchType = 'cod_producto'
        }
        // Check if filename contains study ID and tienda
        else if (studyId && fileName.includes(studyId.substring(0, 8)) && tiendaName && fileName.includes(tiendaName.substring(0, 6))) {
          matchType = 'study_tienda'
        }
        // Check folder matches user_id and timestamp is close
        else if (file.folder === record.created_by) {
          const fileTime = new Date(file.created_at).getTime()
          const timeDiff = Math.abs(fileTime - recordTime)
          
          // Within 5 minutes
          if (timeDiff < 5 * 60 * 1000) {
            matchType = 'timestamp_user'
          }
        }

        if (matchType) {
          matches.push({
            recordId: record.id,
            photoUrl: publicUrl,
            matchType,
            tienda: record.tienda || 'N/A',
            codProducto: codProducto || 'N/A'
          })

          updates.push({ id: record.id, foto: publicUrl })
          usedUrls.add(publicUrl) // Mark as used to avoid duplicates
          break // Only one match per record
        }
      }
    }

    console.log(`Found ${matches.length} potential matches`)

    // 5. Apply updates if not dry run
    let appliedCount = 0
    if (!options.dryRun && updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabaseAdmin
          .from(options.table)
          .update({ foto: update.foto })
          .eq('id', update.id)

        if (updateError) {
          console.error(`Error updating ${update.id}:`, updateError)
        } else {
          appliedCount++
        }
      }
    }

    return new Response(JSON.stringify({
      message: options.dryRun ? 'Dry run completed' : 'Matching completed',
      recordsWithoutPhotos: recordsWithoutPhotos.length,
      storageFilesScanned: allFiles.length,
      matchesFound: matches.length,
      appliedUpdates: appliedCount,
      dryRun: options.dryRun,
      matches: matches.slice(0, 50) // Limit response size
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

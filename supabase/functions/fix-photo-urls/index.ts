import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from 'https://deno.land/std@0.177.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Authenticate the requesting user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user }, error: authUserError } = await supabaseClient.auth.getUser();
    if (authUserError || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has admin role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: 'Acceso denegado. Se requiere rol de administrador.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const results = {
      base64Uploaded: [] as string[],
      brokenUrlsCleared: [] as string[],
      duplicatesFixed: [] as string[],
      errors: [] as { id: string; error: string }[],
    };

    // 1. Handle base64 photos - upload to storage
    console.log('Step 1: Uploading base64 photos...');
    const { data: base64Records, error: base64Error } = await supabaseAdmin
      .from('respuestas_exhibicion')
      .select('id, foto, producto_id, exhibicion_id')
      .like('foto', 'data:image%');

    if (base64Error) {
      console.error('Error fetching base64 records:', base64Error);
    } else if (base64Records && base64Records.length > 0) {
      console.log(`Found ${base64Records.length} base64 records to process`);
      
      for (const record of base64Records) {
        try {
          const base64Data = record.foto;
          const base64Content = base64Data.split(',')[1];
          const mimeType = base64Data.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
          const extension = mimeType.split('/')[1] || 'jpg';
          
          // Decode base64 to binary
          const binaryData = decode(base64Content);
          
          // Generate unique filename with record id
          const timestamp = Date.now();
          const fileName = `base64_fix_${record.id}_${timestamp}.${extension}`;
          const filePath = `${record.exhibicion_id}/${fileName}`;
          
          // Upload to storage
          const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
            .from('encarte-photos')
            .upload(filePath, binaryData, {
              contentType: mimeType,
              upsert: false,
            });
          
          if (uploadError) {
            console.error(`Error uploading base64 for ${record.id}:`, uploadError);
            results.errors.push({ id: record.id, error: `Upload failed: ${uploadError.message}` });
            continue;
          }
          
          // Get public URL
          const { data: publicUrlData } = supabaseAdmin.storage
            .from('encarte-photos')
            .getPublicUrl(filePath);
          
          // Update record with new URL
          const { error: updateError } = await supabaseAdmin
            .from('respuestas_exhibicion')
            .update({ foto: publicUrlData.publicUrl })
            .eq('id', record.id);
          
          if (updateError) {
            console.error(`Error updating record ${record.id}:`, updateError);
            results.errors.push({ id: record.id, error: `Update failed: ${updateError.message}` });
          } else {
            results.base64Uploaded.push(record.id);
            console.log(`Uploaded and updated: ${record.id}`);
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Error processing base64 record ${record.id}:`, err);
          results.errors.push({ id: record.id, error: `Processing error: ${errorMessage}` });
        }
      }
    }

    // 2. Clear broken URLs (old format 0.xxx.jpg)
    console.log('Step 2: Clearing broken URLs...');
    const { data: brokenRecords, error: brokenError } = await supabaseAdmin
      .from('respuestas_exhibicion')
      .select('id')
      .like('foto', '%/0.%');

    if (brokenError) {
      console.error('Error fetching broken URLs:', brokenError);
    } else if (brokenRecords && brokenRecords.length > 0) {
      console.log(`Found ${brokenRecords.length} broken URL records`);
      
      const brokenIds = brokenRecords.map(r => r.id);
      const { error: clearError } = await supabaseAdmin
        .from('respuestas_exhibicion')
        .update({ foto: null })
        .in('id', brokenIds);
      
      if (clearError) {
        console.error('Error clearing broken URLs:', clearError);
        results.errors.push({ id: 'batch', error: `Clear broken URLs failed: ${clearError.message}` });
      } else {
        results.brokenUrlsCleared = brokenIds;
        console.log(`Cleared ${brokenIds.length} broken URLs`);
      }
    }

    // 3. Fix duplicates - keep only the first record for each photo, set others to NULL
    console.log('Step 3: Fixing duplicate photo assignments...');
    const { data: duplicates, error: dupError } = await supabaseAdmin.rpc('get_duplicate_photos');
    
    if (dupError) {
      // If RPC doesn't exist, do it manually
      console.log('RPC not available, querying manually...');
      
      // Find photos used by multiple records
      const { data: allPhotos, error: photosError } = await supabaseAdmin
        .from('respuestas_exhibicion')
        .select('id, foto, created_at')
        .not('foto', 'is', null)
        .like('foto', 'https://%')
        .order('created_at', { ascending: true });
      
      if (photosError) {
        console.error('Error fetching photos for duplicate check:', photosError);
      } else if (allPhotos) {
        // Group by photo URL
        const photoGroups = new Map<string, { id: string; created_at: string }[]>();
        
        for (const record of allPhotos) {
          if (!photoGroups.has(record.foto)) {
            photoGroups.set(record.foto, []);
          }
          photoGroups.get(record.foto)!.push({ id: record.id, created_at: record.created_at });
        }
        
        // Find duplicates and keep only the first (oldest) record
        const idsToNullify: string[] = [];
        
        for (const [foto, records] of photoGroups) {
          if (records.length > 1) {
            // Sort by created_at and keep the first one
            records.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            
            // All except the first should be nullified
            for (let i = 1; i < records.length; i++) {
              idsToNullify.push(records[i].id);
            }
          }
        }
        
        if (idsToNullify.length > 0) {
          console.log(`Found ${idsToNullify.length} duplicate assignments to nullify`);
          
          // Process in batches of 500
          const batchSize = 500;
          for (let i = 0; i < idsToNullify.length; i += batchSize) {
            const batch = idsToNullify.slice(i, i + batchSize);
            const { error: nullifyError } = await supabaseAdmin
              .from('respuestas_exhibicion')
              .update({ foto: null })
              .in('id', batch);
            
            if (nullifyError) {
              console.error(`Error nullifying batch ${i}:`, nullifyError);
              results.errors.push({ id: `batch_${i}`, error: `Nullify failed: ${nullifyError.message}` });
            } else {
              results.duplicatesFixed.push(...batch);
            }
          }
          
          console.log(`Nullified ${results.duplicatesFixed.length} duplicate photo assignments`);
        }
      }
    }

    // Summary
    const summary = {
      message: 'Corrección de fotos completada',
      base64Uploaded: results.base64Uploaded.length,
      brokenUrlsCleared: results.brokenUrlsCleared.length,
      duplicatesFixed: results.duplicatesFixed.length,
      errors: results.errors.length,
      details: results,
    };

    console.log('Fix completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al procesar la solicitud', details: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

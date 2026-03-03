import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Whitelist of allowed columns to prevent unknown field errors
const ALLOWED_COLUMNS = new Set([
  "encarte_id",
  "producto_id",
  "tienda",
  "fecha",
  "foto",
  "presencia_producto",
  "presencia_cartel",
  "presencia_cartel_con_tarjeta",
  "cartel_presenta_precio",
  "precio_encontrado",
  "precio_tarjeta",
  "precio_encarte",
  "observaciones",
  "obs_1",
  "ubicacion_sku",
  "created_by",
  "año",
  "mes",
  "mes_cod",
  "encarte",
  "encargado",
  "encargado_2",
  "ciudad",
  "ciudad_cadena",
  "bandera",
  "macrocategoria",
  "categoria",
  "cod_interno",
  "producto",
  "foto_registro",
  "supervisor",
  "cumplimiento_carteles",
  "precio_ok",
]);

interface RespuestaPayload {
  encarte_id: string;
  producto_id: string;
  tienda?: string;
  fecha?: string;
  [key: string]: unknown;
}

interface SyncRequest {
  respuestas: RespuestaPayload[];
}

interface SyncResult {
  success: number;
  errors: number;
  successIds: string[];
  failed: Array<{
    producto_id: string;
    tienda: string;
    error_code: string;
    error_message: string;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(JSON.stringify({ 
        error: "Missing Authorization header",
        error_code: "AUTH_MISSING",
        // V.21 compatibility: also return success/errors format
        success: 0,
        errors: 0,
        successIds: [],
        failed: []
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create anon client to validate JWT and get user
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error("Invalid JWT or user not found:", userError?.message);
      return new Response(JSON.stringify({ 
        error: "Invalid or expired token",
        error_code: "AUTH_INVALID",
        error_details: userError?.message,
        // V.21 compatibility
        success: 0,
        errors: 0,
        successIds: [],
        failed: []
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    console.log(`Authenticated user: ${userId}`);

    // Parse request body
    let body: SyncRequest;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("Failed to parse request body:", parseErr);
      return new Response(JSON.stringify({ 
        error: "Invalid JSON body",
        error_code: "PARSE_ERROR",
        success: 0,
        errors: 0,
        successIds: [],
        failed: []
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { respuestas } = body;

    if (!respuestas || !Array.isArray(respuestas) || respuestas.length === 0) {
      return new Response(JSON.stringify({ 
        error: "No respuestas provided",
        error_code: "NO_DATA",
        success: 0,
        errors: 0,
        successIds: [],
        failed: []
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Syncing ${respuestas.length} respuestas for user ${userId}`);

    // Create service role client for privileged insert (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const results: SyncResult = {
      success: 0,
      errors: 0,
      successIds: [],
      failed: [],
    };

    // Process each respuesta individually for precise error tracking
    for (const respuesta of respuestas) {
      const productoId = respuesta.producto_id || "unknown";
      const tienda = String(respuesta.tienda || "unknown");
      
      try {
        // Sanitize payload: only keep allowed columns
        const sanitizedPayload: Record<string, unknown> = {
          created_by: userId, // Always force authenticated user
        };
        
        for (const [key, value] of Object.entries(respuesta)) {
          if (ALLOWED_COLUMNS.has(key) && value !== undefined) {
            sanitizedPayload[key] = value;
          }
        }

        // Validate required fields
        if (!sanitizedPayload.encarte_id || !sanitizedPayload.producto_id) {
          results.errors++;
          results.failed.push({
            producto_id: productoId,
            tienda,
            error_code: "MISSING_REQUIRED",
            error_message: "Missing encarte_id or producto_id",
          });
          continue;
        }

        // Ensure fecha has a value for the unique constraint
        if (!sanitizedPayload.fecha) {
          sanitizedPayload.fecha = new Date().toISOString().split('T')[0];
        }

        // Use upsert with conflict handling
        const { error: upsertError } = await adminClient.from("respuestas").upsert(sanitizedPayload, {
          onConflict: "encarte_id,producto_id,tienda,created_by,fecha",
          ignoreDuplicates: false, // Update if exists
        });

        if (upsertError) {
          // Check if it's a duplicate that we can ignore
          if (upsertError.message?.includes("duplicate")) {
            console.log(`Duplicate accepted for producto_id: ${productoId}`);
            results.success++;
            results.successIds.push(productoId);
          } else {
            throw upsertError;
          }
        } else {
          results.success++;
          results.successIds.push(productoId);
        }
      } catch (err: unknown) {
        results.errors++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorCode = (err as any)?.code || "UNKNOWN";
        
        results.failed.push({
          producto_id: productoId,
          tienda,
          error_code: errorCode,
          error_message: errorMsg.substring(0, 500),
        });
        
        console.error(`Error syncing respuesta ${productoId}:`, errorMsg);
      }
    }

    console.log(`Sync complete: ${results.success} success, ${results.errors} errors`);
    
    // Log first few errors for debugging
    if (results.failed.length > 0) {
      console.log("First 3 errors:", JSON.stringify(results.failed.slice(0, 3)));
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Unexpected error:", errorMsg);
    return new Response(JSON.stringify({ 
      error: errorMsg,
      error_code: "SERVER_ERROR",
      success: 0,
      errors: 0,
      successIds: [],
      failed: []
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
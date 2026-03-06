import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!serviceRoleKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const emailToAdmin = "admin@encartescanner.com";

    // 1. Get user by email
    const { data: { users }, error: authError } = await adminClient.auth.admin.listUsers();

    if (authError) throw new Error(`Auth error: ${authError.message}`);

    const user = users.find(u => u.email === emailToAdmin);

    if (!user) {
      return new Response(JSON.stringify({ error: `Usuario ${emailToAdmin} no encontrado` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Check if user has role in user_roles
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('*')
      .eq('user_id', user.id);

    if (roleError) throw new Error(`Role check error: ${roleError.message}`);

    let result = "Usuario ya era admin";

    if (!roleData || roleData.length === 0) {
      // Create role
      const { error: insertError } = await adminClient
        .from('user_roles')
        .insert({ user_id: user.id, role: 'admin' });

      if (insertError) throw new Error(`Role insert error: ${insertError.message}`);
      result = "Rol admin asignado (nuevo registro)";

    } else {
      const isAdmin = roleData.some(r => r.role === 'admin');
      if (!isAdmin) {
        // Update role
        const { error: updateError } = await adminClient
          .from('user_roles')
          .update({ role: 'admin' })
          .eq('user_id', user.id);

        if (updateError) throw new Error(`Role update error: ${updateError.message}`);
        result = "Rol actualizado a admin";
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: result,
      user_id: user.id,
      email: user.email
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Error en setup-admin:", errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

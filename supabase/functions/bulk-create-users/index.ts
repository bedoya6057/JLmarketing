import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Get users array from request body
    const { users } = await req.json();

    if (!users || !Array.isArray(users) || users.length === 0) {
      return new Response(JSON.stringify({ error: 'Se requiere un array de usuarios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const validRoles = ['admin', 'auditor', 'encuestador'];
    const results = {
      success: [] as string[],
      errors: [] as { email: string; error: string }[],
    };

    for (const userData of users) {
      const { nombre, email, rol, password } = userData;

      // Validate required fields
      if (!email || !password || !rol) {
        results.errors.push({ 
          email: email || 'desconocido', 
          error: 'Email, contraseña y rol son requeridos' 
        });
        continue;
      }

      // Validate role
      const normalizedRole = rol.toLowerCase();
      if (!validRoles.includes(normalizedRole)) {
        results.errors.push({ email, error: `Rol inválido: ${rol}` });
        continue;
      }

      // Validate password
      if (password.length < 8) {
        results.errors.push({ email, error: 'Contraseña debe tener al menos 8 caracteres' });
        continue;
      }

      try {
        // Create the user
        const { data: newUser, error: userError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: nombre || email.split('@')[0],
          },
        });

        if (userError) {
          console.error(`Error creating user ${email}:`, userError);
          if (userError.message.includes('already')) {
            results.errors.push({ email, error: 'Este email ya está registrado' });
          } else {
            results.errors.push({ email, error: userError.message });
          }
          continue;
        }

        // Insert role into user_roles table
        const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({ user_id: newUser.user.id, role: normalizedRole });

        if (roleInsertError) {
          console.error(`Error assigning role to ${email}:`, roleInsertError);
          results.errors.push({ email, error: 'Error al asignar rol' });
          continue;
        }

        console.log(`User created: ${email} with role: ${normalizedRole}`);
        results.success.push(email);

      } catch (err) {
        console.error(`Unexpected error for ${email}:`, err);
        results.errors.push({ email, error: 'Error inesperado' });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Proceso completado: ${results.success.length} usuarios creados, ${results.errors.length} errores`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al procesar la solicitud' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

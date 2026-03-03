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

    // Get user data from request body
    const { userId, email, password, role, full_name, is_active } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'ID de usuario es requerido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['admin', 'auditor', 'encuestador'];
      if (!validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: 'Rol inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Validate password strength if provided
    if (password && password.length < 8) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 8 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Update user auth data if provided
    const updateData: any = {};
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (full_name) {
      updateData.user_metadata = { full_name };
    }

    if (Object.keys(updateData).length > 0) {
      const { error: userError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        updateData
      );

      if (userError) {
        console.error('Error updating user:', userError);
        return new Response(JSON.stringify({ error: 'Error al actualizar usuario' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Update role and/or is_active status
    if (role !== undefined || is_active !== undefined) {
      // Check if user has existing role entry
      const { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('id, role, is_active')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        // Update existing entry
        const updateObj: any = {};
        if (role !== undefined) updateObj.role = role;
        if (is_active !== undefined) updateObj.is_active = is_active;

        const { error: roleUpdateError } = await supabaseAdmin
          .from('user_roles')
          .update(updateObj)
          .eq('user_id', userId);

        if (roleUpdateError) {
          console.error('Error updating role:', roleUpdateError);
          return new Response(JSON.stringify({ error: 'Error al actualizar rol/estado' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else if (role) {
        // Insert new role entry
        const { error: roleInsertError } = await supabaseAdmin
          .from('user_roles')
          .insert({ 
            user_id: userId, 
            role: role,
            is_active: is_active ?? true
          });

        if (roleInsertError) {
          console.error('Error inserting role:', roleInsertError);
          return new Response(JSON.stringify({ error: 'Error al crear rol' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    console.log('User updated successfully:', userId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Usuario actualizado exitosamente`,
        userId,
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

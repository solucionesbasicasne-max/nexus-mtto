import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ valid: false, error: 'Faltan credenciales' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Use service role to query without requiring user auth
    const profiles = await base44.asServiceRole.entities.UserProfile.list();

    const match = profiles.find(
      p =>
        p.username &&
        p.app_password &&
        p.username.trim().toLowerCase() === username.trim().toLowerCase() &&
        p.app_password === password &&
        p.is_active !== false
    );

    if (match) {
      return Response.json({ valid: true });
    } else {
      return Response.json({ valid: false, error: 'Usuario o contraseña incorrectos' });
    }
  } catch (error) {
    return Response.json({ valid: false, error: error.message }, { status: 500 });
  }
});
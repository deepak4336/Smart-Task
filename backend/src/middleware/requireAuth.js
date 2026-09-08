import { supabase } from '../config/supabaseClient.js';

// Ensures a public.users row exists for this auth user.
// Covers accounts created before the handle_new_user trigger was installed.
async function ensureUserProfile(authUser) {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', authUser.id)
    .maybeSingle();

  if (existing) return;

  const name =
    authUser.user_metadata?.name ||
    (authUser.email ? authUser.email.split('@')[0] : 'User');

  const { error } = await supabase.from('users').insert({
    id: authUser.id,
    name,
    email: authUser.email,
    role: 'member',
  });

  // Ignore unique conflicts (race between concurrent requests)
  if (error && error.code !== '23505') {
    console.error('Failed to sync user profile:', error.message);
  }
}

// Verifies the Bearer token from the frontend against Supabase Auth,
// then attaches the authenticated user to req.user for downstream handlers.
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  await ensureUserProfile(data.user);
  req.user = data.user;
  next();
}

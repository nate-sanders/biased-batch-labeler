import { supabase } from "~/utils/supabase.server";
import type { User as ImportedUser } from "~/types";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export async function getUserById(id: string): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.admin.getUserById(id);
  if (error || !user) return null;
  return transformUser(user);
}

export async function verifyLogin(
  email: string,
  password: string
): Promise<User | null> {
  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !session?.user) return null;

  // Ensure user exists in the users table
  await ensureUserExists(session.user);

  return transformUser(session.user);
}

async function ensureUserExists(authUser: any) {
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('id', authUser.id)
    .single();

  if (!existingUser && !checkError) {
    // User doesn't exist in users table, create them
    const { error: insertError } = await supabase
      .from('users')
      .insert([{
        id: authUser.id,
        email: authUser.email,
      }]);

    if (insertError) throw insertError;
  }
}

export function transformUser(user: SupabaseUser): User {
  return {
    id: user.id,
    email: user.email || "",
    name: user.user_metadata?.name,
    avatar_url: user.user_metadata?.avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
  };
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

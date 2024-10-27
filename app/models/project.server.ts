import { supabase } from '~/utils/supabase.server';
import type { Project } from '~/types';

export async function getProjectsByUser(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', userId);

  if (error) throw error;
  return data.map(transformProject);
}

export async function createProject(
  name: string,
  ownerId: string
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert([{ name, owner_id: ownerId }])
    .select()
    .single();

  if (error) throw error;
  return transformProject(data);
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return transformProject(data);
}

export async function updateProject(
  id: string,
  updates: { name: string }
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      name: updates.name,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return transformProject(data);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

function transformProject(data: any): Project {
  return {
    id: data.id,
    name: data.name,
    ownerId: data.owner_id,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

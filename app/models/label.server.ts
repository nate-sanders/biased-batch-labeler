import { supabase } from "~/utils/supabase.server";

export type Label = {
  id: string;
  name: string;
  color: string; // Required now
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

export async function getLabelsByProject(projectId: string): Promise<Label[]> {
  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ? data.map(transformLabel) : [];
}

export async function createLabel({ name, projectId }: { name: string; projectId: string }) {
  const { data, error } = await supabase
    .from('labels')
    .insert([
      {
        name,
        color: '#000000', // Default color
        project_id: projectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating label:', error);
    throw error;
  }
  return transformLabel(data);
}

export async function updateLabel(
  id: string,
  updates: Partial<Pick<Label, "name" | "color">>
): Promise<Label> {
  const { data, error } = await supabase
    .from('labels')
    .update({
      name: updates.name,
      color: updates.color,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return transformLabel(data);
}

export async function deleteLabel(id: string): Promise<void> {
  const { error } = await supabase
    .from('labels')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

function transformLabel(data: any): Label {
  return {
    id: data.id,
    name: data.name,
    color: data.color || '#000000', // Provide default color
    projectId: data.project_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

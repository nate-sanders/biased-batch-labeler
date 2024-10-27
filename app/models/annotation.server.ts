import { supabase } from "~/utils/supabase.server";
import type { Annotation } from "~/types";

export async function getAnnotationsByDataset(datasetId: string): Promise<Annotation[]> {
  const { data, error } = await supabase
    .from('annotations')
    .select(`
      *,
      label (*)
    `)
    .eq('dataset_id', datasetId);

  if (error) throw error;
  return data.map(transformAnnotation);
}

export async function annotateDataPoint(
  dataPointId: string,
  labelId: string
): Promise<Annotation> {
  const { data, error } = await supabase
    .from('annotations')
    .insert([{ data_point_id: dataPointId, label_id: labelId }])
    .select()
    .single();

  if (error) throw error;
  return transformAnnotation(data);
}

export async function removeAnnotation(id: string): Promise<void> {
  const { error } = await supabase
    .from('annotations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

function transformAnnotation(data: any): Annotation {
  return {
    id: data.id,
    dataPointId: data.data_point_id,
    labelId: data.label_id,
    createdAt: new Date(data.created_at),
  };
}

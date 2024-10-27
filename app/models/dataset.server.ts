import { supabase } from "~/utils/supabase.server";

export type Dataset = {
  id: string;
  name: string;
  projectId: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
  dataPoints?: DataPoint[];
};

export interface DataPoint {
  timestamp: string;
  value: number;
}

export async function getDatasetById(id: string): Promise<Dataset | null> {
  try {
    // First get the dataset
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', id)
      .single();

    if (datasetError) throw datasetError;
    if (!dataset) return null;

    // Then get the data points
    const { data: dataPoints, error: pointsError } = await supabase
      .from('data_points')
      .select('*')
      .eq('dataset_id', id)
      .order('timestamp', { ascending: true });

    if (pointsError) throw pointsError;

    // Transform and combine the data
    const transformedDataset = transformDataset(dataset);
    transformedDataset.dataPoints = dataPoints ? dataPoints.map(transformDataPoint) : [];
    
    console.log('Dataset from DB:', transformedDataset); // Add debugging
    return transformedDataset;
  } catch (error) {
    console.error('Error fetching dataset:', error);
    throw error;
  }
}

export async function getDatasetsByProject(projectId: string): Promise<Dataset[]> {
  const { data, error } = await supabase
    .from('datasets')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ? data.map(transformDataset) : [];
}

export async function createDataset(
  name: string,
  projectId: string,
  file: File,
  dataPoints: DataPoint[]
): Promise<Dataset> {
  // First upload the CSV file to Supabase Storage
  const filePath = `projects/${projectId}/datasets/${Date.now()}-${name}.csv`;
  const { error: uploadError } = await supabase.storage
    .from('datasets')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    throw uploadError;
  }

  // Then create the dataset record
  const { data: dataset, error: datasetError } = await supabase
    .from('datasets')
    .insert([{ 
      name, 
      project_id: projectId,
      file_path: filePath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single();

  if (datasetError) {
    // If dataset creation fails, delete the uploaded file
    await supabase.storage
      .from('datasets')
      .remove([filePath]);
    throw datasetError;
  }

  // Then create the data points
  if (dataPoints.length > 0) {
    const { error: pointsError } = await supabase
      .from('data_points')
      .insert(
        dataPoints.map(point => ({
          dataset_id: dataset.id,
          timestamp: point.timestamp,
          value: point.value,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      );

    if (pointsError) {
      // If data points creation fails, delete the dataset and file
      await supabase
        .from('datasets')
        .delete()
        .eq('id', dataset.id);
      await supabase.storage
        .from('datasets')
        .remove([filePath]);
      throw pointsError;
    }
  }

  return transformDataset(dataset);
}

export async function deleteDataset(id: string): Promise<void> {
  // First get the dataset to get the file path
  const { data: dataset, error: getError } = await supabase
    .from('datasets')
    .select('file_path')
    .eq('id', id)
    .single();

  if (getError) throw getError;

  // Delete the file from storage
  if (dataset.file_path) {
    const { error: storageError } = await supabase.storage
      .from('datasets')
      .remove([dataset.file_path]);

    if (storageError) throw storageError;
  }

  // Delete data points
  const { error: pointsError } = await supabase
    .from('data_points')
    .delete()
    .eq('dataset_id', id);

  if (pointsError) throw pointsError;

  // Finally delete the dataset
  const { error: datasetError } = await supabase
    .from('datasets')
    .delete()
    .eq('id', id);

  if (datasetError) throw datasetError;
}

export async function updateDataset(
  id: string,
  updates: Partial<Pick<Dataset, "name">>
): Promise<Dataset> {
  const { data, error } = await supabase
    .from('datasets')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return transformDataset(data);
}

function transformDataset(data: any): Dataset {
  return {
    id: data.id,
    name: data.name,
    projectId: data.project_id,
    filePath: data.file_path,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function transformDataPoint(data: any) {
  return {
    id: data.id,
    timestamp: data.timestamp,
    value: data.value,
    datasetId: data.dataset_id,
  };
}

export async function getDatasetFileUrl(filePath: string): Promise<string> {
  const { data } = await supabase.storage
    .from('datasets')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

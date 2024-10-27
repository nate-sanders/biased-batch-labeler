import { supabase } from "~/utils/supabase.server";

export interface Filter {
  id: string;
  name: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

// Default filters that will be available for all projects
const DEFAULT_FILTERS = [
  { name: "Confidence Score" },
  { name: "Prediction Time" },
  { name: "Input Length" },
  { name: "Output Length" }
] as const;

export async function getFiltersByProject(projectId: string): Promise<Filter[]> {
  // For now, just return the default filters with generated IDs
  return DEFAULT_FILTERS.map((filter, index) => ({
    id: `default-${index}`,
    name: filter.name,
    projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
}

function transformFilter(data: any): Filter {
  return {
    id: data.id,
    name: data.name,
    projectId: data.project_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

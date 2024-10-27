import { type ReactNode } from "react";
import { useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { getProject } from "~/models/project.server";

export async function loader({ params }: LoaderFunctionArgs) {
  if (!params.projectId) {
    throw new Response("Project ID is required", { status: 400 });
  }
  
  const project = await getProject(params.projectId);
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }
  return json({ project });
}

export default function ProjectDetail(): ReactNode {
  const { project } = useLoaderData<typeof loader>();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Project Overview</h2>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Project Details</h3>
          <p className="text-gray-600">{project.name}</p>
        </div>
      </div>
    </div>
  );
}

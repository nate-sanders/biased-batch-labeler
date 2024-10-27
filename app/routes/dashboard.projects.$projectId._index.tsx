import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Redirect to the visualization route by default
  return redirect(`/dashboard/projects/${params.projectId}/visualization`);
}

export default function ProjectIndex() {
  return null;
}

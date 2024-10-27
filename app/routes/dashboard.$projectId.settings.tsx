import * as React from "react";
import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData, useActionData } from "@remix-run/react";
import { requireUser } from "~/utils/session.server";
import { getProjectById, updateProject, deleteProject } from "~/models/project.server";
import { z } from "zod";

const UpdateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
});

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const project = await getProjectById(params.projectId);

  if (!project) {
    throw new Response("Project not found", { status: 404 });
  }

  if (project.ownerId !== user.id) {
    throw new Response("Not authorized", { status: 403 });
  }

  return json({ project });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deleteProject(params.projectId);
    return redirect("/dashboard");
  }

  const name = formData.get("name");
  const result = UpdateProjectSchema.safeParse({ name });

  if (!result.success) {
    return json({ errors: result.error.flatten() }, { status: 400 });
  }

  await updateProject(params.projectId, { name: result.data.name });
  return redirect(`/dashboard/${params.projectId}`);
}

export default function ProjectSettings() {
  const { project } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Project Settings</h1>

      <Form method="post" className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Project Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            defaultValue={project.name}
            className="mt-1 block w-full rounded border px-3 py-2"
          />
          {actionData?.errors?.fieldErrors?.name && (
            <p className="mt-1 text-sm text-red-600">
              {actionData.errors.fieldErrors.name[0]}
            </p>
          )}
        </div>

        <div className="flex justify-between">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Changes
          </button>

          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="delete"
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              onClick={(e) => {
                if (!confirm("Are you sure you want to delete this project?")) {
                  e.preventDefault();
                }
              }}
            >
              Delete Project
            </button>
          </Form>
        </div>
      </Form>
    </div>
  );
}

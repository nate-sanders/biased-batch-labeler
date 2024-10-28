import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { useState } from "react";
import { PlusIcon } from "@radix-ui/react-icons";
import { createLabel, getLabelsByProject } from "~/models/label.server";
import CreateLabelModal from "~/components/CreateLabelModal";

export async function loader({ params }: LoaderFunctionArgs) {
  const { projectId } = params;
  if (!projectId) throw new Error("Project ID is required");
  
  const labels = await getLabelsByProject(projectId);
  return json({ labels });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createLabel" && params.projectId) {
    const name = formData.get("name");
    const color = formData.get("color");
    
    if (typeof name !== "string" || !name || typeof color !== "string" || !color) {
      return json({ error: "Name and color are required" }, { status: 400 });
    }

    try {
      await createLabel({
        name,
        projectId: params.projectId,
        color
      });
      return json({ success: true });
    } catch (error) {
      console.error('Error in action:', error);
      return json({ error: "Failed to create label" }, { status: 500 });
    }
  }

  return null;
}

export default function LabelsRoute() {
  const { labels } = useLoaderData<typeof loader>();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const submit = useSubmit();

  const handleCreateLabel = async (name: string, color: string) => {
    const formData = new FormData();
    formData.append("intent", "createLabel");
    formData.append("name", name);
    formData.append("color", color);
    submit(formData, { method: "post" });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Labels</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 rounded hover:bg-gray-50"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Create Label</span>
        </button>
      </div>

      <div className="space-y-2">
        {labels.map((label) => (
          <div 
            key={label.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50"
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: label.color }}
            />
            <span className="text-sm text-gray-700">{label.name}</span>
          </div>
        ))}
      </div>

      <CreateLabelModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSubmit={handleCreateLabel}
      />
    </div>
  );
}

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { createLabel } from "~/models/label.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createLabel" && params.projectId) {
    const name = formData.get("name");
    if (typeof name !== "string" || !name) {
      return json({ error: "Name is required" }, { status: 400 });
    }

    try {
      await createLabel({
        name,
        projectId: params.projectId,
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
  return null; // This route only handles actions
}

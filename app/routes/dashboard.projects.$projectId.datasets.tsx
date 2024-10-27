import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { createDataset, deleteDataset, updateDataset } from "~/models/dataset.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  console.log("Dataset action called with intent:", intent);

  // Handle dataset deletion
  if (intent === "deleteDataset") {
    const datasetId = formData.get("datasetId");
    console.log("Attempting to delete dataset:", datasetId);

    if (!datasetId || typeof datasetId !== "string") {
      console.log("Invalid dataset ID");
      return json({ error: "Dataset ID is required" }, { status: 400 });
    }

    try {
      console.log("Calling deleteDataset function");
      await deleteDataset(datasetId);
      console.log("Dataset deleted successfully");
      return json({ 
        success: true, 
        action: "delete", 
        datasetId 
      });
    } catch (error) {
      console.error("Error deleting dataset:", error);
      return json({ error: "Failed to delete dataset" }, { status: 500 });
    }
  }

  // Handle dataset creation
  if (intent === "createDataset") {
    try {
      console.log("Processing dataset creation");
      
      const file = formData.get("file") as Blob;
      const mapping = JSON.parse(formData.get("mapping") as string);
      const projectId = params.projectId;

      console.log("Received form data:", {
        fileName: file instanceof File ? file.name : 'unknown',
        mapping,
        projectId
      });

      if (!file || !mapping || !projectId) {
        console.error("Missing required fields:", { file: !!file, mapping: !!mapping, projectId });
        return json({ error: "Missing required fields" }, { status: 400 });
      }

      // Convert Blob to text
      const text = await file.text();
      const fileName = file instanceof File ? file.name : 'dataset.csv';

      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const dataPoints = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',');
          return {
            timestamp: values[headers.indexOf(mapping.timestamp)],
            value: parseFloat(values[headers.indexOf(mapping.value)])
          };
        })
        .filter(point => !isNaN(point.value) && point.timestamp);

      console.log("Creating dataset with points:", dataPoints.length);

      // Create a new File from the Blob
      const newFile = new File([file], fileName, { type: 'text/csv' });

      const dataset = await createDataset(
        fileName.replace(/\.[^/.]+$/, ""),
        projectId,
        newFile,
        dataPoints
      );

      return json({ success: true, action: "create", dataset });
    } catch (error) {
      console.error('Error processing dataset:', error);
      return json(
        { error: "Failed to process dataset", details: error },
        { status: 500 }
      );
    }
  }

  // Handle dataset rename
  if (intent === "renameDataset") {
    const datasetId = formData.get("datasetId");
    const name = formData.get("name");

    if (!datasetId || typeof datasetId !== "string" || !name || typeof name !== "string") {
      return json({ error: "Dataset ID and name are required" }, { status: 400 });
    }

    try {
      const dataset = await updateDataset(datasetId, { name });
      return json({ success: true, action: "rename", dataset });
    } catch (error) {
      console.error('Error renaming dataset:', error);
      return json(
        { error: "Failed to rename dataset", details: error },
        { status: 500 }
      );
    }
  }

  return json({ error: "Invalid intent" }, { status: 400 });
}

export default function DatasetsRoute() {
  return null;
}

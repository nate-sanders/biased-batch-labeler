import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { getDatasetById } from "~/models/dataset.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const datasetId = url.searchParams.get('datasetId');

  if (!datasetId) {
    return json({ dataset: null });
  }

  const dataset = await getDatasetById(datasetId);
  return json({ dataset });
}

export default function Visualization() {
  const { dataset } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get('datasetId');

  if (!dataset) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">No Dataset Selected</h2>
        <p>Select a dataset from the sidebar to view its visualization.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">{dataset.name}</h2>
      {/* Add your visualization component here */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p>Visualization for dataset: {dataset.name}</p>
        {/* You can add charts or other visualization components here */}
      </div>
    </div>
  );
}

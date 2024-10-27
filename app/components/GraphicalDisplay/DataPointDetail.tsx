import * as React from "react";
import { Form } from "@remix-run/react";
import type { DataPoint, Label, Annotation } from "~/types";

interface DataPointDetailProps {
  dataPoint: DataPoint;
  labels: Label[];
  annotation?: Annotation;
  onClose: () => void;
}

export function DataPointDetail({
  dataPoint,
  labels,
  annotation,
  onClose,
}: DataPointDetailProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Data Point Details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Timestamp</p>
            <p>{new Date(dataPoint.timestamp).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Value</p>
            <p>{dataPoint.value}</p>
          </div>

          <Form method="post" className="space-y-4">
            <input type="hidden" name="dataPointId" value={dataPoint.id} />
            <div>
              <label className="block text-sm font-medium mb-2">
                Assign Label
              </label>
              <select
                name="labelId"
                defaultValue={annotation?.labelId}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">No Label</option>
                {labels.map((label) => (
                  <option key={label.id} value={label.id}>
                    {label.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                name="_action"
                value="updateAnnotation"
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

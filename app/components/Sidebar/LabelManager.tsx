import * as React from "react";
import { Form } from "@remix-run/react";
import type { Label } from "~/types";

interface LabelManagerProps {
  labels: Label[];
  isModalOpen: boolean;
  onCloseModal: () => void;
}

export function LabelManager({ labels, isModalOpen, onCloseModal }: LabelManagerProps) {
  return (
    <>
      <div className="space-y-2">
        {labels.map((label) => (
          <div
            key={label.id}
            className="flex items-center justify-between p-2 bg-gray-50 rounded"
          >
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: label.color }}
              />
              <span>{label.name}</span>
            </div>
            <Form method="post">
              <input type="hidden" name="labelId" value={label.id} />
              <button
                type="submit"
                name="_action"
                value="deleteLabel"
                className="text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </Form>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Label</h3>
            <Form method="post" className="space-y-4">
              <div>
                <label htmlFor="name" className="block mb-1">
                  Label Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="w-full border rounded px-2 py-1"
                  required
                />
              </div>
              <div>
                <label htmlFor="color" className="block mb-1">
                  Color
                </label>
                <input
                  type="color"
                  id="color"
                  name="color"
                  className="w-full"
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  name="_action"
                  value="createLabel"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  Add Label
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}
    </>
  );
}

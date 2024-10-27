import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";

interface DatasetMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  onSave: (mapping: Record<string, string>) => void;
}

const REQUIRED_FIELDS = [
  { key: "timestamp", label: "Timestamp" },
  { key: "value", label: "Value" },
];

export function DatasetMappingModal({ 
  isOpen, 
  onClose, 
  headers,
  onSave 
}: DatasetMappingModalProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const handleSave = () => {
    onSave(mapping);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium">
              Map CSV Fields
            </Dialog.Title>
            <Dialog.Close className="rounded-full p-1 hover:bg-gray-100">
              <Cross2Icon className="w-4 h-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {REQUIRED_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700">
                  {label}
                </label>
                <select
                  value={mapping[key] || ""}
                  onChange={(e) => setMapping(prev => ({ ...prev, [key]: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a field</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <Dialog.Close className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded">
              Cancel
            </Dialog.Close>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!REQUIRED_FIELDS.every(({ key }) => mapping[key])}
            >
              Save Mapping
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import * as React from "react";
import { Form } from "@remix-run/react";
import type { Label } from "~/types";

interface FilterManagerProps {
  labels: Label[];
  selectedLabels: string[];
  onFilterChange: (labelIds: string[]) => void;
}

export function FilterManager({ labels, selectedLabels, onFilterChange }: FilterManagerProps) {
  const handleCheckboxChange = (labelId: string) => {
    const newSelection = selectedLabels.includes(labelId)
      ? selectedLabels.filter(id => id !== labelId)
      : [...selectedLabels, labelId];
    onFilterChange(newSelection);
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold mb-4">Filters</h3>
      <div className="space-y-2">
        {labels.map((label) => (
          <div key={label.id} className="flex items-center">
            <input
              type="checkbox"
              id={`filter-${label.id}`}
              checked={selectedLabels.includes(label.id)}
              onChange={() => handleCheckboxChange(label.id)}
              className="h-4 w-4 text-blue-600 rounded border-gray-300"
            />
            <label htmlFor={`filter-${label.id}`} className="ml-2 flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: label.color }}
              />
              <span>{label.name}</span>
            </label>
          </div>
        ))}
      </div>
      {selectedLabels.length > 0 && (
        <button
          onClick={() => onFilterChange([])}
          className="mt-4 text-sm text-gray-600 hover:text-gray-900"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}

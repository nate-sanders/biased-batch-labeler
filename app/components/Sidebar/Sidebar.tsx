import * as React from "react";
import { useState } from "react";
import { LabelManager } from "./LabelManager";
import { FilterManager } from "./FilterManager";
import type { Label } from "~/types";

interface SidebarProps {
  labels: Label[];
  onFilterChange?: (labelIds: string[]) => void;
}

export function Sidebar({ labels, onFilterChange }: SidebarProps) {
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);

  const handleFilterChange = (labelIds: string[]) => {
    setSelectedLabels(labelIds);
    onFilterChange?.(labelIds);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 p-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Labels</h2>
        <button
          onClick={() => setIsLabelModalOpen(true)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add New Label
        </button>
      </div>

      <LabelManager 
        labels={labels}
        isModalOpen={isLabelModalOpen}
        onCloseModal={() => setIsLabelModalOpen(false)}
      />

      <FilterManager
        labels={labels}
        selectedLabels={selectedLabels}
        onFilterChange={handleFilterChange}
      />
    </div>
  );
}

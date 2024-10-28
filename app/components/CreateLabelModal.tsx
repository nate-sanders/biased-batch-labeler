import * as Dialog from '@radix-ui/react-dialog';
import * as Select from '@radix-ui/react-select';
import { Cross2Icon, ChevronDownIcon, ChevronUpIcon, CheckIcon } from '@radix-ui/react-icons';
import { useState } from 'react';

const COLORS = [
  { value: '#FF0000', label: 'Red' },
  { value: '#00FF00', label: 'Green' },
  { value: '#0000FF', label: 'Blue' },
  { value: '#FFD700', label: 'Gold' },
  { value: '#FF69B4', label: 'Pink' },
  { value: '#8A2BE2', label: 'Purple' },
  { value: '#FF8C00', label: 'Orange' },
  { value: '#00CED1', label: 'Turquoise' },
  { value: '#FF1493', label: 'Deep Pink' },
  { value: '#32CD32', label: 'Lime Green' },
];

interface CreateLabelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, color: string) => void;
}

export default function CreateLabelModal({ open, onOpenChange, onSubmit }: CreateLabelModalProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && selectedColor) {
      onSubmit(name.trim(), selectedColor);
      setName('');
      setSelectedColor(COLORS[0].value);
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-[400px] focus:outline-none">
          <Dialog.Title className="text-lg font-semibold mb-4">
            Create New Label
          </Dialog.Title>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Label Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter label name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Label Color
                </label>
                <Select.Root value={selectedColor} onValueChange={setSelectedColor}>
                  <Select.Trigger className="inline-flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: selectedColor }}
                      />
                      <Select.Value>
                        {COLORS.find(c => c.value === selectedColor)?.label}
                      </Select.Value>
                    </div>
                    <Select.Icon>
                      <ChevronDownIcon />
                    </Select.Icon>
                  </Select.Trigger>

                  <Select.Portal>
                    <Select.Content className="overflow-hidden bg-white rounded-md shadow-lg border border-gray-200 z-[100]">
                      <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white text-gray-700 cursor-default">
                        <ChevronUpIcon />
                      </Select.ScrollUpButton>

                      <Select.Viewport className="p-1">
                        {COLORS.map((color) => (
                          <Select.Item
                            key={color.value}
                            value={color.value}
                            className="flex items-center px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer outline-none relative"
                          >
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: color.value }}
                              />
                              <Select.ItemText>{color.label}</Select.ItemText>
                            </div>
                            <Select.ItemIndicator className="absolute left-1 flex items-center justify-center">
                              <CheckIcon />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Viewport>

                      <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white text-gray-700 cursor-default">
                        <ChevronDownIcon />
                      </Select.ScrollDownButton>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={!name.trim()}
              >
                Create Label
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <Cross2Icon />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

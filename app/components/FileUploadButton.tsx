import { useRef } from "react";
import { PlusIcon } from "@radix-ui/react-icons";

interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  accept?: string;
}

export function FileUploadButton({ onFileSelect, accept = ".csv" }: FileUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
      <button
        onClick={handleClick}
        className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
        title="Upload dataset"
      >
        <PlusIcon className="w-4 h-4 text-gray-700" />
      </button>
    </>
  );
}

import { Link, NavLink, Outlet, useLoaderData, useParams, useNavigate, useFetcher, useRevalidator, useSearchParams } from "@remix-run/react";
import { json, type ActionFunctionArgs } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useState, useRef, useEffect } from "react";
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon, Pencil1Icon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { requireUser } from "~/utils/session.server";
import { getProjectsByUser } from "~/models/project.server";
import { getLabelsByProject, createLabel } from "~/models/label.server";
import type { User } from "~/models/user.server";
import type { Label } from "~/models/label.server";
import { transformUser } from "~/models/user.server";
import type { Dataset } from "~/models/dataset.server";
import type { Filter } from "~/models/filter.server";
import { getDatasetsByProject } from "~/models/dataset.server";
import { getFiltersByProject } from "~/models/filter.server";
import { ContextMenu } from "~/components/ContextMenu";
import { FileUploadButton } from "~/components/FileUploadButton";
import { DatasetMappingModal } from "~/components/DatasetMappingModal";
import { Form } from "@remix-run/react";

// Add this type definition
type FetcherData = {
  success: boolean;
  action?: 'delete' | 'create' | 'rename';
  datasetId?: string;
  dataset?: Dataset;
  error?: string;
};

// Add Project type
type Project = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const rawUser = await requireUser(request);
  const user = transformUser(rawUser as any);
  const projects = await getProjectsByUser(user.id);
  
  let labels: Label[] = [];
  let datasets: Dataset[] = [];
  let filters: Filter[] = [];

  if (params.projectId) {
    labels = await getLabelsByProject(params.projectId);
    datasets = await getDatasetsByProject(params.projectId);
    filters = await getFiltersByProject(params.projectId);
  }

  return json({ 
    user,
    projects: projects || [],
    labels: labels || [],
    datasets: datasets || [],
    filters: filters || []
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const projectId = formData.get("projectId");

  if (intent === "createLabel" && projectId) {
    const name = formData.get("name");
    if (typeof name !== "string" || !name) {
      return json({ error: "Name is required" }, { status: 400 });
    }

    try {
      await createLabel({
        name,
        projectId: projectId.toString(),
      });
      return json({ success: true });
    } catch (error) {
      console.error('Error in action:', error);
      return json({ error: "Failed to create label" }, { status: 500 });
    }
  }

  return null;
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const fetcher = useFetcher<FetcherData>();
  const { revalidate } = useRevalidator();
  const { user, projects = [], labels = [], datasets = [], filters = [] } = useLoaderData<typeof loader>();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'labels' | 'datasets' | 'filters'>('labels');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    type: 'label' | 'dataset';
    position: { x: number; y: number } | null;
    itemId: string | null;
  }>({
    type: 'label',
    position: null,
    itemId: null
  });
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const initializedRef = useRef(false);

  // Add selectedProject definition
  const selectedProject = params.projectId 
    ? projects.find(p => p.id === params.projectId)
    : null;

  // Filter datasets
  const visibleDatasets = datasets.filter(dataset => !deletedIds.includes(dataset.id));
  
  // Get selected dataset
  const selectedDatasetId = searchParams.get('datasetId');
  const selectedDataset = selectedDatasetId 
    ? visibleDatasets.find(d => d.id === selectedDatasetId)
    : visibleDatasets[0];

  // Set initial dataset when project loads
  useEffect(() => {
    // Only run this effect once per project change
    if (!initializedRef.current && selectedProject && visibleDatasets.length > 0) {
      const currentDatasetId = searchParams.get('datasetId');
      
      // Only set if we don't have a dataset selected or if the current one isn't valid
      if (!currentDatasetId || !visibleDatasets.find(d => d.id === currentDatasetId)) {
        const firstDatasetId = visibleDatasets[0].id;
        setSearchParams(
          (prev) => {
            const newParams = new URLSearchParams(prev);
            newParams.set('datasetId', firstDatasetId);
            return newParams;
          },
          { replace: true }
        );
      }
      initializedRef.current = true;
    }
  }, [selectedProject?.id, visibleDatasets]); 

  // Reset initialization when project changes
  useEffect(() => {
    if (selectedProject?.id) {
      initializedRef.current = false;
    }
  }, [selectedProject?.id]);

  // Update the effect that handles deletion
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      const data = fetcher.data as FetcherData;
      if (data.action === "delete" && data.datasetId) {
        const datasetId = data.datasetId;
        setDeletedIds(prev => [...prev, datasetId]);
        
        // If the deleted dataset was selected, clear the selection
        if (searchParams.get('datasetId') === datasetId) {
          setSearchParams(
            (prev) => {
              const newParams = new URLSearchParams(prev);
              newParams.delete('datasetId');
              return newParams;
            },
            { replace: true }
          );
        }
      }
    }
  }, [fetcher.state, fetcher.data]); // Remove searchParams from dependencies

  // Handle dataset selection
  const handleDatasetSelect = (datasetId: string) => {
    // Update the URL with the selected dataset ID
    setSearchParams(
      (prev) => {
        prev.set('datasetId', datasetId);
        return prev;
      },
      { replace: true }  // Replace the current history entry instead of adding a new one
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get the display character for the avatar
  const getAvatarDisplay = () => {
    if (user.avatar_url) return null; // Will use image instead
    if (user.name?.charAt(0)) return user.name.charAt(0).toUpperCase();
    return user.email.charAt(0).toUpperCase();
  };

  const handleNewProject = () => {
    navigate("/dashboard/projects/new");
  };

  const handleNewLabel = () => {
    const name = prompt("Enter label name:");
    if (name && selectedProject?.id) {
      const formData = new FormData();
      formData.append("intent", "createLabel");
      formData.append("name", name);
      
      fetcher.submit(formData, {
        method: "post",
        action: `/dashboard/projects/${selectedProject.id}/labels`
      });
    }
  };

  const handleNewDataset = () => {
    const name = prompt("Enter dataset name:");
    if (name && selectedProject?.id) {
      const formData = new FormData();
      formData.append("intent", "createDataset");
      formData.append("name", name);
      
      fetcher.submit(formData, {
        method: "post",
        action: `/dashboard/projects/${selectedProject.id}/datasets`
      });
    }
  };

  const handleNewFilter = () => {
    const name = prompt("Enter filter name:");
    if (name && selectedProject?.id) {
      const formData = new FormData();
      formData.append("intent", "createFilter");
      formData.append("name", name);
      
      fetcher.submit(formData, {
        method: "post",
        action: `/dashboard/projects/${selectedProject.id}/filters`
      });
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'label' | 'dataset',
    itemId: string
  ) => {
    e.preventDefault();
    setContextMenu({
      type,
      position: { x: e.clientX, y: e.clientY },
      itemId
    });
  };

  const handleRenameLabel = async (labelId: string) => {
    const label = labels.find(l => l.id === labelId);
    const newName = prompt("Enter new name:", label?.name);
    if (newName && selectedProject?.id) {
      fetcher.submit(
        { intent: "renameLabel", name: newName, labelId },
        { method: "post", action: `/dashboard/projects/${selectedProject.id}/labels` }
      );
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!selectedProject?.id) return;
    
    if (window.confirm("Are you sure you want to delete this label?")) {
      fetcher.submit(
        { intent: "deleteLabel", labelId },
        { method: "post", action: `/dashboard/projects/${selectedProject.id}/labels` }
      );
    }
  };

  const handleRenameDataset = async (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId);
    const newName = prompt("Enter new name:", dataset?.name);
    if (newName && selectedProject?.id) {
      fetcher.submit(
        { intent: "renameDataset", name: newName, datasetId },
        { method: "post", action: `/dashboard/projects/${selectedProject.id}/datasets` }
      );
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!selectedProject?.id) {
      console.log("No project selected");
      return;
    }
    
    console.log("Initiating dataset deletion for ID:", datasetId);
    
    if (window.confirm("Are you sure you want to delete this dataset?")) {
      console.log("Deletion confirmed, submitting to fetcher");
      fetcher.submit(
        { intent: "deleteDataset", datasetId },
        { 
          method: "post", 
          action: `/dashboard/projects/${selectedProject.id}/datasets`
        }
      );
    }
  };

  const handleEditMapping = (datasetId: string) => {
    navigate(`/dashboard/projects/${selectedProject?.id}/datasets/${datasetId}/mapping`);
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    
    // Read CSV headers
    const text = await file.text();
    const lines = text.split('\n');
    if (lines.length > 0) {
      const headers = lines[0].split(',').map(h => h.trim());
      setCsvHeaders(headers);
      setIsMappingModalOpen(true);
    }
  };

  const handleSaveMapping = async (mapping: Record<string, string>) => {
    if (!selectedFile || !selectedProject?.id) return;

    try {
      const formData = new FormData();
      formData.append("intent", "createDataset"); // Add the intent
      formData.append("file", selectedFile);
      formData.append("mapping", JSON.stringify(mapping));
      formData.append("projectId", selectedProject.id);
      
      console.log("Submitting dataset with mapping:", {
        intent: "createDataset",
        fileName: selectedFile.name,
        mapping,
        projectId: selectedProject.id
      });

      fetcher.submit(formData, {
        method: "post",
        action: `/dashboard/projects/${selectedProject.id}/datasets`,
        encType: "multipart/form-data"
      });

      // Close the modal after submission
      setIsMappingModalOpen(false);
      setSelectedFile(null);
      setCsvHeaders([]);
    } catch (error) {
      console.error("Error submitting dataset:", error);
    }
  };

  return (
    <div className="p-2 h-screen bg-[#fafafa]">
      <div className="grid h-full w-full gap-4 grid-cols-[auto_1fr]">
        {/* Sidebar */}
        <div className="w-64 bg-[#fafafa] flex flex-col py-2 pl-2">
          {/* Header */}
          <header className="bg-[#fafafa]">
            <div className="py-3 pr-0 flex justify-between items-center">
              <img src="/logo.svg" alt="Biased Batch" className="h-6" />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="focus:outline-none"
                >
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.name || user.email}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 via-teal-500 to-purple-500 text-white flex items-center justify-center text-sm font-medium">
                      {getAvatarDisplay()}
                    </div>
                  )}
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                      {user.email}
                    </div>
                    <Link
                      to="/account"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Account Preferences
                    </Link>
                    <Link
                      to="/logout"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Logout
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Project Selection or Project View */}
          {!selectedProject ? (
            <>
              {/* Replace the old project header with new one */}
              <div className="mt-4 pl-2 pr-0 py-2 justify-between items-center inline-flex">
                <div className="text-black text-sm font-bold font-['Inter']">Projects</div>
                <button 
                  className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
                  onClick={handleNewProject}
                  title="Create new project"
                >
                  <PlusIcon className="w-4 h-4 text-gray-700" />
                </button>
              </div>
              
              {/* Rest of the projects list remains the same */}
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-2">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      to={`/dashboard/projects/${project.id}`}
                      className="block text-xs w-full text-left px-2 py-2 rounded hover:bg-gray-100"
                    >
                      {project.name}
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 pl-0 pr-0 py-2 items-center inline-flex">
                <button 
                  onClick={() => navigate("/dashboard/projects")}
                  className="flex items-center space-x-2 bg-black/5 hover:bg-black/3 rounded px-2 py-1 transition-colors"
                >
                  <span className="text-xs font-bold">All projects</span>
                </button>
                <ChevronRightIcon className="w-4 h-4" />
                <span className="ml-1 text-xs font-bold">{selectedProject?.name}</span>
              </div>

              {/* Tab Navigation */}
              <div className="flex space-x-2 px-0 py-4 border-b">
                <button
                  onClick={() => setActiveTab('labels')}
                  className={`h-6 px-1.5 py-1 rounded flex-col justify-start items-start inline-flex ${
                    activeTab === 'labels' 
                      ? 'bg-black/5'
                      : 'hover:bg-black/5'
                  }`}
                >
                  <div className="text-black text-xs font-medium">Labels</div>
                </button>
                <button
                  onClick={() => setActiveTab('datasets')}
                  className={`h-6 px-1.5 py-1 rounded flex-col justify-start items-start inline-flex ${
                    activeTab === 'datasets'
                      ? 'bg-black/5'
                      : 'hover:bg-black/5'
                  }`}
                >
                  <div className="text-black text-xs font-medium">Datasets</div>
                </button>
                <button
                  onClick={() => setActiveTab('filters')}
                  className={`h-6 px-1.5 py-1 rounded flex-col justify-start items-start inline-flex ${
                    activeTab === 'filters'
                      ? 'bg-black/5'
                      : 'hover:bg-black/5'
                  }`}
                >
                  <div className="text-black text-xs font-medium">Filters</div>
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'labels' && (
                  <div className="w-full">
                    <div className="w-full mt-2 pl-2 pr-0 py-2 justify-between items-center inline-flex">
                      <div className="text-black text-sm font-bold font-['Inter']">Labels</div>
                      <button 
                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
                        onClick={handleNewLabel}
                        title="Create new label"
                      >
                        <PlusIcon className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <div className="space-y-1">
                        {labels.map((label) => (
                          <div
                            key={label.id}
                            onContextMenu={(e) => handleContextMenu(e, 'label', label.id)}
                            className="block text-xs w-full text-left px-2 py-2 rounded hover:bg-gray-100"
                          >
                            {label.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'datasets' && (
                  <div className="w-full">
                    <div className="w-full mt-2 pl-2 pr-0 py-2 justify-between items-center inline-flex">
                      <div className="text-black text-sm font-bold font-['Inter']">Datasets</div>
                      <FileUploadButton onFileSelect={handleFileSelect} />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <div className="space-y-1">
                        {visibleDatasets.map((dataset) => (
                          <div
                            key={dataset.id}
                            onClick={() => handleDatasetSelect(dataset.id)}
                            onContextMenu={(e) => handleContextMenu(e, 'dataset', dataset.id)}
                            className={`block text-xs w-full text-left px-2 py-2 rounded cursor-pointer transition-colors
                              ${searchParams.get('datasetId') === dataset.id 
                                ? 'bg-black/[.03]' 
                                : 'hover:bg-black/[.05]'
                              }`}
                          >
                            {dataset.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'filters' && (
                  <div className="w-full">
                    <div className="w-full mt-2 pl-2 pr-0 py-2 justify-between items-center inline-flex">
                      <div className="text-black text-sm font-bold font-['Inter']">Filters</div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <div className="space-y-1">
                        {filters.map((filter) => (
                          <div
                            key={filter.id}
                            className="block text-xs w-full text-left px-2 py-2 rounded hover:bg-gray-100"
                          >
                            {filter.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {/* Main Content Area */}
        <main className="flex-1 overflow-auto bg-[#ffffff] border border-[#e9e9e9] rounded-lg">
          <Outlet />
        </main>
      </div>
      {contextMenu.position && (
        <ContextMenu
          position={contextMenu.position}
          onClose={() => setContextMenu({ ...contextMenu, position: null })}
          items={
            contextMenu.type === 'label'
              ? [
                  {
                    label: 'Rename',
                    onClick: () => handleRenameLabel(contextMenu.itemId!),
                    icon: <Pencil1Icon />
                  },
                  {
                    label: 'Delete',
                    onClick: () => handleDeleteLabel(contextMenu.itemId!),
                    icon: <TrashIcon />
                  }
                ]
              : [
                  {
                    label: 'Rename',
                    onClick: () => handleRenameDataset(contextMenu.itemId!),
                    icon: <Pencil1Icon />
                  },
                  {
                    label: 'Delete',
                    onClick: () => handleDeleteDataset(contextMenu.itemId!),
                    icon: <TrashIcon />
                  },
                  {
                    label: 'Edit mapping',
                    onClick: () => handleEditMapping(contextMenu.itemId!),
                    icon: <MixerHorizontalIcon />
                  }
                ]
          }
        />
      )}
      <DatasetMappingModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        headers={csvHeaders}
        onSave={handleSaveMapping}
      />
    </div>
  );
}

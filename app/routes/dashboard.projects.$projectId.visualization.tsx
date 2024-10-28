import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams, useSubmit } from "@remix-run/react";
import { getDatasetById, updateDatasetStatus, type DatasetStatus } from "~/models/dataset.server";
import { XYChart, AnimatedLineSeries, AnimatedAxis, Grid, Tooltip, DataContext } from '@visx/xychart';
import { scaleLinear, scaleTime } from '@visx/scale';
import { ParentSize } from '@visx/responsive';
import { useState, useMemo, useRef, useContext, useEffect } from 'react';
import { DataContextType } from '@visx/xychart';
import { ScaleTime } from 'd3-scale';
import { ScaleLinear } from 'd3-scale';
import { Brush } from '@visx/brush';
import { PatternLines } from '@visx/pattern';
import { getLabels } from "~/models/label.server";
import { Label } from "~/types";
import * as Popover from '@radix-ui/react-popover';
import * as Select from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

// Move color constants outside component
const COLORS = {
  SELECTED: '#ff2700',
  UNSELECTED: '#8884d8',
  SELECTED_OPACITY: 1,
  UNSELECTED_OPACITY: 0.6,
  SELECTION_BOX_FILL: 'rgba(255, 39, 0, 0.1)',
  SELECTION_BOX_STROKE: '#ff2700',
  HANDLE_FILL: '#ffffff',
  HANDLE_STROKE: '#8884d8',
  BRUSH_BG: '#fafafa',
  BRUSH_SELECTED_BG: 'rgba(255, 255, 255, 0.5)',  // Changed from '#ffffff' to semi-transparent
  BRUSH_BORDER: '#e9e9e9',
};

// Add this helper function near the top of the file
function getOptimalTickCount(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // For ranges less than 2 days, show hourly ticks (max 24)
  if (diffDays <= 2) {
    return Math.min(24, Math.ceil(diffTime / (1000 * 60 * 60)));
  }
  
  // For ranges less than 2 weeks, show daily ticks
  if (diffDays <= 14) {
    return diffDays;
  }
  
  // For ranges less than 2 months, show weekly ticks
  if (diffDays <= 60) {
    return Math.ceil(diffDays / 7);
  }
  
  // For ranges less than a year, show monthly ticks (reduced from 180 to 30)
  if (diffDays <= 365) {
    return Math.ceil(diffDays / 30);
  }
  
  // For ranges less than 4 years, show quarterly ticks (4 ticks per year)
  if (diffDays <= 365 * 4) {
    return Math.ceil(diffDays / (365 / 4));
  }
  
  // For ranges more than 4 years, show fewer ticks (about 1 tick per year)
  return Math.min(12, Math.ceil(diffDays / 365));
}

// Add this helper function to create the sparkline path
function createSparklinePath(
  data: DataPoint[],
  width: number,
  height: number,
  margin: { left: number; right: number; top: number; bottom: number }
): string {
  if (!data.length) return '';

  const xScale = scaleTime({
    range: [margin.left, width - margin.right],
    domain: [
      Math.min(...data.map(d => d.timestamp.getTime())),
      Math.max(...data.map(d => d.timestamp.getTime()))
    ]
  });

  const yScale = scaleLinear({
    range: [height - margin.top, margin.top],
    domain: [
      Math.min(...data.map(d => d.value)),
      Math.max(...data.map(d => d.value))
    ],
    nice: true
  });

  // Use full height for baseline
  const baselineY = height;
  
  return data
    .reduce((path, point, i) => {
      const x = xScale(point.timestamp);
      const y = yScale(point.value);
      if (isNaN(x) || isNaN(y)) return path;
      
      if (i === 0) {
        // Move to first point
        return `M ${x},${baselineY} L ${x},${y}`;
      }
      // Line to next point
      return path + ` L ${x},${y}`;
    }, '')
    // Close the path back to baseline
    + ` L ${xScale(data[data.length - 1].timestamp)},${baselineY} Z`;
}

// Add this constant near the top of the file with other constants
const BRUSH_EXTENT = {
  x0: 0,
  x1: 1,
  y0: 0,
  y1: 1
};

// Update the loader to ensure we're getting and returning valid data
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const datasetId = url.searchParams.get('datasetId');
  console.log('Loading dataset:', datasetId);

  if (!datasetId) {
    return json({ dataset: null, dataPoints: [], labels: [] });
  }

  // Fetch both dataset and labels in parallel
  const [dataset, labels] = await Promise.all([
    getDatasetById(datasetId),
    getLabels()
  ]);
  
  // Add error handling and data validation
  if (!dataset) {
    throw new Error(`Dataset with id ${datasetId} not found`);
  }

  // Ensure dataPoints exists and is properly formatted
  const dataPoints = dataset.dataPoints?.map(point => ({
    timestamp: new Date(point.timestamp).toISOString(),
    value: Number(point.value),
  })) || [];

  return json({ dataset, dataPoints, labels });
}

// Add action function to handle status updates
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const datasetId = formData.get("datasetId");

  if (intent === "updateStatus" && typeof datasetId === "string") {
    const status = formData.get("status");
    
    if (typeof status !== "string" || !['ready', 'in-progress', 'complete'].includes(status)) {
      return json({ error: "Invalid status" }, { status: 400 });
    }

    try {
      await updateDatasetStatus(datasetId, status as DatasetStatus);
      return json({ success: true });
    } catch (error) {
      console.error('Error in action:', error);
      return json({ error: "Failed to update status" }, { status: 500 });
    }
  }

  return null;
}

// Update the main component to handle dataset changes
export default function Visualization() {
  const { dataset, dataPoints, labels } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get('datasetId');
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number } | null;
    current: { x: number; y: number } | null;
  }>({ start: null, current: null });
  const chartRef = useRef<SVGSVGElement>(null);
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null);
  const brushRef = useRef<Brush | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(new Set());
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus>(dataset?.status || 'ready');
  const submit = useSubmit();

  // Reset state when dataset changes
  useEffect(() => {
    setSelectedPoints(new Set());
    setTimeRange(null);
    setSelectionBox({ start: null, current: null });
  }, [datasetId]);

  // Add effect to sync local state with database state
  useEffect(() => {
    if (dataset?.status) {
      setDatasetStatus(dataset.status);
    }
  }, [dataset?.status]);

  // Update the data conversion in useMemo to handle invalid data
  const data = useMemo(() => {
    if (!dataset || !dataPoints?.length) return [];
    
    return dataPoints
      .map((point, index) => {
        // Add validation for point data
        const timestamp = new Date(point.timestamp);
        const value = Number(point.value);
        
        if (isNaN(timestamp.getTime()) || isNaN(value)) {
          console.warn('Invalid data point:', point);
          return null;
        }

        return {
          timestamp,
          value,
          index
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [dataset, dataPoints]);

  // Calculate numTicks using useMemo (now always called)
  const numTicks = useMemo(() => {
    if (!data.length) return 12; // default fallback
    
    const startDate = new Date(Math.min(...data.map(d => d.timestamp.getTime())));
    const endDate = new Date(Math.max(...data.map(d => d.timestamp.getTime())));
    
    return getOptimalTickCount(startDate, endDate);
  }, [data]);

  const handleMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Convert client coordinates to relative coordinates
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setIsDragging(true);
    setSelectionBox({ start: { x, y }, current: { x, y } });
    setSelectedPoints(new Set());
  };

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !chartRef.current) return;

    const rect = chartRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setSelectionBox(prev => ({
      ...prev,
      current: { x, y }
    }));
  };

  const handleMouseUp = () => {
    if (!isDragging || !selectionBox.start || !selectionBox.current || !chartRef.current) return;

    const rect = chartRef.current.getBoundingClientRect();
    const margin = { top: 20, right: 16, bottom: 40, left: 48 };
    const chartWidth = rect.width - margin.left - margin.right;

    // Create scales that match the XYChart's scales
    const xScale = scaleTime({
      domain: timeRange || [
        Math.min(...data.map(d => d.timestamp.getTime())),
        Math.max(...data.map(d => d.timestamp.getTime()))
      ],
      range: [margin.left, rect.width - margin.right]
    });

    const minX = Math.min(selectionBox.start.x, selectionBox.current.x);
    const maxX = Math.max(selectionBox.start.x, selectionBox.current.x);

    // Convert screen coordinates back to timestamps
    const minTime = xScale.invert(minX);
    const maxTime = xScale.invert(maxX);

    // Store timestamps within the selected range
    const newSelectedPoints = new Set<string>();
    filteredData.forEach((point) => {
      const timestamp = point.timestamp.getTime();
      if (timestamp >= minTime.getTime() && timestamp <= maxTime.getTime()) {
        newSelectedPoints.add(point.timestamp.toISOString());
      }
    });

    if (newSelectedPoints.size > 0) {
      // Set popover position to the current mouse position
      setPopoverPosition({
        x: selectionBox.current.x,
        y: selectionBox.current.y
      });
    } else {
      setPopoverPosition(null);
    }
    
    setSelectedPoints(newSelectedPoints);
    setIsDragging(false);
    setSelectionBox({ start: null, current: null });
  };

  // Update the onBrushChange function to constrain the domain
  const onBrushChange = (domain: [Date, Date] | null) => {
    if (!domain || !data.length) return;
    
    const [minDataTime, maxDataTime] = [
      Math.min(...data.map(d => d.timestamp.getTime())),
      Math.max(...data.map(d => d.timestamp.getTime()))
    ];
    
    // Constrain the domain to the data bounds
    const constrainedDomain: [Date, Date] = [
      new Date(Math.max(domain[0].getTime(), minDataTime)),
      new Date(Math.min(domain[1].getTime(), maxDataTime))
    ];
    
    setTimeRange(constrainedDomain);
  };

  const filteredData = useMemo(() => {
    if (!timeRange || !data.length) return data;
    
    const [start, end] = timeRange;
    return data.filter(d => {
      const time = d.timestamp.getTime();
      return time >= start.getTime() && time <= end.getTime();
    });
  }, [data, timeRange]);

  // Add handler for label selection
  const handleLabelToggle = (labelId: string) => {
    setSelectedLabels(prev => {
      const next = new Set(prev);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });
  };

  // Add handler for applying labels
  const handleApplyLabels = () => {
    // TODO: Add API call to save labels for selected points
    console.log('Applying labels:', Array.from(selectedLabels));
    console.log('To points:', Array.from(selectedPoints));
    setPopoverPosition(null);
    setSelectedLabels(new Set());
  };

  // Add clear selection handler
  const handleClearSelection = () => {
    setSelectedPoints(new Set());
    setPopoverPosition(null);
    setSelectedLabels(new Set());
  };

  // Add handler for status changes
  const handleStatusChange = (newStatus: DatasetStatus) => {
    if (!dataset?.id) return;

    setDatasetStatus(newStatus);
    
    const formData = new FormData();
    formData.append("intent", "updateStatus");
    formData.append("datasetId", dataset.id);
    formData.append("status", newStatus);
    
    submit(formData, { method: "post" });
  };

  // Early return with better user feedback
  if (!datasetId) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">No Dataset Selected</h2>
        <p>Please select a dataset from the sidebar to view its visualization.</p>
      </div>
    );
  }

  if (!dataset || !data.length) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">No Data Available</h2>
        <p>The selected dataset is empty or contains invalid data points.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 flex items-center justify-between px-4 border-b">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold">{dataset?.name}</span>
          {selectedPoints.size > 0 && (
            <>
              <span className="text-gray-400">|</span>
              <div>
                <span className="font-mono font-bold">{selectedPoints.size}</span>
                <span className="font-inter ml-1.5">points selected</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="h-6 inline-flex items-center gap-2 px-2 py-0 text-sm text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <StatusIcon status={datasetStatus} />
                  <span className="capitalize">{datasetStatus === 'in-progress' ? 'In-Progress' : datasetStatus}</span>
                </div>
                <ChevronDownIcon className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content 
                className="bg-white rounded-md shadow-lg border border-gray-200 p-1 min-w-[120px]"
                sideOffset={5}
              >
                {(['ready', 'in-progress', 'complete'] as const).map((status) => (
                  <DropdownMenu.Item
                    key={status}
                    className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-sm cursor-pointer outline-none"
                    onSelect={() => handleStatusChange(status)}
                  >
                    <StatusIcon status={status} />
                    <span>{status === 'in-progress' ? 'In-Progress' : status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <button
            onClick={handleClearSelection}
            disabled={selectedPoints.size === 0}
            className="h-6 inline-flex items-center px-2 py-0 text-sm text-gray-600 bg-white border border-[#e9e9e9] hover:text-gray-900 hover:bg-gray-50 rounded disabled:opacity-50 disabled:pointer-events-none"
          >
            Clear Selection
          </button>
        </div>
      </div>

      {/* Visualization area */}
      <div className="bg-white flex-grow min-h-0 p-4">
        <ParentSize>
          {({ width, height }) => {
            if (width === 0 || height === 0) return null;

            // Adjust margin to account for the new padding
            const margin = { top: 20, right: 16, bottom: 40, left: 48 };
            const brushHeight = 64;
            const chartHeight = height - brushHeight - 20;

            return (
              <div style={{ position: 'relative', height: chartHeight }}>
                {/* Overlay for mouse events - now only covers the main chart */}
                <svg
                  ref={chartRef}
                  width={width}
                  height={chartHeight}
                  style={{ position: 'absolute', top: 0, left: 0 }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className={`${isDragging ? 'cursor-crosshair' : 'cursor-pointer'} overflow-visible` }
                >
                  {isDragging && selectionBox.start && selectionBox.current && (
                    <>
                      <rect
                        x={Math.min(selectionBox.start.x, selectionBox.current.x)}
                        y={margin.top}
                        width={Math.abs(selectionBox.current.x - selectionBox.start.x)}
                        height={chartHeight - margin.top - margin.bottom}
                        fill={COLORS.SELECTION_BOX_FILL}
                        className="pointer-events-none"
                      />
                      <rect
                        x={Math.min(selectionBox.start.x, selectionBox.current.x)}
                        y={margin.top}
                        width={Math.abs(selectionBox.current.x - selectionBox.start.x)}
                        height={chartHeight - margin.top - margin.bottom}
                        fill="none"
                        stroke={COLORS.SELECTION_BOX_STROKE}
                        className="pointer-events-none"
                      />
                    </>
                  )}
                </svg>

                {/* Main chart - update height */}
                <div style={{ height: chartHeight }}>
                  <XYChart
                    width={width}
                    height={chartHeight}
                    margin={margin}
                    xScale={{ 
                      type: 'time',
                      domain: timeRange || [
                        Math.min(...data.map(d => d.timestamp.getTime())),
                        Math.max(...data.map(d => d.timestamp.getTime()))
                      ]
                    }}
                    yScale={{ 
                      type: 'linear',
                      domain: [
                        Math.min(...filteredData.map(d => d.value)),
                        Math.max(...filteredData.map(d => d.value))
                      ],
                      nice: true
                    }}
                  >
                    <Grid
                      numTicks={numTicks}
                      strokeDasharray="4,4"
                      lineStyle={{ stroke: '#f2f2f2', strokeWidth: 1 }}
                      rows={true}
                      columns={true}
                    />
                    <AnimatedAxis 
                      orientation="bottom"
                      label="Time"
                      stroke="#f2f2f2"
                      numTicks={numTicks}
                      tickLabelProps={{
                        fill: '#666666',
                        fontFamily: 'monospace',
                        fontSize: 11
                      }}
                    />
                    <AnimatedAxis 
                      orientation="left"
                      label="Value"
                      stroke="#f2f2f2"
                      numTicks={8}
                      tickLabelProps={{
                        fill: '#666666',
                        fontFamily: 'monospace',
                        fontSize: 11
                      }}
                    />
                    <AnimatedLineSeries
                      dataKey="Time Series"
                      data={filteredData}
                      xAccessor={d => d.timestamp}
                      yAccessor={d => d.value}
                      stroke={COLORS.UNSELECTED}
                      strokeWidth={1}
                    />
                    <DataPoints 
                      data={filteredData} 
                      selectedPoints={selectedPoints} 
                    />
                  </XYChart>
                </div>

                {/* Brush component */}
                <div style={{ 
                  height: brushHeight, 
                  marginTop: '20px',
                  width: width - margin.left - margin.right,
                  marginLeft: margin.left
                }}>
                  <svg width={width - margin.left - margin.right} height={brushHeight} className="overflow-visible">
                    {/* Define gradient for the area chart */}
                    <defs>
                      <linearGradient id="sparklineGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.UNSELECTED} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={COLORS.UNSELECTED} stopOpacity={0.1} />
                      </linearGradient>
                      {/* Pattern for the brush selection */}
                      <pattern
                        id="diagonalLines"
                        patternUnits="userSpaceOnUse"
                        width="4"
                        height="4"
                        patternTransform="rotate(45)"
                      >
                        <line
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="4"
                          stroke={COLORS.UNSELECTED}
                          strokeWidth="1.5"
                          opacity="0.5"
                        />
                      </pattern>
                    </defs>

                    {/* Background rectangle */}
                    <rect
                      x={0}
                      y={0}
                      width={width - margin.left - margin.right}
                      height={brushHeight}
                      fill={COLORS.BRUSH_BG}
                    />

                    {/* Mini visualization of the data */}
                    <g>
                      <path
                        d={createSparklinePath(data, width - margin.left - margin.right, brushHeight, {
                          left: 0,
                          right: 0,
                          top: 5,
                          bottom: 0
                        })}
                        fill="url(#sparklineGradient)"
                        strokeWidth={0}
                        opacity={0.8}
                      />
                    </g>

                    <Brush
                      xScale={scaleTime({
                        range: [0, width - margin.left - margin.right],
                        domain: [
                          Math.min(...data.map(d => d.timestamp.getTime())),
                          Math.max(...data.map(d => d.timestamp.getTime()))
                        ]
                      })}
                      yScale={scaleLinear({
                        range: [brushHeight, 0],
                        domain: [0, Math.max(...data.map(d => d.value))]
                      })}
                      width={width - margin.left - margin.right}
                      height={brushHeight}
                      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                      handleSize={8}
                      resizeTriggerAreas={['left', 'right']}
                      brushDirection="horizontal"
                      initialBrushPosition={{
                        start: { x: 0 },
                        end: { x: width - margin.left - margin.right }
                      }}
                      ref={brushRef}  // Use ref instead of innerRef
                      onChange={domain => {
                        if (!domain) return;
                        const { x0, x1 } = domain;
                        onBrushChange([new Date(x0), new Date(x1)]);
                      }}
                      onClick={() => {
                        setTimeRange(null);
                      }}
                      selectedBoxStyle={{
                        fill: 'url(#diagonalLines)',
                        stroke: COLORS.BRUSH_BORDER,
                        rx: 8
                      }}
                      renderBrushHandle={({ x, height, isBrushActive }) => {
                        const handleWidth = 6;
                        const dotSize = 2;
                        const dotSpacing = 3;
                        const numDots = 4;
                        const totalDotsHeight = (numDots - 1) * dotSpacing;
                        const handleHeight = totalDotsHeight + 8;
                        const handleY = (height - handleHeight) / 2;
                        const handleX = x + 4;
                        
                        // Calculate the starting Y position for perfect vertical centering
                        const firstDotY = handleY + handleHeight/2 - totalDotsHeight/2;
                        
                        return (
                          <g>
                            {/* Handle bar */}
                            <rect
                              x={handleX - handleWidth / 2}
                              y={handleY}
                              width={handleWidth}
                              height={handleHeight}
                              fill={COLORS.HANDLE_FILL}
                              stroke={COLORS.HANDLE_STROKE}
                              strokeWidth={1}
                              rx={2}
                              style={{ cursor: 'ew-resize' }}
                            />
                            {/* Handle dots */}
                            {Array.from({ length: numDots }).map((_, i) => (
                              <circle
                                key={i}
                                cx={handleX}
                                cy={firstDotY + (i * dotSpacing)}
                                r={dotSize / 2}
                                fill={COLORS.HANDLE_STROKE}
                                style={{ cursor: 'ew-resize' }}
                              />
                            ))}
                          </g>
                        );
                      }}
                    />
                  </svg>
                </div>
              </div>
            );
          }}
        </ParentSize>
      </div>

      {/* Add the Popover component */}
      {popoverPosition && selectedPoints.size > 0 && (
        <Popover.Root open={true} onOpenChange={(open) => !open && setPopoverPosition(null)}>
          <Popover.Trigger className="hidden" />
          <Popover.Portal>
            <Popover.Content
              className="z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80 animate-in fade-in"
              sideOffset={5}
              style={{
                position: 'absolute',
                left: `${popoverPosition.x}px`,
                top: `${popoverPosition.y}px`,
              }}
            >
              <div className="mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Select the best label(s) for your selected data points:
                </h3>
              </div>
              
              <div className="relative">
                <Select.Root 
                  value="placeholder" // Use a dummy value to force controlled behavior
                  onValueChange={() => {}} // Dummy handler since we're using custom click handling
                >
                  <Select.Trigger 
                    className="inline-flex items-center justify-between w-full min-w-[160px] px-3 py-2 text-sm bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
                  >
                    <span className="text-sm text-gray-700">
                      {selectedLabels.size === 0 
                        ? "Select labels..." 
                        : `${selectedLabels.size} label${selectedLabels.size === 1 ? '' : 's'} selected...`}
                    </span>
                    <Select.Icon>
                      <ChevronDownIcon />
                    </Select.Icon>
                  </Select.Trigger>

                  <Select.Portal>
                    <Select.Content 
                      className="bg-white rounded-md shadow-lg border border-gray-200 z-[100]"
                      position="popper"
                      sideOffset={5}
                    >
                      <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white text-gray-700 cursor-default">
                        <ChevronUpIcon />
                      </Select.ScrollUpButton>

                      <Select.Viewport className="p-2">
                        {labels?.map((label) => (
                          <div
                            key={label.id}
                            className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded-sm cursor-pointer select-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleLabelToggle(label.id);
                            }}
                          >
                            <div className="flex items-center space-x-2 flex-1">
                              <div className="flex items-center justify-center w-4 h-4 rounded border border-gray-300 bg-white">
                                {selectedLabels.has(label.id) && (
                                  <CheckIcon className="w-3 h-3 text-blue-600" />
                                )}
                              </div>
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: label.color }}
                              />
                              <span className="text-sm text-gray-700">{label.name}</span>
                            </div>
                          </div>
                        ))}
                      </Select.Viewport>

                      <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white text-gray-700 cursor-default">
                        <ChevronDownIcon />
                      </Select.ScrollDownButton>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => setPopoverPosition(null)}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyLabels}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={selectedLabels.size === 0}
                >
                  Apply Labels
                </button>
              </div>
              <Popover.Arrow className="fill-white" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </div>
  );
}

// Add this new component to handle the data points
interface DataPoint {
  timestamp: Date;
  value: number;
  index: number;
}

interface DataPointsProps {
  data: DataPoint[];
  selectedPoints: Set<string>;
}

function DataPoints({ data, selectedPoints }: DataPointsProps) {
  const { xScale, yScale } = useContext(DataContext) as {
    xScale: ScaleTime<number, number>;
    yScale: ScaleLinear<number, number>;
  };
  
  if (!xScale || !yScale) return null;
  
  return (
    <g>
      {data.map((point, index) => {
        const x = xScale(point.timestamp);
        const y = yScale(point.value);
        
        if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) {
          return null;
        }

        const isSelected = selectedPoints.has(point.timestamp.toISOString());

        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={isSelected ? 4 : 2}
            fill={isSelected ? COLORS.SELECTED : COLORS.UNSELECTED}
            opacity={isSelected ? COLORS.SELECTED_OPACITY : COLORS.UNSELECTED_OPACITY}
            className="transition-all duration-50"
          />
        );
      })}
    </g>
  );
}

// Add this new StatusIcon component within the same file:
function StatusIcon({ status }: { status: StatusType }) {
  switch (status) {
    case 'ready':
      return (
        <div className="w-4 h-4">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle
              cx="8"
              cy="8"
              r="7"
              fill="none"
              stroke="#afafaf"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          </svg>
        </div>
      );
    case 'in-progress':
      return (
        <div className="relative w-4 h-4">
          <div className="absolute inset-0 rounded-full border-2 border-yellow-500" />
          <div className="absolute inset-0 rounded-full bg-yellow-500 opacity-50" />
        </div>
      );
    case 'complete':
      return (
        <div className="relative w-4 h-4">
          <div className="absolute inset-0 rounded-full bg-green-500" />
          <CheckIcon className="absolute inset-0 w-4 h-4 text-white" />
        </div>
      );
    default:
      return null;
  }
}

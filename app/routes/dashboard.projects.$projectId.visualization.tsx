import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import { getDatasetById } from "~/models/dataset.server";
import { XYChart, AnimatedLineSeries, AnimatedAxis, Grid, Tooltip, DataContext } from '@visx/xychart';
import { scaleLinear, scaleTime } from '@visx/scale';
import { ParentSize } from '@visx/responsive';
import { useState, useMemo, useRef, useContext } from 'react';
import { DataContextType } from '@visx/xychart';
import { ScaleTime } from 'd3-scale';
import { ScaleLinear } from 'd3-scale';
import { Brush } from '@visx/brush';
import { PatternLines } from '@visx/pattern';

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

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const datasetId = url.searchParams.get('datasetId');

  if (!datasetId) {
    return json({ dataset: null, dataPoints: [] });
  }

  const dataset = await getDatasetById(datasetId);
  return json({ dataset, dataPoints: dataset?.dataPoints || [] });
}

export default function Visualization() {
  const { dataset, dataPoints } = useLoaderData<typeof loader>();
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    start: { x: number; y: number } | null;
    current: { x: number; y: number } | null;
  }>({ start: null, current: null });
  const chartRef = useRef<SVGSVGElement>(null);
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null);
  const brushRef = useRef<Brush | null>(null);

  // Update the data conversion in useMemo
  const data = useMemo(() => {
    if (!dataset || !dataPoints.length) return [];
    
    // Convert and sort the data points by timestamp
    return dataPoints
      .map((point, index) => ({
        ...point,
        timestamp: new Date(point.timestamp),
        index
      }))
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

  // Early return after all hooks are called
  if (!dataset || !dataPoints.length) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">No Data Available</h2>
        <p>Select a dataset from the sidebar or ensure the dataset contains data points.</p>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col h-full">
      {/* Header section with title, stats and controls */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-baseline gap-4">
          <h2 className="text-2xl font-bold">{dataset?.name}</h2>
          <span className="text-sm text-gray-600">
            {selectedPoints.size > 0 
              ? `${selectedPoints.size} points selected` 
              : 'No points selected'}
          </span>
        </div>
        <button
          onClick={() => setSelectedPoints(new Set())}
          className={`px-3 py-1 text-sm rounded transition-colors
            ${selectedPoints.size === 0 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          disabled={selectedPoints.size === 0}
        >
          Clear Selection
        </button>
      </div>

      {/* Visualization area */}
      <div className="bg-white flex-grow min-h-0">
        <ParentSize>
          {({ width, height }) => {
            if (width === 0 || height === 0) return null;

            const margin = { top: 20, right: 16, bottom: 40, left: 48 };
            const brushHeight = 60;
            const chartHeight = height - brushHeight - 20; // 20px gap between chart and brush

            return (
              <div style={{ position: 'relative', height: chartHeight }}>
                {/* Overlay for mouse events - now only covers the main chart */}
                <svg
                  ref={chartRef}
                  width={width}
                  height={chartHeight}  // Changed from height to chartHeight
                  style={{ position: 'absolute', top: 0, left: 0 }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  className={`${isDragging ? 'cursor-crosshair' : 'cursor-pointer'}`}
                >
                  {isDragging && selectionBox.start && selectionBox.current && (
                    <>
                      <rect
                        x={Math.min(selectionBox.start.x, selectionBox.current.x)}
                        y={margin.top}
                        width={Math.abs(selectionBox.current.x - selectionBox.start.x)}
                        height={chartHeight - margin.top - margin.bottom}  // Updated height
                        fill={COLORS.SELECTION_BOX_FILL}
                        className="pointer-events-none"
                      />
                      <rect
                        x={Math.min(selectionBox.start.x, selectionBox.current.x)}
                        y={margin.top}
                        width={Math.abs(selectionBox.current.x - selectionBox.start.x)}
                        height={chartHeight - margin.top - margin.bottom}  // Updated height
                        fill="none"
                        stroke={COLORS.SELECTION_BOX_STROKE}
                        strokeWidth={1.5}
                        strokeDasharray="4,4"
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
                    />
                    <AnimatedAxis 
                      orientation="left"
                      label="Value"
                      stroke="#f2f2f2"
                      numTicks={8}
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
                  <svg width={width - margin.left - margin.right} height={brushHeight}>
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
                          strokeWidth="1.5"  // Increased from 1
                          opacity="0.5"      // Increased from 0.3
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
                        const totalDotsHeight = (numDots - 1) * dotSpacing; // Height from first dot center to last dot center
                        const handleHeight = totalDotsHeight + 8; // 4px padding top and bottom
                        const handleY = (height - handleHeight) / 2; // Center the handle vertically
                        const handleX = x + 4; // Move handle 4px to the right
                        
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
            className="transition-all duration-150"
          />
        );
      })}
    </g>
  );
}

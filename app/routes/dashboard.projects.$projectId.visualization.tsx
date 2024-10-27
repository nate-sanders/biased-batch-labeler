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
import BaseBrush from '@visx/brush/lib/BaseBrush';

// Move color constants outside component
const COLORS = {
  SELECTED: '#ff2700',
  UNSELECTED: '#8884d8',
  SELECTED_OPACITY: 1,
  UNSELECTED_OPACITY: 0.6,
  SELECTION_BOX_FILL: 'rgba(255, 39, 0, 0.1)',
  SELECTION_BOX_STROKE: '#ff2700'
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
  
  // For ranges less than a year, show monthly ticks
  if (diffDays <= 365) {
    return Math.ceil(diffDays / 30);
  }
  
  // For ranges less than 4 years, show quarterly ticks
  if (diffDays <= 365 * 4) {
    return Math.ceil(diffDays / 90);
  }
  
  // For ranges more than 4 years, show annual ticks
  return Math.ceil(diffDays / 365);
}

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
  const brushRef = useRef<BaseBrush | null>(null);

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

  const onBrushChange = (domain: [Date, Date] | null) => {
    setTimeRange(domain);
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
    <div className="p-6 h-full">
      <h2 className="text-2xl font-bold mb-4">{dataset?.name}</h2>
      <div className="bg-white w-full h-[600px]">
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
                    {/* <Grid
                      numTicks={numTicks}
                      strokeWidth={1}
                      stroke={'grey'}
                    /> */}
                    <AnimatedAxis 
                      orientation="bottom"
                      label="Time"
                      numTicks={numTicks}
                    />
                    <AnimatedAxis 
                      orientation="left"
                      label="Value"
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
                <div style={{ height: brushHeight, marginTop: '20px' }}>
                  <svg width={width} height={brushHeight}>
                    <PatternLines
                      id="brush-pattern"
                      height={8}
                      width={8}
                      stroke={COLORS.UNSELECTED}
                      strokeWidth={1}
                      orientation={['diagonal']}
                    />
                    {/* Add the background line series first */}
                    <AnimatedLineSeries
                      dataKey="brush-line"
                      data={data}
                      xAccessor={d => d.timestamp}
                      yAccessor={d => d.value}
                      stroke={COLORS.UNSELECTED}
                      strokeWidth={1}
                    />
                    {/* Then add the brush without children */}
                    <Brush
                      xScale={scaleTime({
                        range: [margin.left, width - margin.right],
                        domain: [
                          Math.min(...data.map(d => d.timestamp.getTime())),
                          Math.max(...data.map(d => d.timestamp.getTime()))
                        ]
                      })}
                      yScale={scaleLinear({
                        range: [brushHeight, 0],
                        domain: [0, Math.max(...data.map(d => d.value))]
                      })}
                      width={width}
                      height={brushHeight}
                      margin={margin}
                      handleSize={8}
                      resizeTriggerAreas={['left', 'right']}
                      brushDirection="horizontal"
                      initialBrushPosition={{
                        start: { x: margin.left },
                        end: { x: width - margin.right }
                      }}
                      onChange={domain => {
                        if (!domain) return;
                        const { x0, x1 } = domain;
                        onBrushChange([new Date(x0), new Date(x1)]);
                      }}
                      onClick={() => {
                        setTimeRange(null);
                      }}
                      selectedBoxStyle={{
                        fill: 'url(#brush-pattern)',
                        stroke: COLORS.UNSELECTED
                      }}
                    />
                  </svg>
                </div>
              </div>
            );
          }}
        </ParentSize>
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <p>Selected points: {selectedPoints.size}</p>
        <button
          onClick={() => setSelectedPoints(new Set())}
          className="mt-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          disabled={selectedPoints.size === 0}
        >
          Clear Selection
        </button>
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

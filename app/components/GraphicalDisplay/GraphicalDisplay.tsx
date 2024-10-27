import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { DataPoint, Annotation, Label } from "~/types";

interface GraphicalDisplayProps {
  dataPoints: DataPoint[];
  annotations: Annotation[];
  labels: Label[];
}

export function GraphicalDisplay({ dataPoints, annotations, labels }: GraphicalDisplayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedPoint, setSelectedPoint] = useState<DataPoint | null>(null);

  useEffect(() => {
    if (!svgRef.current || !dataPoints.length) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    // Clear previous content
    svg.selectAll("*").remove();

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(dataPoints, d => new Date(d.timestamp)) as [Date, Date])
      .range([margin.left, width - margin.right]);

    const yScale = d3.scaleLinear()
      .domain(d3.extent(dataPoints, d => d.value) as [number, number])
      .range([height - margin.bottom, margin.top]);

    // Add axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis);

    svg.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${margin.left},0)`)
      .call(yAxis);

    // Add data points
    svg.selectAll("circle")
      .data(dataPoints)
      .join("circle")
      .attr("cx", d => xScale(new Date(d.timestamp)))
      .attr("cy", d => yScale(d.value))
      .attr("r", 5)
      .attr("fill", d => {
        const annotation = annotations.find(a => a.dataPointId === d.id);
        if (annotation) {
          const label = labels.find(l => l.id === annotation.labelId);
          return label?.color || "blue";
        }
        return "blue";
      })
      .on("click", (_, d) => {
        setSelectedPoint(d);
      });

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        const transform = event.transform;
        svg.selectAll("circle")
          .attr("transform", transform.toString());
        
        svg.select<SVGGElement>(".x-axis")
          .call(xAxis.scale(transform.rescaleX(xScale)));
        
        svg.select<SVGGElement>(".y-axis")
          .call(yAxis.scale(transform.rescaleY(yScale)));
      });

    svg.call(zoom);
  }, [dataPoints, annotations, labels]);

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        className="w-full h-full"
      />
      {selectedPoint && (
        <div className="absolute top-4 right-4 bg-white p-4 shadow-lg rounded-lg">
          <h3 className="font-bold">Data Point Details</h3>
          <p>Timestamp: {new Date(selectedPoint.timestamp).toLocaleString()}</p>
          <p>Value: {selectedPoint.value}</p>
          <button
            className="mt-2 px-3 py-1 bg-gray-200 rounded"
            onClick={() => setSelectedPoint(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

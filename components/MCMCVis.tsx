import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { Point, StepDetails, GMMComponent, AlgorithmType } from '../types';
import { getLogProb, getGradLogProb } from '../services/distribution';

interface Props {
  history: Point[];
  current: Point;
  proposal?: Point;
  lastPath?: Point[]; 
  width?: number;
  height?: number;
  detailedMode: boolean;
  lastDetails: StepDetails | null;
  gmmParams: GMMComponent[];
  algorithm: AlgorithmType;
}

const MCMCVis: React.FC<Props> = ({ 
  history, 
  current, 
  proposal, 
  lastPath, 
  width, 
  height, 
  detailedMode, 
  lastDetails, 
  gmmParams,
  algorithm
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Visualization bounds
  const domainX = [-6, 6];
  const domainY = [-6, 6];

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const plotWidth = width || containerRef.current.clientWidth;
    const plotHeight = height || containerRef.current.clientHeight;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    // Definitions for markers (Arrows)
    svg.append("defs").append("marker")
      .attr("id", "arrow-red")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#ef4444");

    // Scales
    const xScale = d3.scaleLinear().domain(domainX).range([0, plotWidth]);
    const yScale = d3.scaleLinear().domain(domainY).range([plotHeight, 0]);

    // 1. Draw Density "Heatmap" Background
    const densityData: {x: number, y: number, prob: number}[] = [];
    const resolution = 50; 
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = domainX[0] + (i / resolution) * (domainX[1] - domainX[0]);
        const y = domainY[0] + (j / resolution) * (domainY[1] - domainY[0]);
        const logP = getLogProb({x, y}, gmmParams);
        densityData.push({ x, y, prob: Math.exp(logP) });
      }
    }

    const colorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, 0.15]); 

    svg.append("g")
      .selectAll("circle")
      .data(densityData)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", Math.ceil(plotWidth / resolution) * 0.8)
      .attr("fill", d => colorScale(d.prob))
      .attr("opacity", 0.4);

    // 2. Draw History Trace (Lines)
    const visibleTrace = history.slice(-10); // Show a bit more context
    
    // Use curveStepAfter for Gibbs to show orthogonal movement (X moves then Y moves)
    // Use curveLinear for others
    const curveType = algorithm === AlgorithmType.GIBBS ? d3.curveStepAfter : d3.curveLinear;

    const lineGen = d3.line<Point>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(curveType);

    if (visibleTrace.length > 1) {
      svg.append("path")
        .datum(visibleTrace)
        .attr("fill", "none")
        .attr("stroke", "rgba(255, 255, 255, 0.5)")
        .attr("stroke-width", 1.5)
        .attr("d", lineGen);
    }

    // 3. Draw History Points
    const visibleHistory = history.slice(-2000);
    svg.append("g")
      .selectAll("circle")
      .data(visibleHistory)
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.x))
      .attr("cy", d => yScale(d.y))
      .attr("r", 2)
      .attr("fill", "white")
      .attr("opacity", 0.4);

    // 4. Draw Trajectory (HMC/NUTS)
    if (lastPath && lastPath.length > 0) {
      const trajLineGen = d3.line<Point>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveLinear); // Trajectories are always smooth physics

      svg.append("path")
        .datum(lastPath)
        .attr("fill", "none")
        .attr("stroke", "#facc15") // Yellow
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,2")
        .attr("d", trajLineGen)
        .attr("opacity", 0.8);
        
      // Show points on trajectory
      svg.append("g")
        .selectAll("circle")
        .data(lastPath)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 2)
        .attr("fill", "#facc15");
    }

    // 5. Draw Proposal Point (Ghost)
    if (detailedMode && proposal) {
      svg.append("circle")
        .attr("cx", xScale(proposal.x))
        .attr("cy", yScale(proposal.y))
        .attr("r", 6)
        .attr("fill", "none")
        .attr("stroke", "#34d399") // Greenish
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "2,2")
        .attr("opacity", 0.8);
        
      // Line to proposal
      svg.append("line")
        .attr("x1", xScale(current.x))
        .attr("y1", yScale(current.y))
        .attr("x2", xScale(proposal.x))
        .attr("y2", yScale(proposal.y))
        .attr("stroke", "#34d399")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");
    }

    // 6. Draw Gradient Arrow (Only for Gradient-based methods)
    const showGradient = detailedMode && (algorithm === AlgorithmType.HMC || algorithm === AlgorithmType.NUTS);
    
    if (showGradient) {
        const grad = getGradLogProb(current, gmmParams);
        const gradLen = Math.sqrt(grad.x*grad.x + grad.y*grad.y);
        const scale = 0.5; 
        
        if (gradLen > 0.001) {
            svg.append("line")
                .attr("x1", xScale(current.x))
                .attr("y1", yScale(current.y))
                .attr("x2", xScale(current.x + grad.x * scale))
                .attr("y2", yScale(current.y + grad.y * scale))
                .attr("stroke", "#ef4444")
                .attr("stroke-width", 2)
                .attr("marker-end", "url(#arrow-red)");
        }
    }

    // 7. Draw Current Position
    svg.append("circle")
      .attr("cx", xScale(current.x))
      .attr("cy", yScale(current.y))
      .attr("r", 6)
      .attr("fill", "#ef4444") // Red
      .attr("stroke", "white")
      .attr("stroke-width", 2);

  }, [history, current, proposal, lastPath, width, height, detailedMode, lastDetails, gmmParams, algorithm]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] bg-slate-900 rounded-xl overflow-hidden shadow-inner border border-slate-700">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

export default MCMCVis;
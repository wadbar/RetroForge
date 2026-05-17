import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  name: string;
  type: 'function' | 'block' | 'entry' | 'exit';
  code?: string;
}

interface Link {
  source: string;
  target: string;
  label?: string;
}

interface CFGVisualizerProps {
  nodes: Node[];
  links: Link[];
  onNodeSelect?: (node: Node) => void;
}

export const CFGVisualizer: React.FC<CFGVisualizerProps> = ({ nodes, links, onNodeSelect }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const width = svgRef.current.clientWidth;
    const height = 400;

    const svg = d3.select(svgRef.current)
      .attr('width', '100%')
      .attr('height', height)
      .style('background', 'transparent');

    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Forces
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Marker for arrows
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#06b6d4')
      .style('stroke', 'none');

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)');

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, any>()
        .on('start', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: any, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: any, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }) as any);

    node.append('rect')
      .attr('width', 120)
      .attr('height', 40)
      .attr('rx', 6)
      .attr('x', -60)
      .attr('y', -20)
      .attr('fill', (d: any) => d.type === 'function' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(30, 41, 59, 0.8)')
      .attr('stroke', (d: any) => d.type === 'function' ? '#06b6d4' : '#334155')
      .attr('stroke-width', 2)
      .on('click', (event, d) => onNodeSelect?.(d as Node));

    node.append('text')
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f8fafc')
      .style('font-size', '10px')
      .style('pointer-events', 'none')
      .text((d: any) => d.name);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, onNodeSelect]);

  return (
    <div className="w-full h-full border border-white/5 rounded-xl bg-black/40 overflow-hidden relative">
      <div className="absolute top-4 left-4 flex gap-2">
         <span className="flex items-center gap-1.5 text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
            CFG: CONTROL FLOW GRAPH
         </span>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};

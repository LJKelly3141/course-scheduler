import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { api } from "@/api/client";
import type { PrereqGraph } from "@/api/types";

interface Props {
  department?: string;
  /** Course IDs offered in the selected term, for coloring nodes */
  offeredCourseIds?: Set<number>;
}

const NODE_WIDTH = 120;
const NODE_HEIGHT = 40;

function layoutGraph(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

  return { nodes: layoutNodes, edges };
}

export function PrerequisiteGraph({ department, offeredCourseIds }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["prerequisites", "graph", department],
    queryFn: () => {
      const params = new URLSearchParams();
      if (department) params.set("department", department);
      return api.get<PrereqGraph>(`/prerequisites/graph?${params.toString()}`);
    },
  });

  const { nodes, edges } = useMemo(() => {
    if (!data || data.nodes.length === 0) return { nodes: [], edges: [] };

    const rawNodes: Node[] = data.nodes.map((n) => {
      const isOffered = offeredCourseIds?.has(Number(n.id));
      return {
        id: n.id,
        data: {
          label: `${n.department_code} ${n.course_number}`,
        },
        position: { x: 0, y: 0 },
        style: {
          background: isOffered ? "#dcfce7" : "#f3f4f6",
          border: `1px solid ${isOffered ? "#16a34a" : "#d1d5db"}`,
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 12,
          fontWeight: 500,
          width: NODE_WIDTH,
        },
      };
    });

    const rawEdges: Edge[] = data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.is_corequisite,
      style: {
        stroke: e.is_corequisite ? "#3b82f6" : "#9ca3af",
        strokeWidth: 1.5,
      },
      label: e.is_corequisite ? "coreq" : undefined,
      labelStyle: { fontSize: 9, fill: "#6b7280" },
    }));

    return layoutGraph(rawNodes, rawEdges);
  }, [data, offeredCourseIds]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading prerequisites graph...</span>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No prerequisites defined yet. Edit a course to add prerequisites.
      </p>
    );
  }

  return (
    <div className="h-[500px] w-full border border-border rounded-lg bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

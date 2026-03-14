import { useMemo, useCallback } from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

export default function CaseGraph({ graph, onNavigate }) {
  const nodes = useMemo(() => graph?.nodes || [], [graph]);
  const edges = useMemo(() => graph?.edges || [], [graph]);

  const handleNodeClick = useCallback((_, node) => {
    const page = node?.data?.page;
    if (page && onNavigate) onNavigate(page);
  }, [onNavigate]);

  return (
    <div className="panel case-graph-panel">
      <div className="panel-header">Case Graph</div>
      <div className="panel-body case-graph-body">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodeClick={handleNodeClick}
        >
          <Background gap={20} size={1} />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

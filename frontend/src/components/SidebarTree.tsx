import React from "react";

interface TreeNode {
  key: string;
  value?: any;
  children?: TreeNode[];
}

interface SidebarTreeProps {
  data: any;
  onSelect?: (path: string[]) => void;
}

function buildTree(data: any, path: string[] = []): TreeNode[] {
  if (typeof data !== "object" || data === null) return [];
  return Object.entries(data).map(([key, value]) => {
    const nodePath = [...path, key];
    if (typeof value === "object" && value !== null) {
      return { key, children: buildTree(value, nodePath) };
    }
    return { key, value };
  });
}

const Tree: React.FC<{ nodes: TreeNode[]; path?: string[]; onSelect?: (path: string[]) => void; }> = ({ nodes, path = [], onSelect }) => (
  <ul style={{ listStyle: "none", paddingLeft: 12 }}>
    {nodes.map((node) => (
      <li key={node.key + (node.value ?? "") + (node.children ? "-parent" : "")}
          style={{ cursor: node.children ? "pointer" : "default", fontFamily: "monospace", color: node.children ? "#90caf9" : "#eee" }}>
        {node.children ? (
          <details>
            <summary>{node.key}</summary>
            <Tree nodes={node.children} path={[...path, node.key]} onSelect={onSelect} />
          </details>
        ) : (
          <span onClick={() => onSelect && onSelect([...path, node.key])}>
            {node.key}: <span style={{ color: "#b2ff59" }}>{String(node.value)}</span>
          </span>
        )}
      </li>
    ))}
  </ul>
);

const SidebarTree: React.FC<SidebarTreeProps> = ({ data, onSelect }) => {
  const nodes = buildTree(data);
  return (
    <div style={{ background: "#181c24", color: "#eee", height: "100%", overflowY: "auto", padding: 8, minWidth: 220, borderRight: "1px solid #222" }}>
      <h4 style={{ margin: 0, marginBottom: 8, color: "#90caf9" }}>JSON Tree</h4>
      <Tree nodes={nodes} onSelect={onSelect} />
    </div>
  );
};

export default SidebarTree;

import type { ParallelNode } from './lab2';

interface VisualNode {
  label: string;
  children: VisualNode[];
}

function createVisualNode(node: ParallelNode, sideLabel?: 'L' | 'R'): VisualNode {
  const content = node.type === 'OPERAND' ? node.value ?? '' : node.operator ?? '';
  const label = sideLabel ? `${sideLabel}: ${content}` : content;

  const children: VisualNode[] = [];
  if (node.left) {
    children.push(createVisualNode(node.left, 'L'));
  }
  if (node.right) {
    children.push(createVisualNode(node.right, 'R'));
  }

  return { label, children };
}

function renderNode(node: VisualNode, prefix = '', isTail = true, isRoot = true): string[] {
  const branch = isRoot ? '' : isTail ? '└── ' : '├── ';
  const line = `${prefix}${branch}${node.label}`;
  const childPrefix = isRoot ? '' : isTail ? '    ' : '│   ';
  const lines = [line];

  node.children.forEach((child, index) => {
    const isLast = index === node.children.length - 1;
    lines.push(...renderNode(child, `${prefix}${childPrefix}`, isLast, false));
  });

  return lines;
}

export function renderParallelTree(root: ParallelNode): string {
  const visualRoot = createVisualNode(root);
  return renderNode(visualRoot).join('\n');
}
interface AdfNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: AdfNode[];
}

const markText = (node: AdfNode) =>
  (node.marks ?? []).reduce((text, mark) => {
    if (mark.type === 'strong') return `**${text}**`;
    if (mark.type === 'em') return `_${text}_`;
    if (mark.type === 'code') return `\`${text}\``;
    if (mark.type === 'strike') return `~~${text}~~`;
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string') return `[${text}](${mark.attrs.href})`;
    return text;
  }, node.text ?? '');

const inline = (nodes: AdfNode[] = []): string =>
  nodes
    .map((node) => {
      if (node.type === 'text') return markText(node);
      if (node.type === 'hardBreak') return '\n';
      if (node.type === 'mention' || node.type === 'emoji') return String(node.attrs?.text ?? '');
      if (node.type === 'inlineCard') return String(node.attrs?.url ?? '');
      return inline(node.content);
    })
    .join('');

const block = (node: AdfNode, indent = ''): string => {
  switch (node.type) {
    case 'paragraph':
      return `${indent}${inline(node.content)}`;
    case 'heading':
      return `${'#'.repeat(Number(node.attrs?.level ?? 1))} ${inline(node.content)}`;
    case 'bulletList':
    case 'orderedList':
      return (node.content ?? [])
        .map((item, index) => {
          const marker = node.type === 'bulletList' ? '-' : `${index + 1}.`;
          const [first, ...rest] = item.content ?? [];
          return [
            `${indent}${marker} ${first ? inline(first.content) : ''}`,
            ...rest.map((child) => block(child, `${indent}  `)),
          ].join('\n');
        })
        .join('\n');
    case 'codeBlock':
      return `\`\`\`${String(node.attrs?.language ?? '')}\n${inline(node.content)}\n\`\`\``;
    case 'blockquote':
      return (node.content ?? []).map((child) => `> ${block(child)}`).join('\n');
    case 'rule':
      return '---';
    case 'table':
      return (node.content ?? [])
        .map(
          (row) =>
            `| ${(row.content ?? []).map((cell) => (cell.content ?? []).map((child) => block(child)).join(' ')).join(' | ')} |`,
        )
        .join('\n');
    default:
      return node.content ? node.content.map((child) => block(child, indent)).join('\n\n') : inline([node]);
  }
};

export const adfToMarkdown = (doc: unknown): string => {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  return ((doc as AdfNode).content ?? [])
    .map((node) => block(node))
    .join('\n\n')
    .trim();
};

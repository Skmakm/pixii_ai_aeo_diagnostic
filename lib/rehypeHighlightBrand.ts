import { visit, SKIP } from 'unist-util-visit';
import type { Root, Element, Text, ElementContent } from 'hast';

type Options = { brand: string };

export default function rehypeHighlightBrand(options: Options) {
  return (tree: Root) => {
    const brand = options?.brand?.trim();
    if (!brand) return;
    const lowerBrand = brand.toLowerCase();
    const brandLen = brand.length;

    visit(tree, 'text', (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      if (parent.type === 'element' && ((parent as Element).tagName === 'code' || (parent as Element).tagName === 'pre')) return;

      const value = node.value;
      const lowerValue = value.toLowerCase();

      const newChildren: ElementContent[] = [];
      let cursor = 0;
      let pos = lowerValue.indexOf(lowerBrand, cursor);
      while (pos !== -1) {
        if (pos > cursor) newChildren.push({ type: 'text', value: value.slice(cursor, pos) });
        newChildren.push({
          type: 'element',
          tagName: 'mark',
          properties: {},
          children: [{ type: 'text', value: value.slice(pos, pos + brandLen) }],
        });
        cursor = pos + brandLen;
        pos = lowerValue.indexOf(lowerBrand, cursor);
      }
      if (newChildren.length === 0) return;
      if (cursor < value.length) newChildren.push({ type: 'text', value: value.slice(cursor) });

      parent.children.splice(index, 1, ...newChildren);
      return [SKIP, index + newChildren.length];
    });
  };
}

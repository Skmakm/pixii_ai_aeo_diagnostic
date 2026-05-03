import { describe, it, expect } from 'vitest';
import rehypeHighlightBrand from '../rehypeHighlightBrand';

import type { Root, RootContent } from 'hast';

function makeTree(children: RootContent[]): Root {
  return { type: 'root', children };
}

function makePara(text: string) {
  return makeTree([
    { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: text }] },
  ]);
}

describe('rehypeHighlightBrand', () => {
  it('wraps brand in mark element', () => {
    const tree = makePara('I love Sleepwell, it works.');
    rehypeHighlightBrand({ brand: 'Sleepwell' })(tree);
    const para = tree.children[0];
    expect(para.children).toHaveLength(3);
    expect(para.children[0]).toEqual({ type: 'text', value: 'I love ' });
    expect(para.children[1]).toMatchObject({ type: 'element', tagName: 'mark' });
    expect(para.children[1].children[0].value).toBe('Sleepwell');
    expect(para.children[2]).toEqual({ type: 'text', value: ', it works.' });
  });

  it('matches case-insensitively and preserves original casing inside mark', () => {
    const tree = makePara('i love SLEEPWELL today');
    rehypeHighlightBrand({ brand: 'sleepwell' })(tree);
    const para = tree.children[0];
    const mark = para.children.find((c: { type: string; tagName?: string; children?: { value?: string }[] }) => c.type === 'element' && c.tagName === 'mark');
    expect(mark).toBeDefined();
    expect(mark.children[0].value).toBe('SLEEPWELL');
  });

  it('wraps multiple occurrences in separate mark elements', () => {
    const tree = makePara('Sleepwell is great, sleepwell forever');
    rehypeHighlightBrand({ brand: 'sleepwell' })(tree);
    const para = tree.children[0];
    const marks = para.children.filter((c: { type: string; tagName?: string; children?: { value?: string }[] }) => c.type === 'element' && c.tagName === 'mark');
    expect(marks).toHaveLength(2);
    expect(marks[0].children[0].value).toBe('Sleepwell');
    expect(marks[1].children[0].value).toBe('sleepwell');
  });

  it('does not wrap text inside <code>', () => {
    const tree = makeTree([
      {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: [{ type: 'text', value: 'const sleepwell = true;' }],
      },
    ]);
    rehypeHighlightBrand({ brand: 'sleepwell' })(tree);
    const code = tree.children[0];
    expect(code.children).toHaveLength(1);
    expect(code.children[0].type).toBe('text');
  });

  it('does not wrap text inside <pre>', () => {
    const tree = makeTree([
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [{ type: 'text', value: 'sleepwell code block' }],
      },
    ]);
    rehypeHighlightBrand({ brand: 'sleepwell' })(tree);
    const pre = tree.children[0];
    expect(pre.children).toHaveLength(1);
    expect(pre.children[0].type).toBe('text');
  });

  it('leaves tree unchanged when brand is empty string', () => {
    const tree = makePara('sleepwell text');
    const original = JSON.stringify(tree);
    rehypeHighlightBrand({ brand: '' })(tree);
    expect(JSON.stringify(tree)).toBe(original);
  });

  it('leaves tree unchanged when brand is whitespace only', () => {
    const tree = makePara('sleepwell text');
    const original = JSON.stringify(tree);
    rehypeHighlightBrand({ brand: '   ' })(tree);
    expect(JSON.stringify(tree)).toBe(original);
  });

  it('does not crash and finds literal match when brand contains regex metachars', () => {
    const tree = makePara('price A.B+C* end');
    rehypeHighlightBrand({ brand: 'A.B+C*' })(tree);
    const para = tree.children[0];
    const mark = para.children.find((c: { type: string; tagName?: string; children?: { value?: string }[] }) => c.type === 'element' && c.tagName === 'mark');
    expect(mark).toBeDefined();
    expect(mark.children[0].value).toBe('A.B+C*');
  });

  it('leaves tree unchanged when brand is absent from text', () => {
    const tree = makePara('nothing matches here');
    const original = JSON.stringify(tree);
    rehypeHighlightBrand({ brand: 'sleepwell' })(tree);
    expect(JSON.stringify(tree)).toBe(original);
  });
});

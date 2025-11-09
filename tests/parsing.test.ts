import { describe, expect, it } from 'vitest';
import { parsePlainText, sentencesFromParagraph } from '@/lib/parsing';

describe('parsing utilities', () => {
  it('splits text into paragraphs and sentences with mapping', () => {
    const text = '第一句。第二句?\n\n第三句，继续。';
    const parsed = parsePlainText(text);
    expect(parsed.paragraphs.length).toBe(2);
    expect(parsed.sentences.length).toBeGreaterThanOrEqual(3);
    expect(parsed.mapping[0]).toMatchObject({ paragraphIndex: 0, sentenceIndex: 0 });
    expect(parsed.mapping.at(-1)).toMatchObject({ paragraphIndex: 1 });
  });

  it('splits sentences with punctuation aware logic', () => {
    const sentences = sentencesFromParagraph('Alpha beta. Gamma? Delta!');
    expect(sentences).toEqual(['Alpha beta.', 'Gamma?', 'Delta!']);
  });
});

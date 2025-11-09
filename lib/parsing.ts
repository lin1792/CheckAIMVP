import { Buffer } from 'node:buffer';
import mammoth from 'mammoth';
import { split as splitSentences } from 'sentence-splitter';
import { ParsedDocumentSchema, type ParsedDocument } from './schemas';

function sanitizeParagraphs(paragraphs: string[]): string[] {
  return paragraphs
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}

export function sentencesFromParagraph(text: string): string[] {
  return splitSentences(text)
    .filter((node) => node.type === 'Sentence')
    .map((node) => node.raw.trim())
    .filter((s) => s.length > 0);
}

export function assembleParsedDocument(paragraphs: string[]): ParsedDocument {
  const cleanParagraphs = sanitizeParagraphs(paragraphs);
  const sentences: string[] = [];
  const mapping: ParsedDocument['mapping'] = [];

  cleanParagraphs.forEach((paragraph, paragraphIndex) => {
    const parts = sentencesFromParagraph(paragraph);
    parts.forEach((sentence, sentenceIndex) => {
      mapping.push({ paragraphIndex, sentenceIndex });
      sentences.push(sentence);
    });
  });

  return ParsedDocumentSchema.parse({
    paragraphs: cleanParagraphs,
    sentences,
    mapping
  });
}

export async function parseDocxBuffer(arrayBuffer: ArrayBuffer): Promise<ParsedDocument> {
  const buffer = Buffer.from(arrayBuffer);
  const { value } = await mammoth.extractRawText({ buffer });
  const paragraphs = value.split(/\n+/);
  return assembleParsedDocument(paragraphs);
}

export function parsePlainText(text: string): ParsedDocument {
  const paragraphs = text.split(/\n{2,}/);
  return assembleParsedDocument(paragraphs);
}

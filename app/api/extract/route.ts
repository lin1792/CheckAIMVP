import { NextRequest, NextResponse } from 'next/server';
import { parseDocxBuffer, parsePlainText } from '@/lib/parsing';
import { ExtractResponseSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let parsed;
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      const text = formData.get('text');
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        parsed = await parseDocxBuffer(arrayBuffer);
      } else if (typeof text === 'string') {
        parsed = parsePlainText(text);
      }
    } else {
      const body = await req.json().catch(() => null);
      if (body?.text) {
        parsed = parsePlainText(body.text);
      }
    }

    if (!parsed) {
      return NextResponse.json({ error: '文件或文本不能为空' }, { status: 400 });
    }

    const safe = ExtractResponseSchema.parse(parsed);
    return NextResponse.json(safe);
  } catch (error) {
    console.error('extract failed', error);
    return NextResponse.json({ error: '解析失败，请稍后重试' }, { status: 500 });
  }
}

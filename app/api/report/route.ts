import { NextRequest, NextResponse } from 'next/server';
import { buildHtmlReport } from '@/lib/report';
import { ReportRequestSchema, ReportResponseSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const payload = ReportRequestSchema.parse(json);
    const html = buildHtmlReport(
      payload.claims,
      payload.verifications,
      payload.evidenceMap ?? {},
      payload.generatedAt
    );
    const response = ReportResponseSchema.parse({ html });
    return NextResponse.json(response);
  } catch (error) {
    console.error('report failed', error);
    return NextResponse.json({ error: '报告生成失败' }, { status: 500 });
  }
}

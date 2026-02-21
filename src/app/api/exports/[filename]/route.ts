// API Route: GET /api/exports/[filename] — Serve a specific .md file content
// API Route: DELETE /api/exports/[filename] — Delete a specific .md file

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const OUTPUTS_DIR = path.join(process.cwd(), 'outputs');

export async function GET(
  _request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    if (!filename || filename.includes('..')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(OUTPUTS_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: '檔案不存在或無法讀取' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    if (!filename || filename.includes('..')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(OUTPUTS_DIR, filename);
    await fs.unlink(filePath);

    return NextResponse.json({ success: true, deleted: filename });
  } catch {
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}

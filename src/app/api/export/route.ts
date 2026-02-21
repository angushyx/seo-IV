// API Route: POST /api/export — Save analysis result as .md to outputs/
// API Route: GET /api/export — List saved .md files

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const OUTPUTS_DIR = path.join(process.cwd(), 'outputs');

// Ensure outputs directory exists
async function ensureOutputsDir() {
  await fs.mkdir(OUTPUTS_DIR, { recursive: true });
}

// ============================================================
// POST /api/export — Save markdown to disk
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { markdown, keyword, filename } = body;

    if (!markdown || typeof markdown !== 'string') {
      return NextResponse.json({ error: 'markdown content required' }, { status: 400 });
    }

    await ensureOutputsDir();

    // Generate filename: YYYY-MM-DD_keyword.md
    const date = new Date().toISOString().split('T')[0];
    const safeKeyword = (keyword || 'report')
      .replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')
      .slice(0, 30);
    const finalName = filename || `${date}_${safeKeyword}.md`;
    const filePath = path.join(OUTPUTS_DIR, finalName);

    await fs.writeFile(filePath, markdown, 'utf-8');

    return NextResponse.json({
      success: true,
      filename: finalName,
      path: filePath,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: `儲存失敗：${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /api/export — List all saved reports
// ============================================================
export async function GET() {
  try {
    await ensureOutputsDir();
    const files = await fs.readdir(OUTPUTS_DIR);
    const mdFiles = files.filter((f) => f.endsWith('.md'));

    const reports = await Promise.all(
      mdFiles.map(async (f) => {
        const filePath = path.join(OUTPUTS_DIR, f);
        const stat = await fs.stat(filePath);
        // Read first line as title
        const content = await fs.readFile(filePath, 'utf-8');
        const firstLine = content.split('\n')[0]?.replace(/^#+\s*/, '') || f;
        return {
          filename: f,
          title: firstLine,
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
          modifiedAt: stat.mtime.toISOString(),
        };
      })
    );

    // Sort newest first
    reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { error: `讀取失敗：${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}

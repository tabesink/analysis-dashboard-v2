import { NextResponse } from 'next/server';
import { getChangelogMarkdown } from '@/lib/changelog';

export async function GET() {
  const { markdown, sourcePath } = await getChangelogMarkdown();

  if (!markdown) {
    return NextResponse.json(
      {
        markdown: null,
        sourcePath,
        error: 'Changelog file not found',
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ markdown, sourcePath });
}

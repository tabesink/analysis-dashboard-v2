import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Candidate paths for Dashboard/CHANGELOG.md (dev vs Docker standalone). */
const CHANGELOG_PATHS = [
  // Production Docker: WORKDIR /app, file copied next to server.js
  resolve(process.cwd(), 'CHANGELOG.md'),
  // Local dev / npm run dev: cwd is Dashboard/client
  resolve(process.cwd(), '..', 'CHANGELOG.md'),
];

export type ChangelogResult = {
  markdown: string | null;
  sourcePath?: string;
};

export async function getChangelogMarkdown(): Promise<ChangelogResult> {
  let lastAttemptedPath: string | undefined;

  for (const path of CHANGELOG_PATHS) {
    try {
      const markdown = await readFile(path, 'utf8');
      return { markdown, sourcePath: path };
    } catch {
      lastAttemptedPath = path;
    }
  }

  return { markdown: null, sourcePath: lastAttemptedPath };
}

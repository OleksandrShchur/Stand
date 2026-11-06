import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const escapeXml = value => String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);

export function lineCoverage(covered, total) {
    if (!Number.isInteger(covered) || !Number.isInteger(total) || total <= 0 || covered < 0 || covered > total)
        throw new Error('Coverage must contain valid covered and total line counts.');
    return { covered, total, percent: covered / total * 100 };
}

export function coverageBadge(label, coverage) {
    const percent = lineCoverage(coverage.covered, coverage.total).percent;
    const value = `${percent.toFixed(2)}%`;
    const color = percent >= 90 ? '#4c1' : percent >= 80 ? '#97ca00' : '#e05d44';
    const leftWidth = label.length * 7 + 12;
    const rightWidth = value.length * 7 + 12;
    const width = leftWidth + rightWidth;
    const title = escapeXml(`${label}: ${value}`);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${title}">
  <title>${title}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)"><path fill="#555" d="M0 0h${leftWidth}v20H0z"/><path fill="${color}" d="M${leftWidth} 0h${rightWidth}v20H${leftWidth}z"/><path fill="url(#s)" d="M0 0h${width}v20H0z"/></g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text><text x="${leftWidth / 2}" y="14">${escapeXml(label)}</text>
    <text x="${leftWidth + rightWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${value}</text><text x="${leftWidth + rightWidth / 2}" y="14">${value}</text>
  </g>
</svg>\n`;
}

export function writeCoverageBadges(root, destination, metadata = {}) {
    const runDirectory = readFileSync(join(root, 'artifacts', 'tests', 'latest.txt'), 'utf8').trim();
    const server = JSON.parse(readFileSync(join(runDirectory, 'summary.json'), 'utf8'));
    const client = JSON.parse(readFileSync(join(root, 'stand.client', 'coverage', 'coverage-summary.json'), 'utf8')).total;
    const coverage = {
        server: { ...lineCoverage(server.lines.covered, server.lines.total), scope: 'Entire Stand.Server assembly' },
        frontend: { ...lineCoverage(client.lines.covered, client.lines.total), scope: 'Frontend non-UI TypeScript logic; excludes TSX pages/components' },
    };
    // Read and validate both reports before writing any badges.
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, 'server-coverage.svg'), coverageBadge('server coverage', coverage.server));
    writeFileSync(join(destination, 'frontend-logic-coverage.svg'), coverageBadge('frontend logic coverage', coverage.frontend));
    writeFileSync(join(destination, 'coverage.json'), JSON.stringify({ ...metadata, coverage }, null, 2) + '\n');
    return coverage;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const { GITHUB_SHA, GITHUB_RUN_NUMBER, GITHUB_RUN_ID, GITHUB_REPOSITORY, GITHUB_SERVER_URL } = process.env;
    writeCoverageBadges(root, join(root, 'artifacts', 'badges'), {
        sourceSha: GITHUB_SHA ?? null,
        runNumber: Number(GITHUB_RUN_NUMBER ?? 0),
        runUrl: GITHUB_RUN_ID ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : null,
    });
    console.log('Coverage badges generated in artifacts/badges.');
}

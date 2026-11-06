import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';

// Merge exact source lines and branch paths, rather than averaging suite percentages.
export function mergeCoverlet(reports) {
    const files = new Map();
    for (const report of reports) {
        for (const [module, documents] of Object.entries(report)) {
            for (const [filename, classes] of Object.entries(documents)) {
                let file = files.get(filename);
                if (!file) files.set(filename, file = { lines: new Map(), branches: new Map() });
                for (const [type, methods] of Object.entries(classes)) {
                    for (const [method, data] of Object.entries(methods)) {
                        for (const [line, hits] of Object.entries(data.Lines))
                            file.lines.set(Number(line), Math.max(file.lines.get(Number(line)) ?? 0, hits));
                        for (const branch of data.Branches) {
                            const key = JSON.stringify([module, type, method, branch.Offset, branch.EndOffset, branch.Path, branch.Ordinal]);
                            const existing = file.branches.get(key);
                            file.branches.set(key, { line: branch.Line, hits: Math.max(existing?.hits ?? 0, branch.Hits) });
                        }
                    }
                }
            }
        }
    }
    return files;
}

function metric(hits) {
    const covered = hits.filter(value => value > 0).length;
    return { covered, total: hits.length, percent: hits.length ? covered / hits.length * 100 : 0 };
}

export function summarize(files) {
    return {
        lines: metric([...files.values()].flatMap(f => [...f.lines.values()])),
        branches: metric([...files.values()].flatMap(f => [...f.branches.values()].map(b => b.hits))),
    };
}

export function assertCoverage(summary, threshold = 80) {
    for (const [name, value] of Object.entries(summary)) {
        if (value.total === 0 || value.percent < threshold)
            throw new Error(`Server ${name} coverage ${value.percent.toFixed(2)}% is below ${threshold}% (${value.covered}/${value.total}).`);
    }
}

const xml = text => String(text).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

export function writeCoverageReports(reportPaths, destination, root) {
    const files = mergeCoverlet(reportPaths.map(p => JSON.parse(readFileSync(p, 'utf8'))));
    const summary = summarize(files);
    const perFile = Object.fromEntries([...files].map(([filename, coverage]) => [relative(root, filename).replaceAll('\\', '/'), summarize(new Map([[filename, coverage]]))]));
    writeFileSync(`${destination}/summary.json`, JSON.stringify({ ...summary, files: perFile }, null, 2) + '\n');
    const classes = [...files].map(([filename, file]) => {
        const rates = summarize(new Map([[filename, file]]));
        const rows = [...file.lines].sort(([a], [b]) => a - b).map(([line, hits]) => {
            const branches = [...file.branches.values()].filter(b => b.line === line);
            const covered = branches.filter(b => b.hits > 0).length;
            const attributes = branches.length ? ` branch="true" condition-coverage="${covered / branches.length * 100}% (${covered}/${branches.length})"` : ' branch="false"';
            return `<line number="${line}" hits="${hits}"${attributes}/>`;
        }).join('');
        const name = xml(relative(root, filename).replaceAll('\\', '/'));
        return `<class name="${name}" filename="${name}" line-rate="${rates.lines.percent / 100}" branch-rate="${rates.branches.percent / 100}" complexity="0"><methods/><lines>${rows}</lines></class>`;
    }).join('');
    writeFileSync(`${destination}/coverage.cobertura.xml`, `<?xml version="1.0" encoding="utf-8"?><coverage line-rate="${summary.lines.percent / 100}" branch-rate="${summary.branches.percent / 100}" lines-covered="${summary.lines.covered}" lines-valid="${summary.lines.total}" branches-covered="${summary.branches.covered}" branches-valid="${summary.branches.total}" complexity="0" version="1.0" timestamp="${Math.floor(Date.now() / 1000)}"><sources><source>${xml(root)}</source></sources><packages><package name="Stand.Server" line-rate="${summary.lines.percent / 100}" branch-rate="${summary.branches.percent / 100}" complexity="0"><classes>${classes}</classes></package></packages></coverage>`);
    return summary;
}

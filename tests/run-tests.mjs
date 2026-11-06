import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCoverage, writeCoverageReports } from './coverage.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const client = join(root, 'stand.client');
const args = process.argv.slice(2);
if (args.some(arg => !['--server', '--frontend'].includes(arg)) || args.length > 1)
    throw new Error('Usage: node tests/run-tests.mjs [--server | --frontend]');
const output = join(root, 'artifacts', 'tests', new Date().toISOString().replaceAll(/[:.]/g, '-'));
mkdirSync(output, { recursive: true });
console.log(`Test artifacts: ${output}`);

function run(command, argv, cwd = root) {
    const result = spawnSync(command, argv, { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} ${argv.join(' ')} failed (${result.status ?? result.signal}).`);
}

function npm(script) {
    if (process.platform === 'win32') run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm run ${script}`], client);
    else run('npm', ['run', script], client);
}

function findReports(directory) {
    // TRX also copies attachments into its In directory. Only read the collector's
    // direct output so stale or duplicate attachments cannot count as another suite.
    return readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => join(directory, entry.name, 'coverage.json'))
        .filter(path => existsSync(path));
}

try {
    run(process.execPath, ['--test', 'tests/coverage.test.mjs']);
    if (!args.includes('--frontend')) {
        for (const [suite, project] of [['unit', 'Stand.UnitTests'], ['integration', 'Stand.Integration']]) {
            run('dotnet', ['test', `tests/${project}`, '--collect:XPlat Code Coverage', '--settings', 'tests/coverage.runsettings',
                '--results-directory', join(output, suite), '--logger', 'trx', '-p:ShouldRunNpmInstall=false']);
        }
        const reports = ['unit', 'integration'].flatMap(suite => {
            const paths = findReports(join(output, suite));
            if (paths.length !== 1) throw new Error(`Expected one ${suite} coverage report, received ${paths.length}.`);
            return paths;
        });
        const summary = writeCoverageReports(reports, output, root);
        for (const [name, metric] of Object.entries(summary))
            console.log(`Server ${name}: ${metric.percent.toFixed(2)}% (${metric.covered}/${metric.total})`);
        assertCoverage(summary);
    }
    if (!args.includes('--server')) {
        npm('test:types');
        npm('test:coverage');
    }
    console.log('All requested tests and 80% coverage gates passed.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    writeFileSync(join(root, 'artifacts', 'tests', 'latest.txt'), output + '\n');
}

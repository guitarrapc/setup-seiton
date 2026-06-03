const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const {
    mapPlatform,
    mapArch,
    resolveVersionTag,
    parseExpectedSha,
    sha256File,
    runSetupSeiton
} = require('../lib/setup-seiton');

test('mapPlatform maps supported values', () => {
    assert.equal(mapPlatform('linux'), 'linux');
    assert.equal(mapPlatform('darwin'), 'osx');
    assert.equal(mapPlatform('win32'), 'win');
});

test('mapPlatform rejects unsupported values', () => {
    assert.throws(() => mapPlatform('aix'), /Unsupported platform/);
});

test('mapArch maps supported values', () => {
    assert.equal(mapArch('x64'), 'amd64');
    assert.equal(mapArch('arm64'), 'arm64');
});

test('mapArch rejects unsupported values', () => {
    assert.throws(() => mapArch('x86'), /Unsupported architecture/);
});

test('resolveVersionTag normalizes versions', () => {
    assert.equal(resolveVersionTag('latest'), 'latest');
    assert.equal(resolveVersionTag('0.9.19'), 'v0.9.19');
    assert.equal(resolveVersionTag('v0.9.19'), 'v0.9.19');
});

test('parseExpectedSha parses checksum line with and without asterisk', () => {
    const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const content = [
        `${hash}  seiton-linux-amd64.tar.gz`,
        `${hash} *seiton-win-amd64.zip`
    ].join('\n');

    assert.equal(parseExpectedSha(content, 'seiton-linux-amd64.tar.gz'), hash);
    assert.equal(parseExpectedSha(content, 'seiton-win-amd64.zip'), hash);
});

test('parseExpectedSha rejects missing file', () => {
    const hash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const content = `${hash}  seiton-linux-amd64.tar.gz`;
    assert.throws(() => parseExpectedSha(content, 'seiton-osx-arm64.tar.gz'), /Checksum for/);
});

test('sha256File returns lower-case hash', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'setup-seiton-test-'));
    const filePath = path.join(tempDir, 'data.txt');
    await fs.writeFile(filePath, 'hello');

    const expected = crypto.createHash('sha256').update('hello').digest('hex').toLowerCase();
    const actual = await sha256File(filePath);
    assert.equal(actual, expected);
});

test('runSetupSeiton installs expected artifact on linux flow', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'setup-seiton-run-'));
    const archivePath = path.join(tempDir, 'archive.tar.gz');
    const checksumsPath = path.join(tempDir, 'checksums-sha256.txt');
    const extractedDir = path.join(tempDir, 'extract');

    await fs.writeFile(archivePath, 'fake archive body');
    const archiveHash = crypto.createHash('sha256').update('fake archive body').digest('hex').toLowerCase();
    await fs.writeFile(checksumsPath, `${archiveHash}  seiton-linux-amd64.tar.gz\n`);

    const coreCalls = {
        info: [],
        outputs: {},
        paths: []
    };

    const core = {
        getInput(name) {
            if (name === 'seiton_version') return '0.9.19';
            if (name === 'github_token') return '';
            return '';
        },
        info(message) {
            coreCalls.info.push(message);
        },
        addPath(p) {
            coreCalls.paths.push(p);
        },
        setOutput(name, value) {
            coreCalls.outputs[name] = value;
        }
    };

    let downloadCount = 0;
    const tc = {
        async downloadTool() {
            downloadCount += 1;
            return downloadCount === 1 ? archivePath : checksumsPath;
        },
        async extractTar() {
            return extractedDir;
        },
        async extractZip() {
            throw new Error('extractZip should not be called in linux flow');
        }
    };

    const chmodCalls = [];

    const result = await runSetupSeiton({
        core,
        tc,
        getReleaseFn: async () => ({
            tag_name: 'v0.9.19',
            assets: [
                {
                    name: 'seiton-linux-amd64.tar.gz',
                    browser_download_url: 'https://example.invalid/seiton-linux-amd64.tar.gz'
                },
                {
                    name: 'checksums-sha256.txt',
                    browser_download_url: 'https://example.invalid/checksums-sha256.txt'
                }
            ]
        }),
        owner: 'fake-owner',
        repo: 'fake-repo',
        platform: 'linux',
        arch: 'x64',
        chmodFn(filePath, mode) {
            chmodCalls.push({ filePath, mode });
            return Promise.resolve();
        },
        fileExists(filePath) {
            return filePath === path.join(extractedDir, 'seiton');
        }
    });

    assert.equal(result.releaseTag, 'v0.9.19');
    assert.equal(result.version, '0.9.19');
    assert.equal(coreCalls.outputs.seiton_version, '0.9.19');
    assert.equal(coreCalls.outputs.seiton_path, extractedDir);
    assert.deepEqual(coreCalls.paths, [extractedDir]);
    assert.deepEqual(chmodCalls, [{ filePath: path.join(extractedDir, 'seiton'), mode: 0o755 }]);
    assert.ok(coreCalls.info.includes('Checksum verified'));
    assert.ok(coreCalls.info.includes('Installed seiton v0.9.19'));
});

test('runSetupSeiton fails when checksum mismatches', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'setup-seiton-badhash-'));
    const archivePath = path.join(tempDir, 'archive.tar.gz');
    const checksumsPath = path.join(tempDir, 'checksums-sha256.txt');

    await fs.writeFile(archivePath, 'fake archive body');
    const wrongHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    await fs.writeFile(checksumsPath, `${wrongHash}  seiton-linux-amd64.tar.gz\n`);

    const core = {
        getInput(name) {
            if (name === 'seiton_version') return '0.9.19';
            if (name === 'github_token') return '';
            return '';
        },
        info() { },
        addPath() { },
        setOutput() { }
    };

    let downloadCount = 0;
    const tc = {
        async downloadTool() {
            downloadCount += 1;
            return downloadCount === 1 ? archivePath : checksumsPath;
        },
        async extractTar() {
            throw new Error('extractTar should not be called when checksum mismatches');
        },
        async extractZip() {
            throw new Error('extractZip should not be called');
        }
    };

    await assert.rejects(
        runSetupSeiton({
            core,
            tc,
            getReleaseFn: async () => ({
                tag_name: 'v0.9.19',
                assets: [
                    {
                        name: 'seiton-linux-amd64.tar.gz',
                        browser_download_url: 'https://example.invalid/seiton-linux-amd64.tar.gz'
                    },
                    {
                        name: 'checksums-sha256.txt',
                        browser_download_url: 'https://example.invalid/checksums-sha256.txt'
                    }
                ]
            }),
            owner: 'fake-owner',
            repo: 'fake-repo',
            platform: 'linux',
            arch: 'x64',
            fileExists() {
                return true;
            }
        }),
        /Checksum mismatch/
    );
});

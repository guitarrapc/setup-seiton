const fs = require('node:fs');
const fsp = require('node:fs/promises');
const https = require('node:https');
const path = require('node:path');
const crypto = require('node:crypto');

const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const io = require('@actions/io');

const OWNER = 'guitarrapc';
const REPO = 'seiton';

function mapPlatform(platform) {
    switch (platform) {
        case 'linux':
            return 'linux';
        case 'darwin':
            return 'osx';
        case 'win32':
            return 'win';
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

function mapArch(arch) {
    switch (arch) {
        case 'x64':
            return 'amd64';
        case 'arm64':
            return 'arm64';
        default:
            throw new Error(`Unsupported architecture: ${arch}`);
    }
}

function resolveVersionTag(inputVersion) {
    if (!inputVersion || inputVersion === 'latest') {
        return 'latest';
    }

    return inputVersion.startsWith('v') ? inputVersion : `v${inputVersion}`;
}

function requestJson(url, token) {
    return new Promise((resolve, reject) => {
        const req = https.get(
            url,
            {
                headers: {
                    Accept: 'application/vnd.github+json',
                    'User-Agent': `${OWNER}-${REPO}-setup-action`,
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                }
            },
            (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (error) {
                            reject(new Error(`Failed to parse JSON from ${url}: ${error.message}`));
                        }
                        return;
                    }

                    reject(new Error(`GitHub API request failed (${res.statusCode}): ${data}`));
                });
            }
        );

        req.on('error', (error) => {
            reject(new Error(`GitHub API request failed: ${error.message}`));
        });
    });
}

async function getRelease(versionTag, token) {
    if (versionTag === 'latest') {
        return requestJson(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, token);
    }

    return requestJson(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${encodeURIComponent(versionTag)}`,
        token
    );
}

function findAsset(release, name) {
    const asset = (release.assets || []).find((x) => x.name === name);
    if (!asset) {
        throw new Error(`Asset ${name} was not found in release ${release.tag_name}.`);
    }
    return asset;
}

async function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
        stream.on('error', (error) => reject(error));
    });
}

function parseExpectedSha(checksumContent, fileName) {
    const lines = checksumContent.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;

        const hash = parts[0].toLowerCase();
        const name = parts[parts.length - 1].replace(/^\*+/, '');
        if (name === fileName) {
            if (!/^[a-f0-9]{64}$/.test(hash)) {
                throw new Error(`Invalid checksum format for ${fileName}.`);
            }
            return hash;
        }
    }

    throw new Error(`Checksum for ${fileName} was not found in checksums-sha256.txt.`);
}

async function downloadAsset(asset, token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return tc.downloadTool(asset.browser_download_url, undefined, undefined, headers);
}

async function extractArchive(archivePath, archiveName) {
    if (archiveName.endsWith('.zip')) {
        return tc.extractZip(archivePath);
    }
    if (archiveName.endsWith('.tar.gz')) {
        return tc.extractTar(archivePath);
    }
    throw new Error(`Unsupported archive format: ${archiveName}`);
}

async function run() {
    const requestedVersion = core.getInput('seiton_version') || 'latest';
    const token = core.getInput('github_token');
    const platform = mapPlatform(process.platform);
    const arch = mapArch(process.arch);
    const extension = process.platform === 'win32' ? 'zip' : 'tar.gz';
    const archiveName = `seiton-${platform}-${arch}.${extension}`;

    core.info(`Resolving release: ${requestedVersion}`);
    const release = await getRelease(resolveVersionTag(requestedVersion), token);

    const archiveAsset = findAsset(release, archiveName);
    const checksumAsset = findAsset(release, 'checksums-sha256.txt');

    core.info(`Downloading ${archiveAsset.name}`);
    const archivePath = await downloadAsset(archiveAsset, token);
    const checksumsPath = await downloadAsset(checksumAsset, token);

    const checksumsText = await fsp.readFile(checksumsPath, 'utf8');
    const expectedSha = parseExpectedSha(checksumsText, archiveAsset.name);
    const actualSha = await sha256File(archivePath);
    if (expectedSha !== actualSha) {
        throw new Error(
            `Checksum mismatch for ${archiveAsset.name}. expected=${expectedSha} actual=${actualSha}`
        );
    }

    core.info('Checksum verified');

    core.info('Extracting archive');
    const extractedDir = await extractArchive(archivePath, archiveAsset.name);

    const binaryName = process.platform === 'win32' ? 'seiton.exe' : 'seiton';
    const binaryPath = path.join(extractedDir, binaryName);
    if (!fs.existsSync(binaryPath)) {
        throw new Error(`Extracted binary ${binaryName} not found at ${binaryPath}.`);
    }

    if (process.platform !== 'win32') {
        await io.chmod(binaryPath, '755');
    }

    core.addPath(extractedDir);
    core.setOutput('seiton_version', release.tag_name.startsWith('v') ? release.tag_name.slice(1) : release.tag_name);
    core.setOutput('seiton_path', extractedDir);

    core.info(`Installed seiton ${release.tag_name}`);
}

run().catch((error) => {
    core.setFailed(`Setup seiton failed: ${error.message}`);
});

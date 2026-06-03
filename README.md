# setup-seiton

GitHub Actions JavaScript action to install the [seiton](https://github.com/guitarrapc/seiton) CLI and add it to PATH.

This action follows the same setup-action style as setup-terraform: resolve a release version, download the matching OS/architecture archive, extract it, and expose the binary for subsequent steps.

## Development

Run build:

```bash
npm run build
```

Run unit tests:

```bash
npm test
```

## Usage

Install latest seiton:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: guitarrapc/setup-seiton@v1
  - run: seiton --version
```

Install a specific version:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: guitarrapc/setup-seiton@v1
    with:
      seiton_version: 0.9.19
  - run: seiton .github/workflows/*.yml
```

Use GitHub token to reduce release API rate-limit risk:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: guitarrapc/setup-seiton@v1
    with:
      github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

- `seiton_version` (optional): Version to install. `latest` by default. You can pass `0.9.19` or `v0.9.19`.
- `github_token` (optional): Token used for GitHub Releases API requests.

## Outputs

- `seiton_version`: Installed version string without `v` prefix.
- `seiton_path`: Directory added to `PATH` that contains the seiton binary.

## Supported runners

- `ubuntu-latest` (`linux-amd64`, `linux-arm64`)
- `windows-latest` (`win-amd64`, `win-arm64`)
- `macos-latest` (`osx-amd64`, `osx-arm64`)

## License

MIT. See [LICENSE.md](LICENSE.md).

[![build](https://github.com/guitarrapc/setup-seiton/actions/workflows/build.yaml/badge.svg)](https://github.com/guitarrapc/setup-seiton/actions/workflows/build.yaml) [![setup seiton](https://github.com/guitarrapc/setup-seiton/actions/workflows/setup-seiton.yaml/badge.svg)](https://github.com/guitarrapc/setup-seiton/actions/workflows/setup-seiton.yaml) [![release](https://github.com/guitarrapc/setup-seiton/actions/workflows/release.yaml/badge.svg)](https://github.com/guitarrapc/setup-seiton/actions/workflows/release.yaml)

# setup-seiton

GitHub Actions to install the [seiton](https://github.com/guitarrapc/seiton) CLI, a security focused static analysis linter & fixer for GitHub Actions.

## Usage

Install latest seiton.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: guitarrapc/setup-seiton@v1.0.2
  - run: seiton --version
  - run: seiton
```

Install a specific version.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: guitarrapc/setup-seiton@v1.0.2
    with:
      seiton-version: 0.9.19
```

## Inputs

| Name | Description | Default |
| --- | --- | --- |
| `seiton-version` | Version to install. `latest` by default. You can pass `0.9.19` or `v0.9.19`. | `latest` |
| `github-token` | Token used for GitHub Releases API requests. Falls back to `GITHUB_TOKEN` env var when omitted. | `${{ github.token }}` |

## Outputs

| Name | Description |
| --- | --- |
| `seiton-version` | Installed version string without `v` prefix. |
| `seiton-path` | Directory path added to `PATH` that contains seiton binary. |

## Development

Setup development environment:

```bash
npm ci
```

Run build:

```bash
npm run build
```

Run unit tests:

```bash
npm test
```

## License

setup-seiton is distributed under the [MIT license](./LICENSE.md).

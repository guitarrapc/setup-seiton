# setup-seiton

GitHub Actions to install the [seiton](https://github.com/guitarrapc/seiton) CLI, a security focused static analysis linter & fixer for GitHub Actions.

## Usage

Install latest seiton.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: guitarrapc/setup-seiton@v1
  - run: seiton --version
  - run: seiton
```

Install a specific version.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: guitarrapc/setup-seiton@v1
    with:
      seiton_version: 0.9.19
```

## Inputs

| Name | Description | Default |
| --- | --- | --- |
| `seiton_version` | Version to install. `latest` by default. You can pass `0.9.19` or `v0.9.19`. | `latest` |
| `github_token` | Token used for GitHub Releases API requests. Falls back to `GITHUB_TOKEN` env var when omitted. | (none) |

## Outputs

| Name | Description |
| --- | --- |
| `seiton_version` | Installed version string without `v` prefix. |
| `seiton_path` | Directory path added to `PATH` that contains seiton binary. |

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

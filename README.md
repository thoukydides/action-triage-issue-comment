# `action-triage-issue-comment`

This action uses AI to analyse dynamic data sources related to a project to determine their relevancy to an issue, and then post a comment with the result if it is likely to be useful. At a high level, the action performs the following steps:
- **Format Data Sources:** Prepares the supplied raw information into a format suitable for the AI model's input context.
- **Fetch Issue**: Retrieves the issue body (and any non-bot comments that have already been posted).
- **Truncate Content**: Intelligently truncates logs, code blocks, and long text to fit the AI model's context limit.
- **Generate Assessment**: Uses GitHub Models to determine the relevancy of the provided information to the issue.
- **Generate and Post Comment**: If there is any relevancy, then formats a comment with the results and posts it to the issue.

> [!CAUTION]
> This action is provided for my own use and published in case it is useful to others. If you rely on it, fork and maintain your own copy. No support or stability guarantees are offered.

## Prerequisites

Before using this workflow, ensure:
- GitHub Models is enabled for this repository (Settings → Models → Enabled).
- The workflow has `issues: write`, `contents: read`, and `models: read` permissions (either via the default `GITHUB_TOKEN` or a fine-grained token).
- You understand the [rate limits](https://docs.github.com/en/github-models/use-github-models/prototyping-with-ai-models#rate-limits) for your usage tier.

## Rate Limits and Concurrency

Each invocation makes one GitHub Models API call. At the time of writing, the default configuration uses a model on the **High** rate limit tier; on the free tier this is currently limited to:
- 2 concurrent requests
- 10 requests/minute
- 50 requests/day

> [!CAUTION]
> This action is not designed for high-volume repositories. If multiple issues are opened in the same minute, these limits could be exceeded; subsequent runs will fail with HTTP 429 errors until the rate limit resets.

## Inputs

Various inputs are defined in the action to configure its operation:

| Name | Description | Default
| --- | --- | ---
| `issue_number` | The GitHub issue to analyse | *required*
| `sources` | String containing a YAML sequence of data sources and their statuses | *required*
| `sources_tokens` | The maximum number of input tokens to use for the data sources in the AI model's input (used to guide truncation of their values to fit the available context) | `4000`
| `dry_run` | Disables actions that modify the issue (adding the comment and minimising previous comments) for testing | `false`

The `sources` value should be a string containing a YAML sequence of mappings (array of objects); one for each data source. Each mapping should provide:

| Key | Description | Default
| --- | --- | ---
| `name` | Name of the data source (used to in the comment) | *required*
| `status` | The result of the job that generated this data source (`success`, `failure`, or `skipped`) | `success`
| `value` | The (multiline) value for this data source, e.g. error messages or changelog excerpt | *required*
| `prompt` | Brief instructions to include in the AI's prompt to guide its handling of this data source

Note:
- `skipped` sources are dropped (not supplied to the AI model or included in the output comment)
- `failure` sources are not supplied to the AI model, but are listed as unavailable in the output comment

## Usage

Example workflow to consider whether any automated test errors or API changelog are relevant to a newly opened issue:

```yaml
name: Triage Issue
permissions:
  issues: write
  contents: read
  models: read

on:
  issues:
    types: [opened]
  workflow_dispatch:
    inputs:
      issue_number:
        description: 'Issue number'
        required: true
        type: number
      dry_run:
        description: 'Dry run (do not modify issue)'
        type: boolean
        default: true

jobs:

  run-test:
    runs-on: ubuntu-latest
    outputs:
      value: ${{ steps.test.outputs.errors }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install, build, and run the tests
        id: test
        run: | # shell
          npm ci
          npm run build
          npm run test # (assumes the test step sets an 'errors' output)

  api-changelog:
    runs-on: ubuntu-latest
    outputs:
      value: ${{ steps.fetch.outputs.page_content }}
    steps:
    - name: Retrieve API changelog
      id: fetch
      env:
        URL: https://developer.home-connect.com/changelog
      run: | # shell
        {
          echo 'page_content<<EOF'
          curl -sL "$URL"
          echo EOF
        } >> "$GITHUB_OUTPUT"

  marshal:
    runs-on: ubuntu-latest
    if: ${{ !cancelled() }}
    needs: [run-test, api-changelog]
    steps:
    - name: AI issue triage
      uses: thoukydides/action-triage-issue-comment@v1
      with:
        # Use the event issue number for label triggers, or the manual input for workflow_dispatch
        issue_number: ${{ github.event.issue.number || fromJson(inputs.issue_number) }}
        sources: | # yaml
          - name: Plugin build and test
            status: ${{ needs.run-test.result }}
            value: |
              ${{ needs.run-test.outputs.value }}
            prompt: Treat any error or warning message as fatal
          - name: Home Connect API changelog
            status: ${{ needs.api-changelog.result }}
            value: |
              ${{ needs.api-changelog.outputs.value }}
        dry_run: ${{ inputs.dry_run }}
```

> [!TIP]
> A real implementation should extract the minimal relevant context from each source, and truncate to a reasonable length considering the AI model's input context window (and GitHub Actions limits). This action will truncate excessively long values, but without any content-awareness.

## ISC License (ISC)

<details>
<summary>Copyright © 2026 Alexander Thoukydides</summary>

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
</details>
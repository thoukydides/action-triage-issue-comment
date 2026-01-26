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
| `needs` | JSON data structure with the same shape as the GitHub Actions `needs` context, with one job per data source | *required*
| `prompt_file` | Path to a custom `.prompt.yml` file containing the AI prompt template | Internal `'triage-issue-comment.prompt.yml'`
| `prompt_vars` | Additional template variables in YAML format to substitute into the AI prompt | `''`
| `input_prompt_tokens` | The number of input tokens reserved for the prompt template itself (deducted from `input_tokens` when truncating the issue) | `700`
| `sources_tokens` | The maximum number of input tokens to use for the data sources in the AI model's input (used to guide truncation of their values to fit the available context) | `4000`
| `dry_run` | Disables actions that modify the issue (adding the comment and minimising previous comments) for testing | `false`

> [!CAUTION]
> The token count is measured using the `o200k_base` encoding. This is suitable for the default prompt's `openai/gpt-4.1` model (and other models in the `o1`, `o3`, `o4-mini`, `gpt-5`, `gpt-4.1`, and `gpt-4o` families). It will give unreliable results for models that use different encodings.

The `needs` input has the following properties:

| Property Name | Description | Default
| --- | --- | ---
| `needs.<job_id>.result` | The result of the job that generated this data source (`success`, `failure`, or `skipped`) | *required*
| `needs.<job_id>.outputs.name` | Name of the data source (used in the comment) | `<job_id>`
| `needs.<job_id>.outputs.value` | The (multiline) value for this data source, e.g. error messages or changelog excerpt | `''`
| `needs.<job_id>.outputs.prompt` | Optional brief instructions to include in the AI's prompt to guide its handling of this data source |

Note:
- `skipped` sources are dropped (not supplied to the AI model or included in the output comment)
- `failure` sources are not supplied to the AI model, but are listed as unavailable in the output comment

## Prompt Variables

The following variables are substituted in the `.prompt.yml` template:

| Variable | Description
| --- | ---
| `{{context}}` | The issue body and comments as a minified JSON string (truncated as necessary to fit within the model's input context)
| `{{owner}}` | The user ID of the repo owner
| `{{release}}` | The tag of the latest non-prerelease, or `'latest release'` if none
| `{{user}}` | The user ID of the issue's creator
| `{{data}}` | The prepared data sources (derived from `needs`) as a minified JSON string (truncated as necessary to fit within the model's input context)

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
      name: Plugin build and test
      value: ${{ steps.test.outputs.errors }}
      prompt: Treat any error or warning message as fatal
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
      name: Home Connect API changelog
      value: ${{ steps.fetch.outputs.changelog }}
    steps:
    - name: Retrieve API changelog
      id: fetch
      env:
        URL: https://developer.home-connect.com/changelog
      run: | # shell
        CHANGELOG=$(curl -s "$URL")
        echo "changelog<<EOF"      >> "$GITHUB_OUTPUT"
        printf '%s\n' "$CHANGELOG" >> "$GITHUB_OUTPUT"
        echo "EOF"                 >> "$GITHUB_OUTPUT"

  collate:
    runs-on: ubuntu-latest
    if: ${{ !cancelled() }}
    needs: [run-test, api-changelog]
    steps:
    - name: AI issue triage
      uses: thoukydides/action-triage-issue-comment@v1
      with:
        # Use the event issue number for label triggers, or the manual input for workflow_dispatch
        issue_number: ${{ github.event.issue.number || fromJson(inputs.issue_number) }}
        needs: ${{ toJSON(needs) }}
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
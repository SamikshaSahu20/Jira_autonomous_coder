# Jira Autonomous Coder — Complete Codebase Documentation

> This document explains every file in the repository (excluding the `output/` folder) in exhaustive detail: what language it is written in, every library/dependency used and why, and a deep explanation of every function/class/component.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Python Backend Files](#2-python-backend-files)
   - [portkey_client.py](#21-portkey_clientpy)
   - [context_analyzer.py](#22-context_analyzerpy)
   - [manifest.py](#23-manifestpy)
   - [generate.py](#24-generatepy)
   - [jira_reader.py](#25-jira_readerpy)
   - [pipeline.py](#26-pipelinepy)
   - [watcher.py](#27-watcherpy)
   - [webapp.py](#28-webapppy)
   - [create_user.py](#29-create_userpy)
3. [Frontend — React Application](#3-frontend--react-application)
   - [frontend/src/main.jsx](#31-frontendsrcmainjsx)
   - [frontend/src/App.jsx](#32-frontendsrcappjsx)
   - [frontend/src/components/Login.jsx](#33-frontendsrccomponentsloginjsx)
   - [frontend/src/components/Dashboard.jsx](#34-frontendsrccomponentsdashboardjsx)
   - [frontend/src/components/FilesModal.jsx](#35-frontendsrccomponentsfilesmodaljsx)
   - [frontend/src/components/MermaidViewer.jsx](#36-frontendsrccomponentsmermaidviewerjsx)
   - [frontend/src/utils/api.js](#37-frontendsrcutilsapijs)
   - [frontend/src/index.css](#38-frontendsrcindexcss)
4. [Configuration Files](#4-configuration-files)
   - [requirements.txt](#41-requirementstxt)
   - [package.json (root)](#42-packagejson-root)
   - [frontend/package.json](#43-frontendpackagejson)
   - [frontend/vite.config.js](#44-frontendviteconfigjs)
   - [frontend/tailwind.config.js](#45-frontendtailwindconfigjs)
   - [frontend/postcss.config.js](#46-frontendpostcssconfigjs)
   - [users.json](#47-usersjson)
5. [End-to-End Data Flow](#5-end-to-end-data-flow)

---

## 1. Project Overview

This is an **AI-powered autonomous code generation system** built at Syngenta Digital. It monitors a Jira sprint, picks up tickets with the status **"In Progress"**, feeds them through a **4-agent AI pipeline** (Analyst → Coder → Tester → Reviewer), saves the generated source code to the `output/` directory, and posts an AI code-review comment back to the Jira ticket.

A **React + FastAPI web dashboard** lets team members log in, inspect every ticket, browse the generated files, view Mermaid architecture flowcharts, live-preview the running apps, and interactively ask an AI agent to patch the code.

```
                   ┌─────────────┐
                   │  Jira API   │
                   └──────┬──────┘
                          │ sprint stories
                   ┌──────▼──────┐
                   │  watcher.py │  polls every 5 minutes
                   └──────┬──────┘
                          │ "In Progress" tickets
                   ┌──────▼──────┐
                   │ pipeline.py │  orchestrates per-ticket
                   └──────┬──────┘
                          │
              ┌───────────▼───────────┐
              │      generate.py      │
              │  Agent 1  Analyst     │
              │  Agent 2  Coder       │
              │  Agent 3  Tester      │
              └───────────┬───────────┘
                          │  via portkey_client.py
                   ┌──────▼──────┐
                   │ Portkey AI  │  (Azure OpenAI gateway)
                   └──────┬──────┘
                          │  generated files
                   ┌──────▼──────┐
                   │  output/    │  saved on disk
                   │  manifest   │  tracked in manifest.json
                   └──────┬──────┘
                          │
                  ┌────────▼────────┐
                  │   webapp.py     │  FastAPI REST API
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │  React Frontend │  Dashboard UI
                  └─────────────────┘
```

---

## 2. Python Backend Files

### Language: Python 3.11+

---

### 2.1 `portkey_client.py`

**Purpose:** The single, unified gateway to all LLM (Large Language Model) API calls. Every AI interaction in this codebase goes through this file. It is the lowest-level AI abstraction layer.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `os` | Standard library. Reads environment variables (API keys, model names, provider names) so secrets are never hard-coded in source code. |
| `sys` | Standard library. Calls `sys.exit(1)` to terminate the process immediately if a critical configuration (like `PORTKEY_API_KEY`) is missing, preventing the app from running in a broken state. |
| `httpx` | A modern, async-capable HTTP client. Used here to create a custom `httpx.Client` with `verify=False` (to bypass Zscaler corporate SSL inspection) and a 120-second timeout. Passed to the Portkey client so all outbound HTTP uses the same session. |
| `python-dotenv` (`load_dotenv`) | Loads key-value pairs from a `.env` file on disk into `os.environ` at startup. This allows developers to configure API keys and model names locally without ever committing secrets to version control. |
| `portkey-ai` (`Portkey`) | The official Python SDK for the Portkey AI gateway. Portkey acts as a **proxy/router** in front of Azure OpenAI (and other LLM providers), adding observability (logging, tracing), rate-limit retries, and the ability to switch models via config without code changes. |

#### Constants / Module-level Variables

- `_HTTP_CLIENT` — A shared `httpx.Client` instance with SSL verification disabled (`verify=False`). Shared so connections are reused (HTTP keep-alive), reducing per-call overhead.
- `_ANALYST_MODEL`, `_CODER_MODEL`, `_TESTER_MODEL`, `_REVIEWER_MODEL` — Read from `.env` environment variables (e.g. `PORTKEY_ANALYST_MODEL`). Defaults to `gpt-4o-mini` / `gpt-4o`. Allows model upgrades without code changes.
- `_ANALYST_PROVIDER`, `_CODER_PROVIDER`, etc. — The Portkey "virtual key" string that identifies which LLM provider/deployment to route to (e.g. `"az-openai"`).
- `AGENT_MODELS` — A dict mapping agent names (`"analyst"`, `"coder"`, `"tester"`, `"reviewer"`) to their resolved model names.
- `AGENT_PROVIDERS` — A dict mapping agent names to their Portkey provider virtual keys.
- `AGENT_TEMPERATURES` — A dict mapping agent names to their LLM temperature values. The analyst and reviewer use `0.3` (slightly creative for reasoning), the coder uses `0.2`, and the tester uses `0.1` (very deterministic for correctness).

#### Functions

---

##### `get_portkey_client(provider=None) -> Portkey`

**What it does:** Constructs and returns a `Portkey` client instance, configured for a specific provider.

**Parameters:**
- `provider` (optional `str`): The Portkey virtual key string identifying the provider. If `None`, falls back to the `PORTKEY_PROVIDER` env var or defaults to `"az-openai"`.

**Step-by-step logic:**
1. Reads `PORTKEY_API_KEY` from environment. If missing, prints an error and calls `sys.exit(1)` — the app cannot function without it.
2. Determines `default_provider` from the argument or `PORTKEY_PROVIDER` env var.
3. Reads `PORTKEY_BASE_URL` (the Portkey gateway URL, defaulting to `https://portkey.syngenta.com/v1`).
4. Instantiates `Portkey(api_key=..., virtual_key=..., base_url=..., http_client=_HTTP_CLIENT, max_retries=0)`.
   - `virtual_key` tells Portkey which backend (Azure OpenAI deployment) to forward the request to.
   - `max_retries=0` disables Portkey's automatic retries — retry logic is handled at a higher level in `generate.py`.
5. Returns the configured client.

---

##### `call_llm(system_prompt, user_prompt, agent="default", model=None, temperature=None, metadata=None) -> str`

**What it does:** The single function used by every other module to invoke an LLM. It is the only place in the codebase that makes an actual API call to the AI.

**Parameters:**
- `system_prompt` (`str`): The LLM's role/persona and strict behavioural rules.
- `user_prompt` (`str`): The actual task or question.
- `agent` (`str`): One of `"analyst"`, `"coder"`, `"tester"`, `"reviewer"`, `"default"`. Determines model, provider, and temperature.
- `model` (`str`, optional): Override the agent's default model.
- `temperature` (`float`, optional): Override the agent's default temperature.
- `metadata` (`dict`, optional): Extra key-value pairs passed to Portkey for tracing/logging.

**Step-by-step logic:**
1. Resolves `resolved_provider` from `AGENT_PROVIDERS[agent]`.
2. Calls `get_portkey_client(provider=resolved_provider)` to get a fresh client routed to the correct provider.
3. Resolves `resolved_model` from argument or `AGENT_MODELS[agent]`.
4. Resolves `resolved_temp` from argument or `AGENT_TEMPERATURES[agent]`.
5. Logs to stdout: agent name, provider, model, temperature.
6. Calls `client.chat.completions.create(model=..., temperature=..., messages=[system, user])` — this is the standard OpenAI Chat Completions API format.
7. Validates the response:
   - `response` must not be `None`.
   - `response.choices` must exist and be non-empty.
   - `response.choices[0].message.content` must be a non-empty string.
8. Returns `content` (the LLM's text reply).
9. On any exception, prints a detailed error with agent name and re-raises so callers can handle it.

---

### 2.2 `context_analyzer.py`

**Purpose:** Scans the `output/` folder (previously generated code), sends code samples to an LLM, and extracts the current project's technology stack as a structured JSON object. This ensures new code generation is **consistent** with the existing codebase.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `json` | Standard library. Parses LLM responses (which should be JSON) into Python dicts, and serialises stack data to/from the `.stack_cache_*.json` cache file. |
| `os` | Standard library. Not directly used here (imports come from other modules), but available. |
| `pathlib.Path` | Standard library. Used throughout for safe, OS-agnostic file path construction and file reading/writing operations. |
| `portkey_client.call_llm` | Internal module. Sends the code samples to an LLM for stack detection. |

#### Constants

- `OUTPUT_DIR` — `Path("output")`. The directory where all generated code lives.
- `SKIP_DIRS` — A set of directory names to ignore when scanning repos (e.g. `node_modules`, `.git`, `__pycache__`, `dist`). These folders contain third-party code, not project code.
- `SUPPORTED_EXTENSIONS` — A set of file suffixes (`.py`, `.ts`, `.js`, `.java`, etc.) that represent actual source code worth analysing.
- `STACK_EXTRACTION_PROMPT` — A long string constant that tells the LLM exactly what JSON schema to return when analysing code samples.

#### Functions

---

##### `_cache_file_for(repo_path: str) -> Path`

**What it does:** Returns the path to a JSON cache file specific to a given repo path. The cache avoids re-querying the LLM every time the stack is needed.

**Logic:** Takes the last segment of `repo_path`, replaces spaces with underscores, and returns `output/.stack_cache_<name>.json`.

---

##### `_collect_code_samples(repo_path: str, max_files: int = 8, max_chars: int = 800) -> list[dict]`

**What it does:** Scans a directory and returns a list of `{"filename": ..., "content": ...}` dicts, where `content` is truncated to `max_chars` characters.

**Step-by-step logic:**
1. If `repo_path` resolves to the `output/` directory, it uses a special scanning strategy: iterates over run subdirectories (most recent first), then iterates over files within each subdirectory. Skips `.md` and `.json` files (they're metadata, not code).
2. For any other directory, it uses `Path.rglob("*")` to walk the whole tree, skipping `SKIP_DIRS` and only including files with extensions in `SUPPORTED_EXTENSIONS`. Skips files with less than 50 characters of content (empty/near-empty files).
3. Returns up to `max_files` samples.

---

##### `_extract_stack_via_llm(samples: list[dict]) -> dict`

**What it does:** Formats the code samples as text and asks the LLM to return a JSON tech-stack description.

**Step-by-step logic:**
1. Joins all samples into a single string using `---` separators.
2. Calls `call_llm()` with the `STACK_EXTRACTION_PROMPT` and the samples, using the `"analyst"` agent, instructing it to return only valid JSON.
3. Strips markdown code fences (` ```json ... ``` `) if present, as LLMs sometimes wrap JSON in markdown.
4. Parses the cleaned string with `json.loads()` and returns the resulting dict.

---

##### `_save_cache(stack: dict, repo_path: str) -> None`

**What it does:** Writes the detected stack dict to the cache file for the given `repo_path`. Creates the `output/` directory if it doesn't exist.

---

##### `_load_cache(repo_path: str) -> dict | None`

**What it does:** Reads and parses the cache file for `repo_path`. Returns `None` if the file doesn't exist or is malformed.

---

##### `get_project_stack(force_refresh=False) -> dict | None`

**What it does:** The main public function. Returns the project's tech stack as a dict (or `None` if no output files exist yet).

**Step-by-step logic:**
1. Calls `_collect_code_samples("output")`. If no samples found, logs a message and returns `None`.
2. Attempts to load the cache via `_load_cache("output")`. If cache exists and `force_refresh` is `False`, returns the cached value immediately.
3. Otherwise, calls `_extract_stack_via_llm(samples)` to detect the stack from scratch.
4. Saves the result to cache via `_save_cache()`.
5. Returns the stack dict.

---

##### `format_stack_for_prompt(stack: dict) -> str`

**What it does:** Converts a stack dict into a human-readable Markdown string suitable for embedding in an LLM prompt.

**Step-by-step logic:**
1. If `stack` is not `None`, builds a `## Existing Project Stack` section with language, framework, database, ORM, auth, libraries, file structure, and conventions.
2. Scans `output/` for all `flowchart_*.md` files and reads their contents.
3. If any flowchart files are found, appends a `## Existing Application Architecture / Flowcharts` section with the full file contents. This is critical: it prevents the AI from re-building a component that already exists — it can read the existing architecture and extend it instead.
4. Returns the combined Markdown string.

---

### 2.3 `manifest.py`

**Purpose:** Manages a persistent `output/manifest.json` file that tracks every generated file: which Jira ticket created it, when it was last modified, where it lives on disk, and a one-line summary. This acts as the system's "memory" of what has already been built.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `json` | Standard library. Reads and writes the `manifest.json` file. |
| `datetime` | Standard library. Records `created_at` and `last_modified` timestamps as ISO 8601 strings for each manifest entry. |
| `pathlib.Path` | Standard library. Constructs the `output/manifest.json` path safely. |

#### Constants

- `MANIFEST_FILE` — `Path("output/manifest.json")`. The single source of truth for all generated files.

#### Functions

---

##### `load_manifest() -> list`

**What it does:** Reads and deserialises `manifest.json` into a Python list of dicts. Handles all error cases gracefully.

**Error handling:**
- If the file doesn't exist → returns `[]`.
- If the file is empty → returns `[]`.
- If the JSON is malformed (`json.JSONDecodeError`) → logs a warning, resets, returns `[]`.
- On any other exception → logs the error, returns `[]`.

**Why this is important:** A corrupted manifest should never crash the pipeline. The system can always recover by rebuilding from scratch.

---

##### `save_manifest(manifest: list) -> None`

**What it does:** Serialises the manifest list to `manifest.json` with 2-space indentation. Creates the `output/` directory first if it doesn't exist.

---

##### `add_to_manifest(story, filename, run_dir, summary, ticket=None) -> None`

**What it does:** Adds or updates one entry in the manifest. Implements an **upsert** pattern.

**Step-by-step logic:**
1. Calls `load_manifest()` to get the current list.
2. Searches for an existing entry with the same `filename`.
3. If found, **updates** the `last_modified`, `last_story`, `run_dir`, `summary`, and `ticket` fields in place. This ensures the manifest always reflects the most recent generation.
4. If not found, **appends** a new entry with all fields including `created_at` and `last_modified` set to the current time.
5. Calls `save_manifest()` to persist the change.

---

##### `format_manifest_for_prompt() -> str`

**What it does:** Formats the manifest as a Markdown list for embedding in an LLM prompt.

**Step-by-step logic:**
1. Calls `load_manifest()`.
2. If empty, returns `""` (no manifest context needed).
3. Builds a `## Already Generated Files` section listing each file with its summary and the story that created it.
4. Ends with an instruction to the LLM: "In your PLAN section, state CREATE or MODIFY for each file and why."

**Why this is important:** Without this, every new ticket would cause the AI to regenerate files from scratch, duplicating code. With this context, the AI can make targeted modifications to existing files.

---

### 2.4 `generate.py`

**Purpose:** The core code generation engine. Orchestrates the 3-agent pipeline (Analyst → Coder → Tester), parses LLM responses, saves files to disk, manages the output folder structure (including AI-driven folder routing), and generates run scripts.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `re` | Standard library. Regular expressions are used extensively: to extract code blocks from LLM markdown responses, parse filenames from comment lines, extract `## EXPLANATION` sections, extract Mermaid flowcharts, and parse bug metrics. |
| `sys` | Standard library. Available for potential process-level operations. |
| `shutil` | Standard library. Available for file operations (though not directly called in the current version). |
| `argparse` | Standard library. Parses CLI arguments when the script is run directly (not currently exposed as a main, but used when calling `generate_code` from the CLI). |
| `datetime` | Standard library. Used in `save_output()` to generate timestamped folder names (e.g. `run_20240625_143000`) when no ticket key is provided. |
| `pathlib.Path` | Standard library. All file I/O uses `Path` for OS-agnostic path handling. |
| `python-dotenv` (`load_dotenv`) | Loads `.env` so API keys and config are available. |
| `portkey_client.call_llm` | Internal. The function that makes the actual LLM API call. |
| `context_analyzer` (`get_project_stack`, `format_stack_for_prompt`) | Internal. Detects the existing tech stack and formats it for the prompt context. |
| `manifest` (`format_manifest_for_prompt`, `add_to_manifest`, `load_manifest`, `save_manifest`) | Internal. Reads and writes the manifest to track all generated files. |

#### Constants

- `CODE_BLOCK_RE` — `re.compile(r"```(\w+)?\n([\s\S]*?)```")`. A compiled regex that extracts all fenced code blocks (` ```language\n...\n``` `) from LLM responses.
- `EXTENSION_MAP` — A dict mapping language names (`"python"`, `"javascript"`, etc.) to file extensions (`"py"`, `"js"`, etc.). Used to auto-assign file extensions when no explicit filename is found.

#### Functions

---

##### `refine_requirements(prompt, ticket, model, force_refresh) -> str`

**What it does:** **Agent 1 (Analyst)**. Takes a raw Jira ticket prompt and transforms it into a detailed technical specification for the Coder agent.

**Step-by-step logic:**
1. Calls `get_project_stack(force_refresh=force_refresh)` to detect the existing tech stack.
2. Calls `format_stack_for_prompt(stack)` to get the stack as a Markdown string.
3. Calls `format_manifest_for_prompt()` to get the list of already-generated files.
4. Constructs a `system_prompt` that:
   - Defines the agent's role as an "elite Software Architect and Business Analyst."
   - Injects the tech stack and manifest as context.
   - Instructs the LLM to output a structured specification with `## ANALYSIS` and `## PLAN` sections.
   - Explicitly says "Do NOT write code."
5. Calls `call_llm()` with `agent="analyst"` and returns the specification string.

**Why this step exists:** LLMs produce much better code when given a precise, structured specification rather than a vague Jira ticket. This step bridges the gap between business language and engineering requirements.

---

##### `generate_source_code(refined_prompt, model) -> str`

**What it does:** **Agent 2 (Coder)**. Takes the specification from Agent 1 and generates the actual source code.

**Step-by-step logic:**
1. Constructs a `system_prompt` with **Absolute Rules** including:
   - All files must be in a flat directory (no subdirectories).
   - Express server must `listen()` immediately (never gated behind DB connection).
   - No deprecated Mongoose options.
   - Must include a self-contained `index.html` served at `GET /`.
   - Must use `process.env.PORT`.
2. Calls `call_llm()` with `agent="coder"` and returns the raw code response.

**Why these rules exist:** AI-generated Node.js code has common failure patterns: mongoose.connect().then(app.listen) blocks startup if the DB is unreachable; deprecated options cause crashes; missing index.html breaks the preview feature.

---

##### `validate_and_test_code(refined_prompt, source_code, ticket, model) -> str`

**What it does:** **Agent 3 (Tester/Reviewer)**. Reviews Agent 2's code, fixes all bugs, writes test cases, and generates a Mermaid flowchart.

**Step-by-step logic:**
1. Constructs a `system_prompt` with the same **Absolute Rules** as Agent 2, plus:
   - Must output ALL source files (even unmodified ones) — if it skips a file, it will be lost.
   - Must output a `flowchart_<ticket>.md` file with a Mermaid diagram.
   - Must end with `## EXPLANATION`, `## METRICS` (Bugs Found/Fixed counts).
2. Calls `call_llm()` with both the specification and the original code as context, using `agent="tester"`.
3. Returns the complete reviewed response.

---

##### `generate_code(prompt, ticket, model, force_refresh) -> str`

**What it does:** The **main orchestrator** for all three agents. Runs them in sequence, measures timing, and handles the safety fallback.

**Step-by-step logic:**
1. Records timestamp `t0`.
2. Calls `refine_requirements()` → `refined_prompt`. Validates it is non-empty.
3. Records `t1`. Logs Analyst timing.
4. Calls `generate_source_code()` → `source_code`. Validates non-empty.
5. Records `t2`. Logs Coder timing.
6. Calls `validate_and_test_code()` → `final_output`. Validates non-empty.
7. Records `t3`. Logs Tester timing.
8. **Safety fallback:** Calls `extract_all_code_blocks()` on both Agent 3's output and Agent 2's output. If Agent 3 returned fewer code files than Agent 2 (it "forgot" to include some), the missing Agent 2 files are injected into the final output. This prevents file loss.
9. Appends a `timings.json` code block with the three agent timing values.
10. Returns the combined final output.
11. On any exception, logs a `CRITICAL ERROR` and re-raises.

---

##### `extract_code_block(response) -> tuple[str, str]`

**What it does:** Extracts only the **largest** single code block from an LLM response. Returns `(code, language)`. Used for simple preview purposes only.

**Logic:** Applies `CODE_BLOCK_RE.findall()`, finds the match with the longest code body, and returns it.

---

##### `extract_all_code_blocks(response) -> list[dict]`

**What it does:** The most important parsing function. Extracts **every** code block from an LLM response and returns them as structured dicts with `{filename, language, code}`.

**Step-by-step logic:**
1. Applies `CODE_BLOCK_RE.findall()` to get all `(language, code)` pairs.
2. For each match:
   - Strips whitespace from language and code.
   - Looks up the file extension in `EXTENSION_MAP`.
   - Reads the **first line** of the code block and uses a regex to extract a filename (e.g. `// server.js` → `server.js`, `<!-- index.html -->` → `index.html`).
   - If a filename was found in the first line, strips that line from the actual code.
   - If no filename found, generates a fallback name like `generated_code_3.js`.
   - Uses `Path(filename_match.group()).name` to keep only the filename (strips any directory prefix the AI might have added).
3. Returns the list. If no code blocks found at all, wraps the entire response as a `.txt` fallback.

**Why this is critical:** The entire file-saving system depends on this function correctly parsing filenames from code blocks.

---

##### `_extract_summary(response) -> str`

**What it does:** Pulls the first line of the `## EXPLANATION` section from an LLM response, truncated to 120 characters. Falls back to the first line of `## ANALYSIS`.

**Used by:** `save_output()` to create a human-readable summary for the manifest.

---

##### `_extract_flowchart(response) -> str | None`

**What it does:** Extracts the content between the first ` ```mermaid ` and closing ` ``` ` markers. Returns the Mermaid diagram source, or `None` if not found.

---

##### `determine_run_dir(ticket, prompt, manifest) -> Path | None`

**What it does:** Uses AI reasoning to decide whether a new ticket's code should be **merged into an existing folder** or saved into a **brand-new folder**.

**Step-by-step logic:**
1. Builds `unique_run_dirs`: a dict of existing output folders → `{tickets, files, descriptions}`.
2. If no existing dirs, returns `None` (always create new).
3. **Step 1 — Explicit ticket references:** Checks if the new prompt text explicitly references any existing ticket number (e.g. "extend ASK-769"). If yes, returns that folder immediately — this is a clear extension request.
4. **Step 2 — AI routing:** Formats info about all existing folders and asks the LLM (with temperature 0.1 for determinism) to decide if the new ticket clearly belongs to the same application as any existing folder. The LLM must return either an exact folder path or the word `"NEW"`.
5. Normalises path separators (Windows vs Unix) before comparing the AI decision to known dirs.
6. Returns the matched `Path` or `None` (meaning create new).

**Why this matters:** Without intelligent folder routing, each ticket would create a separate folder even when it's clearly an extension of the same app. This function keeps related tickets merged.

---

##### `save_output(prompt, response, ticket) -> Path`

**What it does:** The final step after AI generation — saves everything to disk.

**Step-by-step logic:**
1. Calls `extract_all_code_blocks(response)` to get all files.
2. Calls `load_manifest()` and `determine_run_dir()` to decide the target folder.
3. **If merging into existing folder:** Renames the folder to include the new ticket number (e.g. `ASK-769` → `ASK-769-770`). Updates all manifest entries pointing to the old path.
4. **If new folder:** Creates `output/<TICKET_KEY>/` (or a timestamped folder if no ticket).
5. Iterates over all code blocks:
   - Skips empty blocks.
   - Writes each file to disk.
   - Extracts a summary from the first comment line.
   - Calls `add_to_manifest()` to record the file.
6. Calls `_extract_flowchart()` and saves the `.md` flowchart file.
7. Extracts `Bugs Found` and `Bugs Fixed` counts from the response using regex, saves `metrics.json`.
8. Calls `_generate_run_scripts()` to create `run.sh`, `run.bat`, and `README.md`.
9. Returns the `run_dir` Path.

---

##### `_generate_run_scripts(run_dir, ticket) -> None`

**What it does:** Creates shell/batch run scripts and a README without any LLM call — purely by inspecting what files exist.

**Logic:**
1. Detects the entry point: checks for `server.js`, `index.js`, `app.js`, `main.js` in order.
2. Detects whether the project is Python (has `.py` files, no `package.json`) or Node.js.
3. Generates appropriate `run.sh` and `run.bat` scripts.
4. Generates a `README.md` listing all non-JSON files and providing quick-start instructions.

---

### 2.5 `jira_reader.py`

**Purpose:** All communication with the Jira REST API. Fetches sprint stories, builds rich prompts from story fields, posts comments, and transitions issue statuses.

#### Language: Python 3.11+

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `os` | Standard library. Reads Jira credentials (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BOARD_ID`, `AUTO_CODER_SPRINT`) from environment variables. |
| `sys` | Standard library. Used in the `__main__` block to `sys.exit(1)` on missing config. |
| `requests` | Third-party. The de-facto Python HTTP library. Used for all Jira REST API calls (GET sprints, GET issues, POST comments, POST transitions). |
| `urllib3` | Third-party (bundled with `requests`). `urllib3.disable_warnings()` suppresses the `InsecureRequestWarning` that appears when `verify=False` (SSL bypass for corporate Zscaler proxy). |
| `python-dotenv` (`load_dotenv`) | Loads `.env` at module import time so all the `os.getenv()` calls find the right values. |

#### Module-level Variables

- `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BOARD_ID` — Jira connection config, read from `.env`. Stripped of trailing slashes to avoid double-slash issues in URL construction.
- `AUTO_CODER_SPRINT` — The sprint name substring to search for (default `"autonomous-coder"`). The watcher uses this to find the right sprint automatically.
- `_SESSION` — Module-level singleton for the `requests.Session`. Lazy-initialised on first call to `_session()`. Reusing a session enables HTTP connection pooling, reducing latency across many API calls.

#### Functions

---

##### `_session() -> requests.Session`

**What it does:** Returns the module-level singleton `requests.Session`, creating it on first call.

**Logic:** Sets up Basic Auth with `JIRA_EMAIL` and `JIRA_API_TOKEN`, sets the `Accept: application/json` header, and disables SSL verification (`s.verify = False`) for Zscaler. Using a singleton session means TCP connections are reused across all Jira API calls.

---

##### `get_sprint_stories(sprint_id: int) -> list[dict]`

**What it does:** Fetches all issues from a Jira sprint using paginated API calls. Returns a list of rich story dicts.

**Step-by-step logic:**
1. Implements a `while True` pagination loop using `startAt` and `maxResults=50`.
2. For each page, calls `GET /rest/agile/1.0/sprint/{sprint_id}/issue` with a `fields` parameter requesting: summary, description, status, issuetype, priority, labels, assignee, reporter, story points (`customfield_10016`), epic link (`customfield_10014`), comments, subtasks, and linked issues.
3. For each issue, extracts:
   - The last 3 comments and converts them to plain text.
   - Linked issues (type + issue key).
   - All standard fields.
4. Calls `_extract_description()` on the raw description to handle both plain strings and Atlassian Document Format (ADF).
5. Appends a structured dict per story.
6. Breaks when `start >= total` (all pages consumed).

---

##### `get_sprint_by_board(board_id: int, state: str = "active") -> dict | None`

**What it does:** Returns the first sprint in a given state (active, future, or closed) for a board.

**Logic:** Calls `GET /rest/agile/1.0/board/{board_id}/sprint?state=active`. Returns the first result or `None`.

---

##### `get_all_sprints(board_id: int) -> list[dict]`

**What it does:** Returns all sprints for a board (up to 50), regardless of state.

---

##### `find_sprint_by_name(board_id: int, name_filter: str) -> dict | None`

**What it does:** Iterates through all sprints for a board and returns the first one whose name contains `name_filter` (case-insensitive). Used by `watcher.py` to automatically find the `"autonomous-coder"` sprint.

---

##### `get_backlog_issues(board_id: int, sprint_name_filter: str = None) -> list[dict]`

**What it does:** Fetches issues from the board backlog. Optionally filters by sprint name substring (though the filter logic is present in the function signature but not applied in the body — the function returns all backlog issues).

---

##### `build_prompt_from_story(story: dict) -> str`

**What it does:** Converts a rich story dict (from `get_sprint_stories`) into a structured plain-text prompt that the code generation pipeline will use.

**Logic:** Builds a list of text parts, one per available field (ticket key, title, type, priority, story points, assignee, reporter, labels, epic, linked issues, subtasks, description, recent comments). Joins them with double newlines. The richer the story, the richer the prompt.

---

##### `add_jira_comment(issue_key: str, comment_text: str) -> None`

**What it does:** Posts a comment to a Jira issue using the Jira API v3 format.

**Logic:** Constructs an Atlassian Document Format (ADF) body — the v3 API requires this specific JSON structure (not plain text). Posts to `POST /rest/api/3/issue/{issue_key}/comment`. Logs success or failure.

---

##### `transition_jira_issue(issue_key: str, target_status: str) -> bool`

**What it does:** Moves a Jira issue to a specific status by name (e.g. "In Review").

**Step-by-step logic:**
1. `GET /rest/api/3/issue/{issue_key}/transitions` to get all available transitions and their IDs.
2. Case-insensitively matches `target_status` against each transition's `to.name`.
3. If matched, `POST` the transition ID to execute the status change.
4. If not matched, logs the available transitions for debugging.
5. Returns `True` on success, `False` on failure.

---

##### `_extract_description(raw) -> str`

**What it does:** Handles the Jira API's inconsistency — older tickets return description as a plain string, newer ones return Atlassian Document Format (ADF) JSON. Returns plain text in either case.

**Logic:** If `raw` is a string, returns it directly. If it's a dict (ADF), calls `_adf_to_text(raw)`.

---

##### `_adf_to_text(node: dict, depth: int = 0) -> str`

**What it does:** Recursively walks an ADF JSON tree and extracts all text content as a plain string.

**Logic:** If node type is `"text"`, returns `node["text"]`. Otherwise, recursively processes all children. For block-level nodes (paragraph, heading, list items), appends a newline after the block's content.

---

### 2.6 `pipeline.py`

**Purpose:** Runs the code generation pipeline across all "In Progress" stories in a sprint. Each story is processed sequentially; the Agent 4 (Reviewer) runs in a background thread so the pipeline immediately moves to the next ticket.

#### Language: Python 3.11+

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `argparse` | Standard library. Provides the CLI: `--sprint`, `--board`, `--model`, `--dry-run`. |
| `json` | Standard library. Reads/writes `output/pipeline_history.json` (legacy, now a no-op) and the `timings.json` in reviewer thread. |
| `os` | Standard library. Available for env var access. |
| `sys` | Standard library. `sys.exit(1)` on fatal errors. |
| `re` | Standard library. Regex for extracting the `## EXPLANATION` section from LLM responses (fallback in `get_full_explanation`). |
| `threading` | Standard library. `threading.Thread(target=_run_reviewer, daemon=True).start()` runs Agent 4 in a background thread. `daemon=True` ensures the thread doesn't block Python from exiting. |
| `pathlib.Path` | Standard library. Path construction for history file. |
| `datetime` | Standard library. Timestamps in state recording. |
| `jira_reader` (internal) | Provides `get_sprint_stories`, `get_sprint_by_board`, `build_prompt_from_story`, `add_jira_comment`, `transition_jira_issue`. |
| `generate` (internal) | Provides `generate_code`, `save_output`. |
| `portkey_client.call_llm` (internal) | Used by `get_full_explanation()` to power Agent 4. |

#### Functions

---

##### `load_history() -> list` / `save_history(history: list)` / `record_run(...)`

**What they do:** Legacy history tracking functions. `record_run` is now a no-op (tracking is in `manifest.json`), but `load_history`/`save_history` are kept for backward compatibility with any external tooling that might read `pipeline_history.json`.

---

##### `get_full_explanation(response: str) -> str`

**What it does:** **Agent 4 (Reviewer)**. Analyses the generated code and produces a structured, emoji-formatted Jira comment for the code review.

**Step-by-step logic:**
1. Defines a `system_prompt` that tells the LLM to act as a "Senior AI Code Reviewer" and output exactly three bullet points: Security findings, Complexity assessment, and Suggestions.
2. Truncates the generated code response to 4000 characters (to keep token costs low — the reviewer only needs a representative sample).
3. Calls `call_llm()` with `agent="reviewer"` and `temperature=0.3`.
4. If the LLM call fails, falls back to a regex-based extraction of the `## EXPLANATION` section from the response, or returns a generic message. This ensures Jira always gets a comment even if Agent 4 fails.

---

##### `run_pipeline(sprint_id, sprint_name, dry_run, model) -> set`

**What it does:** The main pipeline function. Processes all "In Progress" stories in a sprint.

**Step-by-step logic:**
1. Fetches stories with `get_sprint_stories(sprint_id)`.
2. Iterates over each story:
   - **Skips** stories not in "In Progress" status.
   - **Dry-run mode:** just prints what would be done.
   - **Normal mode:**
     1. Builds prompt with `build_prompt_from_story(story)`.
     2. Generates code with `generate_code(prompt, ticket, model)`.
     3. Validates the response is a non-empty string containing code blocks.
     4. Saves output with `save_output(prompt, response, ticket)`.
     5. Starts a **daemon thread** running `_run_reviewer()`:
        - Calls `get_full_explanation()` (Agent 4).
        - Writes `AI_Review.md` to the run directory.
        - Updates `timings.json` with the reviewer timing.
        - Posts the comment to Jira via `add_jira_comment()`.
        - Transitions the ticket to "In Review" via `transition_jira_issue()`.
     6. Adds ticket to `succeeded` set.
3. Returns the `succeeded` set.

**Error handling:** Each story is wrapped in a `try/except`. JSON errors, generic exceptions, and empty responses all produce informative error messages without crashing the whole pipeline.

---

##### `main()`

**What it does:** The CLI entry point when `pipeline.py` is run directly.

**Logic:** Uses `argparse` with a mutually exclusive group (`--sprint` or `--board`). If `--board` is provided, calls `get_sprint_by_board()` to find the active sprint. Then calls `run_pipeline()`.

---

### 2.7 `watcher.py`

**Purpose:** A long-running polling daemon that periodically checks the Jira sprint for "In Progress" tickets and triggers the pipeline when found. It is the autonomous trigger for the entire system.

#### Language: Python 3.11+

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `argparse` | Standard library. CLI options: `--interval` (poll frequency in minutes), `--once` (single run and exit), `--reset` (clear watcher state). |
| `json` | Standard library. Reads/writes `.watcher_state.json` to persist the last run timestamp and processed tickets. |
| `time` | Standard library. `time.sleep(args.interval * 60)` blocks the main thread between polls. |
| `datetime` | Standard library. Records `last_run` timestamp in state. |
| `pathlib.Path` | Standard library. Path for the state file. |
| `python-dotenv` (`load_dotenv`) | Loads `.env` at startup. |
| `jira_reader` (internal) | `find_sprint_by_name`, `get_sprint_stories`, `JIRA_BOARD_ID`, `AUTO_CODER_SPRINT`. |
| `pipeline` (internal) | `run_pipeline()`. |

#### Constants

- `STATE_FILE` — `Path("output/.watcher_state.json")`. Persists the last run time and last processed ticket list so the watcher can report on what it has done.

#### Functions

---

##### `load_state() -> dict` / `save_state(data: dict)`

**What they do:** Read and write the watcher state JSON file. `load_state` handles missing files and malformed JSON gracefully, always returning a dict.

---

##### `check_and_trigger() -> None`

**What it does:** One complete check-and-act cycle.

**Step-by-step logic:**
1. Calls `find_sprint_by_name(JIRA_BOARD_ID, AUTO_CODER_SPRINT)` to locate the configured sprint by name.
2. If sprint not found, logs and returns.
3. Fetches all stories in the sprint with `get_sprint_stories(sprint_id)`.
4. **Prints all tickets and their statuses** — gives a real-time status overview in the terminal.
5. Filters for tickets with status `"in progress"` (case-insensitive).
6. **Always runs the pipeline** for all "In Progress" tickets (Jira status is the authoritative source of truth — no local state filtering).
7. Saves state with the succeeded ticket keys.
8. Handles `json.JSONDecodeError` separately (API returned bad JSON) vs general exceptions.

---

##### `main()`

**What it does:** CLI entry point. Handles `--reset`, `--once`, and continuous polling modes.

**`--reset` logic:** Clears the `processed_tickets` list from state. If specific ticket keys are passed (e.g. `--reset ASK-782`), only removes those tickets from state, leaving others intact.

**Polling loop:** Calls `check_and_trigger()` in an infinite `while True` loop with `time.sleep(interval * 60)` between iterations. Catches exceptions per iteration so a transient error doesn't kill the watcher.

---

### 2.8 `webapp.py`

**Purpose:** The FastAPI REST API backend that serves the React dashboard and exposes endpoints for ticket data, file browsing, live app preview, and the interactive "Ask Agent" chat feature.

#### Language: Python 3.11+

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `json` | Standard library. Reads manifest, metrics, and timings files. |
| `os` | Standard library. Env var access (`JIRA_BASE_URL`, `SECRET_KEY`, `WEBAPP_PORT`), and `os.environ.copy()` for subprocess environment. |
| `requests` | Third-party. Makes Jira API calls from within the webapp (for fetching user-specific tickets). |
| `subprocess` | Standard library. `subprocess.Popen()` spawns Node.js, Python, or `http.server` processes for the live preview feature. `subprocess.run()` runs `npm install`. |
| `socket` | Standard library. `socket.socket()` with `bind(('', 0))` finds a free ephemeral port for preview servers. |
| `pathlib.Path` | Standard library. File path operations throughout. |
| `datetime`, `timedelta` | Standard library. Creates JWT expiry timestamps (`datetime.utcnow() + timedelta(hours=8)`). |
| `python-dotenv` (`load_dotenv`) | Loads `.env` at startup. |
| `fastapi` (`FastAPI`, `HTTPException`, `Depends`) | The web framework. `FastAPI` creates the ASGI app. `HTTPException` returns proper HTTP error responses. `Depends` enables dependency injection for the auth middleware. |
| `fastapi.security` (`OAuth2PasswordBearer`, `OAuth2PasswordRequestForm`) | Implements the OAuth2 Password Flow for login. `OAuth2PasswordBearer` extracts the Bearer token from `Authorization` headers. `OAuth2PasswordRequestForm` parses `application/x-www-form-urlencoded` login form data. |
| `fastapi.responses` (`FileResponse`) | Returns the React app's `index.html` at `GET /`. |
| `fastapi.staticfiles` (`StaticFiles`) | Mounts the React build's `assets/` directory for JS/CSS serving. |
| `fastapi.middleware.cors` (`CORSMiddleware`) | Adds CORS headers (allows `*`) so the React dev server on port 3000 can call the API on port 8000. |
| `python-jose` (`jwt`, `JWTError`) | JWT creation (`jwt.encode`) and validation (`jwt.decode`). Uses the `HS256` (HMAC-SHA256) algorithm, which is suitable for symmetric JWT signing (both sign and verify use the same `SECRET_KEY`). |
| `passlib` (`CryptContext`) | Password hashing using `sha256_crypt`. Used in `create_user.py` to hash stored passwords, and referenced here via the same context for verification (though the current `login` endpoint bypasses password checking — it accepts any password). |
| `pydantic` (`BaseModel`) | Defines the `ChatRequest` model for the `/chat` endpoint body. FastAPI uses Pydantic to auto-validate and parse JSON request bodies. |
| `uvicorn` | The ASGI server that hosts the FastAPI app. Started in `__main__` with `reload=True` for development. |
| `portkey_client.call_llm` (internal) | Powers the "Ask Agent" chat feature. |
| `generate.extract_all_code_blocks` (internal) | Parses the AI's response in the chat endpoint to extract modified files. |
| `manifest` (internal) | `load_manifest()` for reading the manifest from multiple endpoints. |

#### Module-level Setup

- `app = FastAPI(title="Auto Coder Dashboard")` — Creates the FastAPI application.
- `app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)` — Enables CORS for all origins (suitable for an internal tool).
- `pwd_context = CryptContext(schemes=["sha256_crypt"])` — Shared password context.
- `oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")` — Declares the token URL used by Swagger UI and the auth dependency.
- `RUNNING_APPS = {}` — An in-memory dict mapping `ticket_key → {"process": Popen, "port": int}` to track running preview servers. Note: this is ephemeral (lost on server restart).
- Static files mount: If `frontend/dist/` exists, mounts it at `/assets`.

#### Functions

---

##### `resolve_run_dir(run_dir: str) -> Path`

**What it does:** Resolves a `run_dir` string from the manifest to an absolute `Path`. If the stored path is relative, prepends `BASE_DIR` (the directory containing `webapp.py`).

**Why needed:** Manifest entries may store relative paths (e.g. `"output/ASK-769"`). When the server starts from a different working directory, relative paths would break without this resolution.

---

##### `load_users() -> dict`

**What it does:** Reads and parses `users.json` into a dict mapping email → user object. Returns `{}` if the file doesn't exist.

---

##### `create_token(email: str) -> str`

**What it does:** Creates a signed JWT token for the given email. Sets expiry to 8 hours from now. Uses `SECRET_KEY` and `HS256` algorithm.

---

##### `get_current_user(token: str = Depends(oauth2_scheme)) -> str`

**What it does:** FastAPI dependency function. Decodes the JWT Bearer token from the `Authorization` header and returns the user's email.

**Logic:**
1. Calls `jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])`.
2. Extracts `"sub"` (subject = email) from the payload.
3. If decoding fails (`JWTError`) or `"sub"` is missing, raises `HTTPException(401)`.

**Used via `Depends(get_current_user)` on every protected endpoint.**

---

##### `jira_get(path, params=None) -> dict | None`

**What it does:** Makes an authenticated GET request to the Jira REST API. Returns the parsed JSON response or `None` on failure. Similar to `jira_reader._session()` but creates a fresh session per call (for webapp isolation).

---

##### `get_user_tickets(user_email: str) -> list[dict]`

**What it does:** Fetches all Jira tickets where the logged-in user is the assignee or reporter.

**Logic:**
1. Constructs a JQL query: `project=ASK AND assignee="<email>" ORDER BY updated DESC`.
2. Calls `jira_get()` to fetch up to 100 issues.
3. Maps each issue to a dict with: `ticket`, `summary`, `status`, `issue_type`, `priority`, `assignee`, `reporter`, `updated`, and a `role` field ("Assignee", "Reporter", or "Team").

---

##### `load_manifest() -> list`

**What it does:** Local version of the manifest loader, identical to `manifest.load_manifest()`. Returns `[]` on any error.

---

##### `POST /api/login`

**What it does:** The login endpoint. Accepts `application/x-www-form-urlencoded` form data (standard OAuth2 password flow).

**Logic:**
1. Loads `users.json`.
2. Looks up the username (email) in the users dict. If not found, raises `HTTPException(401)` with a clear error message.
3. **No password validation** — any password is accepted (by design for this internal tool).
4. Calls `create_token()` to generate a JWT.
5. Returns `{"access_token": token, "token_type": "bearer", "email": email}`.

---

##### `GET /api/me`

**What it does:** Returns the email of the currently authenticated user. Useful for the frontend to confirm who is logged in.

---

##### `GET /api/tickets`

**What it does:** Returns all Jira tickets for the logged-in user, enriched with code generation metadata.

**Step-by-step logic:**
1. Calls `get_user_tickets(email)` to get Jira tickets.
2. Loads the manifest and builds `manifest_by_ticket` dict (ticket key → list of manifest entries).
3. For each ticket:
   - Finds matching manifest entries.
   - Filters to only entries whose `run_dir` actually exists on disk (avoids reporting deleted/moved folders).
   - Sets `generated_files`, `code_generated`, `last_generated`.
   - Reads `metrics.json` for `bugs_found` and `bugs_fixed` counts.
4. Returns the enriched list.

---

##### `GET /api/tickets/{ticket_key}/files`

**What it does:** Returns all generated files for a specific ticket, plus flowchart content, AI review content, and timings.

**Step-by-step logic:**
1. Filters manifest entries by `ticket_key`.
2. For entries with missing/generic summaries, reads the first comment line from the actual file to use as a better summary.
3. For flowchart `.md` files, reads the full file content into `f["content"]`.
4. Reads `AI_Review.md` from the run directory.
5. Reads and parses `timings.json` from the run directory.
6. Returns `{ticket, folder, review, timings, files}`.

---

##### `POST /api/tickets/{ticket_key}/chat`

**What it does:** The "Ask Agent" feature. Takes a natural language instruction, reads the existing generated code, and asks the AI to modify specific files.

**Step-by-step logic:**
1. Finds the `run_dir` for the ticket.
2. Reads all non-markdown, non-JSON files from `run_dir` into a single `code_text` string (up to 12,000 characters).
3. Constructs a `sys_prompt` with strict rules: output only changed files, include complete content, use first-line filename comments.
4. Calls `call_llm()` with `agent="coder"`.
5. Calls `extract_all_code_blocks()` to parse the response.
6. Writes each modified file back to disk.
7. For new files not already in the manifest, calls `add_to_manifest()`.
8. Returns `{"status": "success", "updated": [filenames], "message": "..."}`.

---

##### `_stub_missing_requires(target_dir, entry_file) -> None`

**What it does:** Scans a Node.js server file for `require('./...')` calls that reference local files that don't exist, and creates minimal stub files for them.

**Why needed:** AI-generated code sometimes references route/controller files that it forgot to generate. Without stubs, `node server.js` would crash immediately with `MODULE_NOT_FOUND`.

**Logic:** Regex finds all `require('./...')` patterns. For each, checks if the resolved file exists. If not, creates a stub that exports an Express `Router()`.

---

##### `_patch_server_js(target_dir, entry_file, port) -> None`

**What it does:** Auto-patches common AI-generated server.js issues to ensure the preview server always starts successfully.

**What it fixes:**
1. **Deprecated Mongoose options:** Removes `useNewUrlParser: true` and `useUnifiedTopology: true` (deprecated in Mongoose 6+, causes warnings/errors in newer versions).
2. **Blocking `mongoose.connect().then(app.listen)` pattern:** Replaces it with the non-blocking pattern where `app.listen()` runs immediately and `mongoose.connect()` is fire-and-forget with a `.catch()`.
3. **Missing `cors()` call:** If `cors` is required but `app.use(cors)` is missing, inserts it after `const app = express()`.

**Guard:** Adds `// Auto-patched:` comment to prevent re-patching the same file.

---

##### `get_free_port() -> int`

**What it does:** Finds an available TCP port by binding to port 0 (OS assigns a free port), reads the assigned port, then immediately closes the socket. Returns the port number.

---

##### `POST /api/tickets/{ticket_key}/run`

**What it does:** Starts a live preview server for a ticket's generated application.

**Step-by-step logic:**
1. Checks `RUNNING_APPS` cache — if already running and process is alive, returns the existing URL.
2. Finds the run directory from manifest.
3. Calls `get_free_port()` to get an available port.
4. **Node.js app detection:** Looks for `server.js`, `index.js`, or `app.js`.
   - If found: runs `npm install` (skipped if `node_modules` exists), calls `_stub_missing_requires`, calls `_patch_server_js`, then `subprocess.Popen(["node", entry_js], ...)`.
   - If no entry file but `package.json` exists: runs `npm start`.
   - If backend crashes: falls back to `python -m http.server` to serve a static `index.html`.
5. **Python app detection:** Looks for `app.py` or `main.py`.
6. **Static HTML:** Falls back to `python -m http.server` for plain `index.html`.
7. Stores the process in `RUNNING_APPS[ticket_key]`.
8. Returns `{"url": "http://localhost:<port>"}`.

---

##### `GET /`

**What it does:** Serves the React application's `index.html` for any non-API route. Enables the React SPA to handle client-side routing.

**Logic:** Returns the built `frontend/dist/index.html` as a `FileResponse`. If the build doesn't exist, raises `HTTPException(404)` with a message to run `npm run build`.

---

##### `__main__` block

**What it does:** When run directly (`python webapp.py`), starts the Uvicorn ASGI server.
- Reads `WEBAPP_PORT` from env (default 8000).
- Runs `uvicorn.run("webapp:app", host="0.0.0.0", port=port, reload=True)` — `reload=True` auto-restarts on file changes during development.

---

### 2.9 `create_user.py`

**Purpose:** A simple CLI tool to manage the `users.json` file — adding, removing, and listing registered users.

#### Language: Python 3.11+

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `json` | Standard library. Reads and writes `users.json`. |
| `sys` | Standard library. Parses CLI arguments from `sys.argv`. |
| `pathlib.Path` | Standard library. References `users.json` safely. |
| `passlib` (`CryptContext`) | Password hashing. Uses `sha256_crypt` scheme to hash passwords before storing them. `sha256_crypt` is a proven, salted hashing algorithm from the Unix crypt family. The `deprecated="auto"` flag means if the scheme is later changed, old hashes will still verify (but will be re-hashed on the next login). |

#### Functions

---

##### `load_users() -> dict`

**What it does:** Reads `users.json` and returns the users dict. Returns `{}` if the file doesn't exist.

---

##### `save_users(users: dict) -> None`

**What it does:** Writes the users dict to `users.json` with 2-space indentation.

---

##### `add_user(email: str, password: str) -> None`

**What it does:** Adds a new user to `users.json`.

**Logic:** Lowercases the email (for case-insensitive lookup), hashes the password with `pwd_context.hash(password)`, and upserts into the users dict. **Passwords are never stored in plain text.**

---

##### `remove_user(email: str) -> None`

**What it does:** Removes a user from `users.json` by email (case-insensitive). Prints a message if the user wasn't found.

---

##### `list_users() -> None`

**What it does:** Prints all registered email addresses. Does **not** print passwords or hashes.

---

##### `__main__` block

**What it does:** Parses `sys.argv` manually (without `argparse`) to dispatch to `add_user`, `remove_user`, or `list_users`. Prints usage instructions if arguments are wrong.

**Usage:**
```
python create_user.py add <email> <password>
python create_user.py remove <email>
python create_user.py list
```

---

## 3. Frontend — React Application

### Language: JavaScript (JSX) / React 19

The frontend is a **Single-Page Application (SPA)** built with React 19, bundled with Vite, styled with Tailwind CSS, and communicating with the FastAPI backend via `axios`.

---

### 3.1 `frontend/src/main.jsx`

**Purpose:** The React application entry point. Mounts the root React component into the DOM.

**Libraries:** `react`, `react-dom/client`.

**Logic:** Calls `ReactDOM.createRoot(document.getElementById('root')).render(<App />)` to start the React tree. Wrapped in `React.StrictMode` (if enabled) for development warnings.

---

### 3.2 `frontend/src/App.jsx`

**Purpose:** The root component. Manages authentication state and renders either the `Login` or `Dashboard` component.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `react` (`useState`, `useEffect`) | Core React hooks. `useState` manages the JWT token and email in component state. `useEffect` adds a `storage` event listener to react to login/logout events from other browser tabs. |
| `./components/Login` | The login form component. |
| `./components/Dashboard` | The main dashboard component. |

#### Functions/Hooks

---

##### `App()` component

**State:**
- `token` — The JWT Bearer token, initialised from `localStorage` so the user stays logged in across page refreshes.
- `email` — The logged-in user's email, also persisted to `localStorage`.

**`useEffect` (storage listener):**
- Attaches a `"storage"` event listener on `window`. This fires when `localStorage` is modified by **another tab** (not the current one). This means if the user logs out in one tab, all other tabs detect it and also update their state.
- Cleans up the listener on component unmount.

**`handleLogin(data)`:** Called by `Login` when login succeeds. Sets `token` and `email` in state and `localStorage`.

**`handleLogout()`:** Clears `token` and `email` from state and `localStorage`.

**Render logic:** If `!token`, renders `<Login onLogin={handleLogin} />`. Otherwise renders `<Dashboard email={email} onLogout={handleLogout} />`.

---

### 3.3 `frontend/src/components/Login.jsx`

**Purpose:** The login form UI.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `react` (`useState`) | Manages `email`, `password`, `error`, and `loading` form state. |
| `../utils/api` (`login`) | Makes the API call to `POST /api/login`. |
| `lucide-react` (`Code2`, `ArrowRight`) | Icon library. `Code2` for the brand logo, `ArrowRight` for the submit button's animated arrow. |

#### Component: `Login({ onLogin })`

**State:**
- `email` / `password` — Controlled input values.
- `error` — Error message string to display.
- `loading` — Boolean for showing "Authenticating..." and disabling the button.

**`handleSubmit(e)`:** Prevents default form submission, calls `login(email, password)` from the API util, calls `onLogin(data)` on success, or sets `error` on failure.

**UI Structure:**
- **Left side (lg breakpoint+):** Decorative dark panel with brand name and tagline. Uses CSS `blur` and `mix-blend-multiply` for animated background blobs.
- **Right side:** The actual form with email and password inputs, error display, and submit button with hover animations.

---

### 3.4 `frontend/src/components/Dashboard.jsx`

**Purpose:** The main dashboard view showing KPI cards, charts, and the tickets table.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `react` (`useState`, `useEffect`) | Manages `tickets`, `search`, `loading`, `selectedTicket` state. `useEffect` triggers `loadData()` on mount. |
| `lucide-react` | 13+ icons: `Code2` (logo), `ExternalLink` (Jira link), `Search`, `RefreshCw`, `FileCode2`, `CheckCircle2`, `AlertCircle`, `LayoutDashboard`, `ShieldCheck`, `Zap`, `TrendingUp`, `Bug`, `Activity`, `Ticket`. Each icon communicates meaning without text. |
| `recharts` (`PieChart`, `Pie`, `Cell`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `Legend`) | Data visualisation library built on D3. Used for three charts: Generation Ratio (donut pie), File Output Trend (bar), and Bugs Found vs Fixed (grouped bar). `ResponsiveContainer` makes all charts fluid/responsive. |
| `../utils/api` (`getTickets`) | Fetches all tickets from `/api/tickets`. |
| `./FilesModal` | The modal that opens when a ticket's "View" button is clicked. |

#### Component: `Dashboard({ email, onLogout })`

**State:**
- `tickets` — Array of enriched ticket objects from the API.
- `search` — The search filter string.
- `loading` — Loading spinner flag.
- `selectedTicket` — The ticket key string when a modal is open, or `null`.

**`loadData()`:** Async function that sets `loading=true`, calls `getTickets()`, sets the result. On 401, calls `onLogout()`.

**Computed values (derived from `tickets`):**
- `generatedCount`, `pendingCount`, `totalBugsFixed`, `totalBugsFound`, `totalFiles` — Aggregates for the KPI cards.
- `pieData` — `[{name, value, color}]` array for the Generation Ratio chart.
- `filesByDate` / `barData` — Groups tickets by generation date for the File Output Trend bar chart (last 7 days).
- `bugData` — Per-ticket bug counts for the Bugs Found vs Fixed chart.
- `coverage` — Percentage of tickets with generated code.

**Helper functions:**
- `getStatusStyle(status)` — Returns Tailwind CSS class strings for status badge styling (blue for "in progress", green for "done", amber for "review", red for "blocked").
- `getTypeBadge(type)` — Returns Tailwind CSS class strings for issue type badge styling (red for bugs, purple for stories, etc.).

**Render structure:**
1. Sticky navigation bar with logo and user email.
2. KPI card grid (Total Tickets, Code Generated, Files Created, Bugs Fixed).
3. Charts row (Generation Ratio donut, File Output Trend bar, Bugs Found vs Fixed grouped bar).
4. Search input + Refresh button toolbar.
5. Responsive data table of all tickets with status badges, type badges, generation status, file counts, and a "View" button.
6. `{selectedTicket && <FilesModal ... />}` — conditionally renders the modal.

---

### 3.5 `frontend/src/components/FilesModal.jsx`

**Purpose:** A full-featured modal for a single ticket. Shows the pipeline timeline, AI review, generated files list, architecture flowcharts, live app preview, and the Ask Agent chat interface.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `react` (`useState`, `useEffect`) | Manages all the modal's local state (tab selection, loading, copied, app URL, chat state, active flowchart index). `useEffect` fetches files when the modal opens. |
| `../utils/api` (`getTicketFiles`, `runTicketApp`, `sendTicketChat`) | Three API calls: fetch file metadata, start preview server, send chat message. |
| `lucide-react` | 13 icons for the modal UI (tabs, header actions, status indicators). |
| `./MermaidViewer` | The Mermaid diagram renderer component. |

#### Constants

- `FILE_ICONS` — Maps file extensions to short uppercase labels (e.g. `"js" → "JS"`, `"html" → "HTML"`).
- `TAB_CONFIG` — Array of `{id, label, icon}` objects defining the 5 tabs: Overview, Files, Flowchart, Preview, Ask Agent.

#### Component: `FilesModal({ ticketKey, onClose })`

**State:**
- `data` — The full API response from `getTicketFiles`: `{files, folder, review, timings}`.
- `loading` — Loading spinner flag.
- `tab` — Active tab ID string.
- `copied` — Boolean for copy-path button confirmation feedback.
- `isStarting` / `appUrl` / `runError` — Preview server state.
- `chatMessage` / `chatting` / `chatResult` — Ask Agent chat state.
- `activeFlowchart` — Index of the currently displayed flowchart (supports multiple).

**`fetchFiles()`:** Calls `getTicketFiles(ticketKey)` and sets `data`.

**`handleCopyPath()`:** Copies `data.folder` to clipboard using `navigator.clipboard.writeText()`. Shows a checkmark for 2 seconds.

**`handleRunApp()`:** Calls `runTicketApp(ticketKey)`, sets `appUrl`, switches to the Preview tab.

**`handleChat()`:** Calls `sendTicketChat(ticketKey, chatMessage)`, shows success/error result, re-fetches files.

**Derived values:**
- `agentSteps` — Array built from `timings` for the pipeline timeline display.
- `codeFiles` — `data.files` filtered to actual code files (excludes flowcharts, AI_Review.md, README.md, metrics.json, etc.).
- `flowcharts` — `data.files` filtered to `flowchart_*.md` files that have content.

**Tab rendering (5 tabs):**

1. **Overview tab:** Pipeline timeline chips with timing, AI code review box, file/flowchart count stats, flowchart availability notice.
2. **Files tab:** List of all generated files with extension badge, filename, summary, and modification date.
3. **Flowchart tab:** Multi-flowchart selector buttons + `<MermaidViewer>` for the active diagram.
4. **Preview tab:** Start/Restart buttons, error display, and an `<iframe>` rendering the running app at `appUrl`.
5. **Ask Agent tab:** Text input for natural language instructions + chat result display. Submits on Enter or button click.

**Close behaviour:** Clicking outside the modal card (the backdrop) or the X button both call `onClose()`. Implemented by `onClick={e => e.target === e.currentTarget && onClose()}` on the backdrop div.

---

### 3.6 `frontend/src/components/MermaidViewer.jsx`

**Purpose:** Renders a Mermaid.js diagram from a markdown string containing a ` ```mermaid ... ``` ` code block.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `react` (`useEffect`, `useRef`) | `useRef` creates a reference to the container DOM element. `useEffect` triggers rendering whenever `content` changes. |
| `mermaid` | The official Mermaid.js library. Parses and renders Mermaid diagram syntax (flowcharts, sequence diagrams, etc.) into SVG. |

#### Component: `MermaidViewer({ content })`

**`containerRef`:** A React ref pointing to the `<div>` where the SVG will be injected.

**`useEffect([content])`:**
1. Calls `mermaid.initialize({startOnLoad: false, theme: 'default', securityLevel: 'loose'})`.
   - `startOnLoad: false` prevents automatic scanning of the DOM (we control rendering explicitly).
   - `securityLevel: 'loose'` allows click event handlers in diagrams.
2. Extracts the Mermaid code from the markdown: looks for the pattern ` ```mermaid...\n...\n``` `. If not found, uses the raw `content`.
3. Generates a unique `id` for each render (using `Math.random()`) — required by Mermaid to avoid ID collisions.
4. Calls `await mermaid.render(id, diagramCode)` — returns `{svg}`.
5. Sets `containerRef.current.innerHTML = svg` to display the diagram.
6. On error (invalid Mermaid syntax), shows a red error message with the error detail.

---

### 3.7 `frontend/src/utils/api.js`

**Purpose:** Centralised API client module. All HTTP calls from the frontend go through this file.

#### Libraries Used

| Library | Why it is used |
|---------|---------------|
| `axios` | A promise-based HTTP client for the browser. Chosen over native `fetch` because it: automatically transforms request/response JSON, provides interceptors for global auth header injection, has a cleaner error handling model, and is widely familiar to frontend developers. |

#### Setup

**`api` instance:** Created with `axios.create({ baseURL: '/api' })`. The `/api` prefix is proxied by Vite's dev server to `http://localhost:8000/api` (configured in `vite.config.js`). In production, FastAPI serves both the API and the built frontend, so `/api` routes naturally hit FastAPI.

**Request interceptor:** Reads `localStorage.getItem('token')` and adds `Authorization: Bearer <token>` to every outgoing request automatically. No component has to manually attach the token.

#### Exported Functions

---

##### `login(username, password) -> Promise<{access_token, token_type, email}>`

**What it does:** Sends a login request in `application/x-www-form-urlencoded` format (required by FastAPI's `OAuth2PasswordRequestForm`).

**Logic:** Builds a `URLSearchParams` object (which produces form-encoded body), posts to `/api/login`. Returns the response data.

---

##### `getTickets() -> Promise<Array>`

**What it does:** Fetches all tickets for the current user from `GET /api/tickets`. Returns the array of ticket objects.

---

##### `getTicketFiles(ticketKey) -> Promise<Object>`

**What it does:** Fetches file metadata and review content for a specific ticket from `GET /api/tickets/{ticketKey}/files`.

---

##### `runTicketApp(ticketKey) -> Promise<{url}>`

**What it does:** Starts a preview server for a ticket's app via `POST /api/tickets/{ticketKey}/run`. Returns `{url: "http://localhost:<port>"}`.

---

##### `sendTicketChat(ticketKey, message) -> Promise<{status, updated, message}>`

**What it does:** Sends a natural language request to the Ask Agent via `POST /api/tickets/{ticketKey}/chat`. Returns the list of updated file names.

---

### 3.8 `frontend/src/index.css`

**Purpose:** Global CSS entry point. Applies Tailwind CSS directives and defines a few reusable component classes.

**Content:**
- `@tailwind base` — Resets default browser styles (Normalize/Preflight).
- `@tailwind components` — Makes Tailwind component classes available.
- `@tailwind utilities` — Injects all Tailwind utility classes.
- `@layer components` — Defines two custom component classes:
  - `.btn` — Base button style: padding, rounded corners, font weight, transitions, outline removed.
  - `.badge` — Base badge/chip style: inline-flex, small padding, pill shape, small text.

---

## 4. Configuration Files

### 4.1 `requirements.txt`

**Purpose:** Declares all Python runtime dependencies for `pip install -r requirements.txt`.

| Package | Version | Why used |
|---------|---------|----------|
| `openai>=1.0.0` | ≥1.0 | OpenAI Python SDK — the Portkey SDK uses the same chat completions API surface. |
| `python-dotenv>=1.0.0` | ≥1.0 | Loads `.env` files into `os.environ`. Used in every Python module. |
| `portkey-ai>=1.0.0` | ≥1.0 | The Portkey AI gateway SDK for routing LLM requests. |
| `requests>=2.31.0` | ≥2.31 | HTTP library for Jira API calls. |
| `fastapi>=0.110.0` | ≥0.110 | The web framework for `webapp.py`. |
| `uvicorn[standard]>=0.29.0` | ≥0.29 | ASGI server for FastAPI. `[standard]` includes `uvloop` (faster event loop) and `httptools` (faster HTTP parsing). |
| `python-jose[cryptography]>=3.3.0` | ≥3.3 | JWT encoding/decoding. `[cryptography]` provides the `HS256` backend. |
| `passlib[bcrypt]>=1.7.4` | ≥1.7.4 | Password hashing. `[bcrypt]` is listed as an extra but `sha256_crypt` is used in practice. |
| `python-multipart>=0.0.9` | ≥0.0.9 | Required by FastAPI to parse `multipart/form-data` and `application/x-www-form-urlencoded` request bodies (needed for the OAuth2 login endpoint). |

---

### 4.2 `package.json` (root)

**Purpose:** Defines the root-level Node.js project metadata. This is a **duplicate** of `frontend/package.json` and serves as a convenience copy at the repo root.

| Field | Value | Purpose |
|-------|-------|---------|
| `name` | `"auto-coder-dashboard"` | Project name |
| `type` | `"module"` | Enables ES module (`import`/`export`) syntax in Node.js for this package. |
| `scripts.dev` | `"vite"` | Starts the Vite development server. |
| `scripts.build` | `"vite build"` | Produces the production build in `frontend/dist/`. |
| `scripts.preview` | `"vite preview"` | Serves the production build locally for testing. |

---

### 4.3 `frontend/package.json`

**Purpose:** The canonical NPM manifest for the React frontend.

#### Production Dependencies

| Package | Why used |
|---------|----------|
| `axios` | HTTP client for API calls. |
| `clsx` | Utility for conditionally joining CSS class names. Used with Tailwind to build dynamic className strings. |
| `lucide-react` | Icon library — SVG icons as React components. Used throughout Dashboard, FilesModal, Login. |
| `mermaid` | Mermaid.js diagram rendering library. Used by `MermaidViewer.jsx`. |
| `react` | The core React library — virtual DOM, component system, hooks. |
| `react-dom` | React's DOM renderer — renders the virtual DOM to the browser's real DOM. |
| `recharts` | Charting library built on React + D3. Used in `Dashboard.jsx` for PieChart and BarCharts. |
| `tailwind-merge` | Utility to merge Tailwind class strings without conflicts (e.g. `"px-2 px-4"` → `"px-4"`). |
| `uuid` | Generates unique identifiers. Available as a dependency (may be used in chart ID generation). |

#### Dev Dependencies

| Package | Why used |
|---------|----------|
| `@vitejs/plugin-react` | Vite plugin that enables React JSX transform, Fast Refresh (HMR), and React-specific optimisations. |
| `autoprefixer` | PostCSS plugin that automatically adds vendor prefixes (e.g. `-webkit-`) to CSS. Required by Tailwind. |
| `postcss` | CSS transformation tool. Runs Tailwind and Autoprefixer as plugins during build. |
| `tailwindcss` | The Tailwind CSS utility-first framework. Generates the utility classes used throughout all JSX files. |
| `vite` | The build tool and development server. Extremely fast due to native ES module serving in dev and Rollup bundling in production. |

---

### 4.4 `frontend/vite.config.js`

**Purpose:** Vite build and development server configuration.

```js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true }
    }
  }
})
```

| Setting | Purpose |
|---------|---------|
| `plugins: [react()]` | Enables JSX compilation, React Fast Refresh (live component reloading without losing state), and React-specific build optimisations. |
| `server.port: 3000` | The Vite dev server listens on port 3000. |
| `server.proxy['/api']` | Proxies all requests starting with `/api` from the frontend dev server (port 3000) to the FastAPI backend (port 8000). This avoids CORS issues during development and means the frontend code doesn't need to know the backend URL. In production, FastAPI serves the built frontend directly so the proxy isn't needed. |
| `changeOrigin: true` | Rewrites the `Host` header on proxied requests to match the target host (required by some backends). |

---

### 4.5 `frontend/tailwind.config.js`

**Purpose:** Tailwind CSS configuration.

```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: { colors: { syngenta: '#00A651', 'syngenta-dark': '#009444' } } },
  plugins: [],
}
```

| Setting | Purpose |
|---------|---------|
| `content` | Tells Tailwind which files to scan for class names. Tailwind uses this to tree-shake — only the classes actually used in these files are included in the final CSS bundle (dramatically reduces bundle size). |
| `theme.extend.colors.syngenta` | Adds `text-syngenta`, `bg-syngenta`, `border-syngenta` etc. as Tailwind utility classes using Syngenta's brand green (`#00A651`). |
| `theme.extend.colors.syngenta-dark` | Darker brand green used for button hover states. |

---

### 4.6 `frontend/postcss.config.js`

**Purpose:** PostCSS configuration, required by Tailwind's build pipeline.

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

Runs Tailwind CSS and Autoprefixer as PostCSS plugins during build. PostCSS transforms the raw CSS (with `@tailwind` directives) into a standard, fully-expanded CSS file.

---

### 4.7 `users.json`

**Purpose:** A flat JSON file acting as the user database for the web dashboard.

**Schema:**
```json
{
  "user@example.com": {
    "email": "user@example.com",
    "password": "$5$rounds=535000$...$<sha256_crypt hash>"
  }
}
```

**Why a flat file instead of a database:** This is an internal tool with a small, infrequent-change user list. A full database (PostgreSQL, MongoDB) would be overengineering. The `users.json` file is managed by `create_user.py` and read by `webapp.py`.

**Security:** Passwords are stored as `sha256_crypt` hashes (via `passlib`). The hash includes a random salt, making each hash unique even if two users have the same password. Plain-text passwords are never stored.

---

## 5. End-to-End Data Flow

Here is the complete journey from a Jira ticket to a deployed dashboard entry:

```
1. Developer sets a Jira ticket status to "In Progress"

2. watcher.py polls Jira every N minutes
   → find_sprint_by_name() locates the sprint
   → get_sprint_stories() fetches all tickets
   → Filters for "In Progress" tickets
   → Calls pipeline.run_pipeline()

3. pipeline.run_pipeline() iterates over "In Progress" tickets
   → build_prompt_from_story() converts Jira fields to rich text prompt
   → generate.generate_code() runs the 3-agent pipeline:
       Agent 1 (Analyst):
         - context_analyzer.get_project_stack() → detects existing tech stack
         - manifest.format_manifest_for_prompt() → lists already-generated files
         - portkey_client.call_llm(agent="analyst") → returns specification
       Agent 2 (Coder):
         - portkey_client.call_llm(agent="coder") → returns source code blocks
       Agent 3 (Tester):
         - portkey_client.call_llm(agent="tester") → returns fixed code + tests + flowchart
         - Safety fallback: merges any Agent 2 files that Agent 3 dropped
         - Appends timings JSON block
   → save_output() persists everything to disk:
       - determine_run_dir() → AI decides merge vs new folder
       - extract_all_code_blocks() → parses all files from LLM response
       - Writes each file to output/<TICKET>/
       - manifest.add_to_manifest() → records each file
       - Saves flowchart_<ticket>.md
       - Saves metrics.json
       - _generate_run_scripts() → creates run.sh, run.bat, README.md
   → Agent 4 (Reviewer) runs in background thread:
       - portkey_client.call_llm(agent="reviewer") → structured code review
       - Writes AI_Review.md to run directory
       - Updates timings.json with reviewer time
       - jira_reader.add_jira_comment() → posts review to Jira
       - jira_reader.transition_jira_issue() → moves ticket to "In Review"

4. User opens the React dashboard (webapp.py serves index.html)
   → Logs in via POST /api/login → receives JWT token
   → GET /api/tickets → enriched ticket list with generation metadata
   → Clicks "View" on a ticket
   → GET /api/tickets/{key}/files → files list, review content, timings
   → Tabs: Overview (review + timeline), Files, Flowchart (Mermaid SVG), 
           Preview (live running app), Ask Agent (AI chat)
   → POST /api/tickets/{key}/run → starts Node.js/Python/static server
   → POST /api/tickets/{key}/chat → AI patches the generated code in-place
```

---

*Generated documentation — covers all source files outside the `output/` folder.*

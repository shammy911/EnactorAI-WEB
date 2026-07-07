# EnactorAI – Web

An AI-powered web assistant for managing Enactor Estate Manager configurations. Built with Next.js, it connects to an OpenAI-compatible LLM and provides tools for fetching, generating, and importing Estate Manager XML configurations through natural conversation.

![EnactorAI Web Interface](enactor-estate/packages/server/public/media/enactorAi-dark.png)

---

## Architecture

```
enactor-estate/
├── packages/
│   ├── core/          # Shared library — LLM client, tools, conversation engine
│   └── server/        # Next.js web application (frontend + API routes)
├── package.json       # Workspace root (npm workspaces)
└── .env               # Environment configuration
```

| Layer           | Technology                             | Purpose                                             |
| --------------- | -------------------------------------- | --------------------------------------------------- |
| **Frontend**    | Next.js 16 + React 19 + Tailwind CSS 4 | Chat UI with streaming responses                    |
| **API**         | Next.js Route Handlers (SSE)           | `/api/chat` streams AI responses to the browser     |
| **Core Engine** | TypeScript (`@enactor-estate/core`)    | LLM client, tool registry, conversation management  |
| **LLM**         | Any OpenAI-compatible API              | Generates responses and decides which tools to call |

---

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **An OpenAI-compatible LLM endpoint** (e.g. LM Studio, Ollama, vLLM, or OpenAI itself)
- **An Enactor Estate Manager instance** (the target system you want to configure)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/shammy911/EnactorAI-WEB.git
cd EnactorAI-WEB/enactor-estate
```

### 2. Install dependencies

From the `enactor-estate/` root (this installs both `core` and `server` workspaces):

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` and `.env.local` files inside `/` and `packages/server/` respectively using the `.env.example`, `.env.local.example` files inside those directories:

```bash
cp .env.example .env
cp packages/server/.env.local.example packages/server/.env.local
```

> [!IMPORTANT]
> The **Estate Manager URL** is NOT configured here — it is set by each user through the UI's "Connect Estate Manager" button, and stored in the browser's localStorage. This is by design, so different users can target different environments.

### 4. Build the core package

The `server` depends on `@enactor-estate/core`, so you must build it first:

```bash
npm run build:core
```

### 5. Start the development server

```bash
npm run dev:server
```

The app will be available at **http://localhost:3000**.

---

## Usage

1. Open http://localhost:3000 in your browser.
2. Click **"Connect Estate Manager"** in the header and enter your Estate Manager URL and credentials.
3. Start chatting! Ask the AI to fetch configurations, generate XML, set up devices, etc.

> [!WARNING]
> The AI will **never** automatically import or deploy configurations. It will always show you the XML first and require you to explicitly type **APPLY** to confirm any changes.

---

## Available Scripts

Run these from the `enactor-estate/` root:

| Command                | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `npm run dev:server`   | Start the Next.js dev server with hot reload                 |
| `npm run build:core`   | Compile the `@enactor-estate/core` TypeScript package        |
| `npm run build:server` | Production build of the Next.js app (auto-builds core first) |
| `npm run build:all`    | Build both `core` and `server`                               |

---

## Deploying to Vercel

1. Push your repo to GitHub.
2. Import it on [vercel.com/new](https://vercel.com/new).
3. Set the following in the project configuration:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `enactor-estate/packages/server`
4. Add your environment variables (`LLM_URL`, `LLM_MODEL`, etc.) in the Vercel dashboard under **Settings → Environment Variables**.
5. Click **Deploy**.

> [!NOTE]
> Your LLM endpoint must be **publicly accessible** from Vercel's servers. Internal/private network IPs (like `10.x.x.x` or `192.168.x.x`) will not work.

---

## Project Structure

```
enactor-estate/
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── ConversationEngine.ts    # Main AI conversation loop
│   │       ├── OpenAICompatibleClient.ts # LLM API client (streaming)
│   │       ├── DebugLogger.ts           # Structured debug logging
│   │       ├── PermissionManager.ts     # Tool permission system
│   │       ├── McpManager.ts            # MCP server integration
│   │       └── tools/
│   │           ├── ToolRegistry.ts      # Tool registration & execution
│   │           ├── FetchEstateConfigTool.ts
│   │           ├── ImportEstateConfigTool.ts
│   │           ├── ImportEstateConfigZipTool.ts
│   │           ├── CheckDeviceTool.ts
│   │           ├── SkillTool.ts
│   │           └── GetTemplateTool.ts
│   └── server/
│       └── src/
│           ├── app/
│           │   ├── page.tsx             # Main chat page
│           │   ├── layout.tsx           # Root layout
│           │   └── api/chat/
│           │       ├── route.ts         # Chat SSE endpoint
│           │       └── clear/route.ts   # Clear session endpoint
│           ├── components/
│           │   ├── ChatMessage.tsx       # Message bubble with tool events
│           │   ├── ChatInput.tsx         # Message input bar
│           │   ├── Header.tsx            # Top nav bar
│           │   ├── CredentialsPrompt.tsx # Estate Manager connection modal
│           │   └── MarkdownRenderer.tsx  # Markdown + code block rendering
│           ├── hooks/
│           │   └── useChat.ts           # Chat state + SSE streaming hook
│           ├── lib/
│           │   ├── SessionManager.ts    # Per-user session & engine management
│           │   └── SkillManager.ts      # Skill discovery from filesystem
│           └── skills/                  # AI skill definitions
│               ├── entity-creation/
│               └── payment-device-setup/
└── package.json                         # Workspace root
```

---

## Environment Variables Reference

| Variable                 | Required | Default | Description                                 |
| ------------------------ | -------- | ------- | ------------------------------------------- |
| `LLM_URL`                | ✅       | —       | OpenAI-compatible chat completions endpoint |
| `LLM_MODEL`              | ✅       | —       | Model name for the LLM server               |
| `LLM_API_KEY`            | ❌       | `""`    | API key if your LLM server requires auth    |
| `LLM_TEMPERATURE`        | ❌       | `0.6`   | Sampling temperature                        |
| `LLM_MAX_TOKENS`         | ❌       | `60000` | Max response tokens                         |
| `LLM_ENABLE_THINKING`    | ❌       | `true`  | Enable extended thinking mode               |
| `ENACTOR_REMOTE_MCP_URL` | ❌       | —       | Remote MCP server for advanced operations   |

---

## License

See [LICENSE](LICENSE) for details.

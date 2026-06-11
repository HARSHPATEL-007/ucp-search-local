UCP Cross-Platform Search Engine
Unified Control Plane (UCP) Search Prototype
A cross-platform search engine implementing the Browser-in-Browser (BiB) paradigm for desktop web and the Hub-and-Workspace (H&W) paradigm for mobile native (iOS/Android).

Architecture Overview
┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED SEARCH ORCHESTRATOR                │
├──────────────────────────────┬──────────────────────────────┤
│     WEB (BiB Paradigm)     │   MOBILE (H&W Paradigm)    │
├──────────────────────────────┼──────────────────────────────┤
│  • Persistent header bar     │  • Bottom-sticky FAB         │
│  • Cmd+K / Ctrl+K trigger  │  • Haptic feedback trigger   │
│  • High-density keyboard     │  • Thumb-optimized tokens    │
│  • Prefix chips (/service:)  │  • Quick-tap filter chips    │
│  • Hover metadata previews   │  • Voice dictation streaming │
│  • Enter / Cmd+Enter tabs  │  • Swipe right: append       │
│  • WebAssembly trie (WASM)   │  • Swipe left: pin           │
│  • Web Workers for async     │  • SQLite FTS5 offline       │
├──────────────────────────────┴──────────────────────────────┤
│              SERVER-SIDE ELASTIC INDEXING                   │
│  • Context-aware boosting (active workflow ×3)              │
│  • Service domain scoping                                   │
│  • Recent workflow proximity                                │
│  • Geofenced region matching                                │
│  • Real-time streaming (SSE)                                │
└─────────────────────────────────────────────────────────────┘
Project Structure
ucp-search-engine/
├── shared/                          # Cross-platform core
│   ├── types.ts                     # Unified type definitions
│   ├── context-engine.ts            # Context scoring & query parsing
│   └── search-orchestrator.ts       # Backend coordination
│
├── web/                             # Desktop Browser-in-Browser
│   ├── search-shell.tsx             # Main search modal shell
│   ├── components/
│   │   ├── search-input.tsx         # Prefix chips + auto-complete
│   │   ├── result-list.tsx          # Hover-state result list
│   │   └── preview-pane.tsx         # Metadata preview panel
│   ├── backends/
│   │   ├── trie-backend.ts          # WebAssembly trie worker
│   │   └── elastic-backend.ts       # Server elastic client
│   ├── workers/
│   │   └── trie-worker.js           # Web Worker + JS fallback
│   └── styles/
│       └── search-shell.css         # BiB shell styling
│
├── wasm/                            # Rust WebAssembly Module
│   ├── Cargo.toml
│   ├── build.sh
│   └── src/
│       └── lib.rs                   # Trie search + fuzzy matching
│
├── mobile/                          # Native Mobile Hub-and-Workspace
│   ├── shared/
│   │   └── mobile-types.ts          # Mobile-specific extensions
│   ├── android/
│   │   ├── SearchActivity.kt        # Bottom-sheet FAB entry
│   │   ├── SearchViewModel.kt       # State management + voice
│   │   └── SQLiteSearchBackend.kt   # FTS5 + workspace recency
│   └── ios/
│       ├── SearchViewController.swift   # Bottom-sheet + swipe
│       └── SearchViewModel.swift        # Combine + Speech framework
│
└── server/                          # Backend Services
    ├── api/
    │   └── search-controller.ts     # Elastic search + streaming
    └── indexing/
        ├── elastic-mapping.json     # Index schema
        └── sync-service.ts          # CDC + mobile sync
Key Features
Context-Aware Scoping
The search engine implements deep contextual interpretation:

Active workflow boost: 3× score multiplier for results matching the current workflow
Service domain boost: 2× for matching the active service (e.g., Audit & Assurance / PCAOB AS 2201)
Recent workflow proximity: 1.5× for recently accessed workflows
Geofenced matching: 1.3× for results in the user's current region
Prefix Flag System
Structured query syntax for power users:

/service:lending /status:pending /client:ACME-2026 financial spreading
Cross-Platform Session Lifecycle
State	Web (BiB)	Mobile (H&W)
Active	Rendering in viewport	Top of view controller stack
Background	DOM detached, browser memory	Background stack, thread locked
Hibernated	Serialized to IndexedDB	Evicted by OS, state in SQLite
Discarded	Auto Tab Discarding at 85% RAM	Memory compaction on pressure
Quick Start
Web (BiB)
cd web
npm install
npm run dev
# Access at http://localhost:3000
# Press Cmd+K or Ctrl+K to open search
WebAssembly Trie Module
cd wasm
./build.sh
# Requires wasm-pack and Rust toolchain
Android (H&W)
cd mobile/android
# Open in Android Studio
# Requires: Kotlin Coroutines, Room, Material Components
iOS (H&W)
cd mobile/ios
# Open in Xcode
# Requires: SwiftUI/Combine, Speech framework, SQLite3
Server
cd server
npm install
# Requires: Elasticsearch 8.x, PostgreSQL 14+
npm run dev
API Endpoints
Method	Endpoint	Description
POST	/api/search/elastic	Context-aware search
POST	/api/search/elastic/stream	Server-sent events streaming
POST	/api/search/sync/mobile	Mobile offline sync
Configuration
Environment variables:

ELASTIC_URL=http://localhost:9200
DATABASE_URL=postgresql://user:pass@localhost/ucp
WASM_PATH=/wasm/ucp_trie_search.wasm
OFFLINE_SYNC_INTERVAL_MS=300000
🚀 Quick Start (Local Device)
Prerequisites
Docker Desktop (for server + Elasticsearch)
Node.js 20+ (for server development)
Modern web browser (Chrome, Edge, Safari, Firefox)
Option A: One-Command Setup (Recommended)
macOS/Linux:

./quickstart.sh
Windows (PowerShell):

.\quickstart.ps1
This will:

Start Elasticsearch, PostgreSQL, and Redis in Docker
Install server dependencies
Start the API server
Seed 6 demo financial service entities
Print all local URLs
Option B: Manual Setup
1. Start Infrastructure:

docker compose up -d elasticsearch postgres redis
2. Install & Start Server:

cd server
npm install
npm run dev
3. Seed Demo Data:

curl -X POST http://localhost:4000/api/search/seed
4. Open Demo: Open demo.html in your browser (double-click or use Live Server).

Demo Page Features
The demo.html page is a standalone, no-build-required search shell that demonstrates:

Cmd+K / Ctrl+K global shortcut to open search
Prefix flag parsing (/service:lending, /status:pending)
Live chips that appear as you type flags
Keyboard navigation (↑↓ to select, Enter to open, Cmd+Enter to split)
Hover previews with metadata and action buttons
Context-aware scoping (demo context simulates an active PCAOB audit workflow)
Local fallback when API is offline (6 hardcoded demo results)
API connectivity test with real Elasticsearch backend
WebAssembly Trie (Advanced)
To build the Rust WASM module:

cd wasm
./build.sh        # Requires Rust + wasm-pack
Then update web/workers/trie-worker.js to use the compiled .wasm file.

Mobile (iOS/Android)
These are scaffolded native projects that require platform-specific setup:

Android:

Open mobile/android/ in Android Studio
Add dependencies: Kotlin Coroutines, Room, Material Components
Build and run on emulator or device
iOS:

Open mobile/ios/ in Xcode
Requires: Speech framework, Combine, SQLite3
Build and run on Simulator or device
Local URLs After Setup
Service	URL	Status Check
API Server	http://localhost:4000	GET /health
Search API	http://localhost:4000/api/search/elastic	POST with JSON body
Seed Data	http://localhost:4000/api/search/seed	POST (no body)
Elasticsearch	http://localhost:9200	GET /
PostgreSQL	localhost:5432	pg_isready
Redis	localhost:6379	redis-cli ping
Troubleshooting
Port conflicts: If 4000, 9200, 5432, or 6379 are in use, edit docker-compose.yml to map to different host ports.

Elasticsearch memory: If ES fails to start, increase Docker memory limit to 4GB+ in Docker Desktop settings.

CORS errors: The API server has cors() enabled. If you serve demo.html from a different origin, ensure the API port matches.

No results: Make sure to seed demo data first: curl -X POST http://localhost:4000/api/search/seed

License
Proprietary - UCP Engineering

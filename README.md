# Auto Matrix

A real-time Matrix simulation where AI agents live, talk, evolve, and die in a voxel-rendered NYC cityscape.

74 autonomous agents powered by LLM inhabit a 2560x2560 world — making decisions, forming relationships, having conversations, and progressing through a multi-phase story cycle that can end in civilization's collapse and rebirth.

## Architecture

```
packages/
├── server/     # Express + Socket.IO — simulation loop, agent AI, story engine
├── client/     # Three.js voxel renderer — 3D city, agents, UI overlays
└── shared/     # Types, constants, location definitions
```

### Server

- **SimulationLoop** — tick-based world updates (1s default)
- **DecisionEngine** — LLM-driven agent decision-making
- **ActionExecutor** — resolves agent actions against world state
- **ConversationEngine** — dynamic multi-agent dialogues
- **StoryEngine** — 4-phase narrative progression (normal life → awakening → war → resolution)
- **EvolutionEngine** — civilization-wide cycles (stable → anomaly → revolt → catastrophe → extinction → rebirth)
- **PersistentMemoryManager** — agent memories that survive across ticks
- **RelationshipGraph** — inter-agent relationship tracking

### Client

- **VoxelRenderer** — procedural NYC cityscape with buildings, streets, landmarks
- **AgentRenderer** — voxel character models with animations
- **LightingSystem** — dynamic time-of-day lighting
- **ParticleSystem** — visual effects (code rain, explosions, portals)
- **CameraController** — free camera + agent follow mode
- **HUD** — real-time stats, story phase, controls
- **ConversationView** — 3D speech bubbles + dialogue overlay
- **EvolutionTimeline** — civilization cycle visualization

### World

Locations are mapped to a NYC grid — Metacortex Office (Midtown), Oracle's Apartment (Upper West Side), and more. Each location belongs to a faction and a world (matrix / real).

## Getting Started

```bash
# Install dependencies
npm install

# Seed world data and characters
npm run seed

# Start dev (server + client)
npm run dev
```

- Client: http://localhost:5173/
- Server: http://localhost:3001/
- API: http://localhost:3001/api/status

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/status` | Tick, phase, agent count, uptime |
| `GET /api/agents` | All agent states |
| `GET /api/agents/:id` | Single agent detail |

## Tech Stack

- **Runtime** — Node.js + TypeScript
- **Server** — Express, Socket.IO
- **Client** — Three.js, Vite
- **AI** — LLM API (configurable)
- **Build** — npm workspaces, tsx, concurrently

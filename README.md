# Spyfall Client

Angular frontend for the Spyfall party game. Players join a room, receive secret roles, and try to identify the spy — or, if you're the spy, figure out the location without giving yourself away. Communicates with [spyfall-server](../spyfall-server) via REST and SignalR for real-time updates.

## Gameplay Flow

1. One player creates a game and shares the room code
2. All players join the lobby and mark themselves ready
3. The host starts the game — each player receives a location and role (or "Spy" if they're the spy)
4. Players discuss and vote to identify the spy
5. Results are shown on the results page

## Tech Stack

- **Framework:** Angular 21
- **Real-time:** @microsoft/signalr (connects to [spyfall-server](../spyfall-server) hub)
- **Styling:** TailwindCSS + SCSS
- **Testing:** Vitest

## Setup

### Requirements

- Node.js 18+
- Angular CLI (`npm install -g @angular/cli`)
- A running [spyfall-server](../spyfall-server) instance

### Installation

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
ng serve
# or
npm start
```

The app will be available at `http://localhost:4200`.

The dev proxy (`proxy.conf.json`) forwards API requests to `http://localhost:5000` by default — update this if your `spyfall-server` runs on a different port.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` / `ng serve` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run unit tests with Vitest |
| `npm run lint` | Run ESLint |

## Deployment

The client is deployed at `https://spyfall.collinkoldoff.dev`. Configure the production API URL in the Angular environment files before building for production.

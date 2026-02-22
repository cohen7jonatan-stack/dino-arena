# Dino Arena

Online multiplayer dinosaur battle game. Pick a direction and power, then watch your dino charge across the platform, smashing into others. Last dino standing wins!

## How to Play

1. **Create or join a room** — share the 4-letter room code with friends
2. **Each round**, drag from your dino to aim and set power (slingshot-style)
3. All dinos charge simultaneously, colliding and pushing each other
4. Any dino knocked off the circular platform is eliminated
5. Last one standing wins the game

## Tech Stack

- **Client**: Phaser 3 + TypeScript + Vite
- **Server**: Node.js + Express + Socket.io + Matter.js
- **Monorepo**: npm workspaces

## Getting Started

```bash
# Install dependencies
npm install

# Run both server and client in development mode
npm run dev

# Or run them separately
npm run dev:server   # starts on port 3001
npm run dev:client   # starts on port 5173
```

Open http://localhost:5173 in your browser. Open a second tab (or share the room code) to play with others.

## Project Structure

```
dino-arena/
├── shared/          # Shared TypeScript types and constants
├── server/          # Express + Socket.io game server with Matter.js physics
│   └── src/
│       ├── index.ts
│       ├── LobbyManager.ts
│       ├── GameRoom.ts
│       └── PhysicsEngine.ts
└── client/          # Phaser 3 game client
    └── src/
        ├── main.ts
        ├── scenes/
        │   ├── MenuScene.ts
        │   ├── LobbyScene.ts
        │   ├── GameScene.ts
        │   └── GameOverScene.ts
        └── network/
            └── SocketManager.ts
```

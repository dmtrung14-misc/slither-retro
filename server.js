import http from "node:http";
import path from "node:path";
import express from "express";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const COLORS = [
  "#7CFFCB",
  "#FFD166",
  "#A29BFE",
  "#F25F5C",
  "#4CC9F0",
  "#9B5DE5",
  "#06D6A0",
  "#F15BB5",
];

const BASE_TICK_MS = 140;
const MIN_TICK_MS = 60;

function roomDefaults() {
  return {
    mapSize: 32,
    speed: 3,
    maxPlayers: 4,
    timerMinutes: 0,
  };
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function createRoom(options) {
  const code = generateRoomCode();
  const normalized = {
    ...roomDefaults(),
    ...options,
  };
  normalized.mapSize = clamp(Number(normalized.mapSize) || 32, 16, 64);
  normalized.speed = clamp(Number(normalized.speed) || 3, 1, 5);
  normalized.maxPlayers = clamp(Number(normalized.maxPlayers) || 4, 1, 4);
  normalized.timerMinutes = clamp(Number(normalized.timerMinutes) || 0, 0, 60);

  const room = {
    code,
    options: normalized,
    players: new Map(),
    hostId: null,
    food: null,
    bonusFood: null,
    loop: null,
    bonusTimer: null,
    endAt:
      normalized.timerMinutes > 0
        ? Date.now() + normalized.timerMinutes * 60_000
        : null,
    ended: false,
    tickMs: Math.max(
      MIN_TICK_MS,
      BASE_TICK_MS - (normalized.speed - 1) * 18,
    ),
  };

  spawnFood(room);
  scheduleBonus(room);
  startLoop(room);
  rooms.set(code, room);
  return room;
}

function generateRoomCode() {
  let code = "";
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function spawnFood(room) {
  const { mapSize } = room.options;
  room.food = randomOpenCell(room, mapSize);
}

function scheduleBonus(room) {
  clearTimeout(room.bonusTimer);
  if (room.ended) return;
  const delay = 7000 + Math.random() * 8000;
  room.bonusTimer = setTimeout(() => {
    if (room.ended) return;
    room.bonusFood = randomOpenCell(room, room.options.mapSize);
    setTimeout(() => {
      room.bonusFood = null;
      scheduleBonus(room);
    }, 9000);
  }, delay);
}

function randomOpenCell(room, mapSize) {
  const occupied = new Set();
  for (const player of room.players.values()) {
    for (const part of player.body) {
      occupied.add(`${part.x}:${part.y}`);
    }
  }

  let x = 0;
  let y = 0;
  do {
    x = Math.floor(Math.random() * mapSize);
    y = Math.floor(Math.random() * mapSize);
  } while (occupied.has(`${x}:${y}`));
  return { x, y };
}

function startLoop(room) {
  if (room.ended) return;
  room.loop = setInterval(() => tickRoom(room), room.tickMs);
}

function stopLoop(room) {
  clearInterval(room.loop);
  clearTimeout(room.bonusTimer);
}

function addPlayerToRoom(ws, room, payload) {
  if (room.players.size >= room.options.maxPlayers) {
    ws.send(stringify({ type: "error", message: "Room is full." }));
    return null;
  }
  if (room.ended) {
    ws.send(stringify({ type: "error", message: "Room is closed." }));
    return null;
  }

  const id = nanoid(8);
  const name = (payload?.name || "Player").slice(0, 18);
  const color = COLORS[room.players.size % COLORS.length];
  const player = {
    id,
    name,
    color,
    body: [],
    dir: { x: 1, y: 0 },
    pendingDir: { x: 1, y: 0 },
    grow: 3,
    score: 0,
    alive: true,
    ws,
  };

  respawnPlayer(room, player);
  room.players.set(id, player);
  if (!room.hostId) {
    room.hostId = id;
  }

  ws.send(
    stringify({
      type: "joined",
      playerId: id,
      roomCode: room.code,
      options: room.options,
      hostId: room.hostId,
      endAt: room.endAt,
    }),
  );

  broadcast(room, { type: "system", message: `${name} joined.` });
  broadcastState(room);
  return player;
}

function respawnPlayer(room, player) {
  const { mapSize } = room.options;
  player.body = [];
  const start = randomOpenCell(room, mapSize);
  player.dir = { x: 1, y: 0 };
  player.pendingDir = { x: 1, y: 0 };
  player.grow = 3;
  player.alive = true;
  player.body.push(start);
}

function handleDirection(player, input) {
  if (!player.alive) return;
  const dir = { ...player.dir };
  const allowed = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const next = allowed[input];
  if (!next) return;
  const isReverse = next.x === -dir.x && next.y === -dir.y;
  if (!isReverse) {
    player.pendingDir = next;
  }
}

function tickRoom(room) {
  if (room.ended) return;
  if (room.endAt && Date.now() >= room.endAt) {
    endRoom(room, "timer");
    return;
  }
  const { mapSize } = room.options;
  const occupancy = new Map();

  for (const p of room.players.values()) {
    if (!p.alive) continue;
    for (const part of p.body) {
      occupancy.set(`${part.x}:${part.y}`, p.id);
    }
  }

  for (const player of room.players.values()) {
    if (!player.alive) continue;
    player.dir = player.pendingDir;
    const head = player.body[0];
    const next = { x: head.x + player.dir.x, y: head.y + player.dir.y };

    const hitWall =
      next.x < 0 || next.x >= mapSize || next.y < 0 || next.y >= mapSize;

    const hitSnake = occupancy.has(`${next.x}:${next.y}`);

    if (hitWall || hitSnake) {
      player.alive = false;
      broadcast(room, {
        type: "system",
        message: `${player.name} crashed.`,
      });
      setTimeout(() => respawnPlayer(room, player), 1200);
      continue;
    }

    player.body.unshift(next);
    occupancy.set(`${next.x}:${next.y}`, player.id);

    let consumed = false;
    if (room.food && next.x === room.food.x && next.y === room.food.y) {
      player.grow += 1;
      player.score += 10;
      consumed = true;
      spawnFood(room);
    }

    if (
      room.bonusFood &&
      next.x === room.bonusFood.x &&
      next.y === room.bonusFood.y
    ) {
      player.grow += 3;
      player.score += 50;
      room.bonusFood = null;
      scheduleBonus(room);
    }

    if (player.grow > 0) {
      player.grow -= 1;
    } else {
      player.body.pop();
    }

    if (!consumed && room.food == null) {
      spawnFood(room);
    }
  }

  broadcastState(room);
}

function broadcast(room, data) {
  const payload = stringify(data);
  for (const player of room.players.values()) {
    if (player.ws.readyState === player.ws.OPEN) {
      player.ws.send(payload);
    }
  }
}

function broadcastState(room) {
  const snapshot = {
    type: "state",
    food: room.food,
    bonusFood: room.bonusFood,
    mapSize: room.options.mapSize,
    players: [],
    leaderboard: [],
    hostId: room.hostId,
    endAt: room.endAt,
    ended: room.ended,
  };

  const scores = [];
  for (const player of room.players.values()) {
    snapshot.players.push({
      id: player.id,
      name: player.name,
      color: player.color,
      body: player.body,
      alive: player.alive,
      score: player.score,
    });
    scores.push({ id: player.id, name: player.name, score: player.score });
  }

  snapshot.leaderboard = scores
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  broadcast(room, snapshot);
}

function endRoom(room, reason = "host") {
  if (room.ended) return;
  room.ended = true;
  stopLoop(room);
  const leaderboard = getLeaderboard(room);
  broadcast(room, {
    type: "room_ended",
    leaderboard,
    reason,
    roomCode: room.code,
  });
  broadcastState(room);
}

function getLeaderboard(room) {
  const scores = [];
  for (const player of room.players.values()) {
    scores.push({ id: player.id, name: player.name, score: player.score });
  }
  return scores.sort((a, b) => b.score - a.score).slice(0, 5);
}

wss.on("connection", (ws) => {
  let currentRoom = null;
  let currentPlayer = null;

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch (e) {
      ws.send(stringify({ type: "error", message: "Invalid payload." }));
      return;
    }

    if (message.type === "create_room") {
      currentRoom = createRoom(message.options);
      currentPlayer = addPlayerToRoom(ws, currentRoom, message);
    } else if (message.type === "join_room") {
      const code = (message.roomCode || "").toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        ws.send(stringify({ type: "error", message: "Room not found." }));
        return;
      }
      if (room.ended) {
        ws.send(stringify({ type: "error", message: "Room is closed." }));
        return;
      }
      currentRoom = room;
      currentPlayer = addPlayerToRoom(ws, room, message);
    } else if (message.type === "change_dir" && currentPlayer) {
      handleDirection(currentPlayer, message.dir);
    } else if (message.type === "end_room" && currentRoom && currentPlayer) {
      if (currentPlayer.id !== currentRoom.hostId) {
        ws.send(
          stringify({ type: "error", message: "Only host can end the room." }),
        );
      } else {
        endRoom(currentRoom, "host");
      }
    } else if (message.type === "ping") {
      ws.send(stringify({ type: "pong", t: Date.now() }));
    }
  });

  ws.on("close", () => {
    if (currentRoom && currentPlayer) {
      currentRoom.players.delete(currentPlayer.id);
      broadcast(currentRoom, {
        type: "system",
        message: `${currentPlayer.name} left.`,
      });
      if (currentRoom.hostId === currentPlayer.id) {
        const nextHost = currentRoom.players.values().next().value;
        currentRoom.hostId = nextHost ? nextHost.id : null;
        if (currentRoom.hostId) {
          broadcast(currentRoom, {
            type: "system",
            message: `${nextHost.name} is the new host.`,
          });
        }
        broadcastState(currentRoom);
      }
      if (currentRoom.players.size === 0) {
        stopLoop(currentRoom);
        rooms.delete(currentRoom.code);
      }
    }
  });
});

app.get("/health", (_req, res) => res.send("ok"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function stringify(obj) {
  return JSON.stringify(obj);
}


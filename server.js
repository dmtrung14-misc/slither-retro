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
    gameMode: "classic",
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
  normalized.gameMode = normalized.gameMode || "classic";

  const room = {
    code,
    options: normalized,
    players: new Map(),
    spectators: new Map(),
    hostId: null,
    food: null,
    bonusFood: null,
    decomposedFood: [], // Array of {x, y, expiresAt} from dead snakes
    loop: null,
    bonusTimer: null,
    endAt:
      normalized.timerMinutes > 0
        ? Date.now() + normalized.timerMinutes * 60_000
        : null,
    ended: false,
    matchStarted: false, // For team mode
    teams: { team1: [], team2: [] }, // For team mode
    teamScores: { team1: 0, team2: 0 }, // For team mode
    tickMs: Math.max(
      MIN_TICK_MS,
      BASE_TICK_MS - (normalized.speed - 1) * 18,
    ),
  };

  // Only start loop for classic mode, team mode starts when host starts match
  if (normalized.gameMode === "classic") {
    spawnFood(room);
    scheduleBonus(room);
    startLoop(room);
  }
  
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
  if (room.ended) {
    ws.send(stringify({ type: "error", message: "Room is closed." }));
    return null;
  }

  const id = nanoid(8);
  const name = (payload?.name || "Player").slice(0, 18);
  
  // Team mode: if match started, add as spectator
  if (room.options.gameMode === "team" && room.matchStarted) {
    const spectator = { id, name, ws };
    room.spectators.set(id, spectator);
    
    ws.send(
      stringify({
        type: "joined",
        playerId: id,
        roomCode: room.code,
        options: room.options,
        hostId: room.hostId,
        endAt: room.endAt,
        isSpectator: true,
        matchStarted: true,
      }),
    );
    
    broadcast(room, { type: "system", message: `${name} joined as spectator.` });
    broadcastState(room);
    return spectator;
  }
  
  // Check player limit
  if (room.players.size >= room.options.maxPlayers) {
    ws.send(stringify({ type: "error", message: "Room is full." }));
    return null;
  }

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
    team: null, // Will be set in team mode
    ws,
  };

  // Only respawn if classic mode or match already started
  if (room.options.gameMode === "classic" || room.matchStarted) {
    respawnPlayer(room, player);
  }
  
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
      matchStarted: room.matchStarted,
      isSpectator: false,
    }),
  );

  broadcast(room, { type: "system", message: `${name} joined.` });
  
  // Send initial team lobby state for team mode
  if (room.options.gameMode === "team" && !room.matchStarted) {
    broadcastTeamLobby(room);
  } else {
    broadcastState(room);
  }
  
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
  
  const now = Date.now();
  const { mapSize } = room.options;
  
  // Clean up expired decomposed food
  room.decomposedFood = room.decomposedFood.filter(f => f.expiresAt > now);
  
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
    let next = { x: head.x + player.dir.x, y: head.y + player.dir.y };

    // Wraparound borders instead of wall death
    if (next.x < 0) next.x = mapSize - 1;
    if (next.x >= mapSize) next.x = 0;
    if (next.y < 0) next.y = mapSize - 1;
    if (next.y >= mapSize) next.y = 0;

    const hitSnakeId = occupancy.get(`${next.x}:${next.y}`);

    if (hitSnakeId) {
      const killer = room.players.get(hitSnakeId);
      
      // In team mode, check for friendly fire
      if (room.options.gameMode === "team" && killer && player.team && killer.team === player.team) {
        // Friendly fire - both players collide and die
        const victim = player;
        const victimLength = victim.body.length;
        
        // Decompose victim's body into food
        victim.body.forEach(part => {
          room.decomposedFood.push({
            x: part.x,
            y: part.y,
            expiresAt: now + 10000, // 10 seconds
          });
        });
        
        victim.alive = false;
        broadcast(room, {
          type: "system",
          message: `${victim.name} crashed into teammate ${killer.name}!`,
        });
        setTimeout(() => respawnPlayer(room, victim), 1200);
        continue;
      }
      
      // Snake collision - player dies
      const victim = player;
      const victimLength = victim.body.length;
      
      // Calculate kill bonus based on victim's size
      const baseKillBonus = 30;
      const killBonus = Math.floor(baseKillBonus + victimLength * 5);
      
      // Award bonus to killer (more points for killing bigger snakes)
      if (killer && killer.alive) {
        killer.score += killBonus;
        killer.grow += Math.floor(victimLength / 3); // Grow based on victim size
        
        // In team mode, award points to team as well
        if (room.options.gameMode === "team" && killer.team) {
          room.teamScores[`team${killer.team}`] += killBonus;
        }
        
        broadcast(room, {
          type: "system",
          message: `${killer.name} eliminated ${victim.name}! +${killBonus} pts`,
        });
      }
      
      // Decompose victim's body into food
      victim.body.forEach(part => {
        room.decomposedFood.push({
          x: part.x,
          y: part.y,
          expiresAt: now + 10000, // 10 seconds
        });
      });
      
      victim.alive = false;
      setTimeout(() => respawnPlayer(room, victim), 1200);
      continue;
    }

    player.body.unshift(next);
    occupancy.set(`${next.x}:${next.y}`, player.id);

    let consumed = false;
    
    // Check regular food
    if (room.food && next.x === room.food.x && next.y === room.food.y) {
      player.grow += 1;
      player.score += 10;
      consumed = true;
      spawnFood(room);
    }

    // Check bonus food
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
    
    // Check decomposed food (blue food from dead snakes)
    const decomposedIndex = room.decomposedFood.findIndex(
      f => f.x === next.x && f.y === next.y
    );
    if (decomposedIndex !== -1) {
      player.grow += 1;
      player.score += 15; // Slightly more than regular food
      room.decomposedFood.splice(decomposedIndex, 1);
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
  // Also broadcast to spectators
  if (room.spectators) {
    for (const spectator of room.spectators.values()) {
      if (spectator.ws.readyState === spectator.ws.OPEN) {
        spectator.ws.send(payload);
      }
    }
  }
}

function broadcastTeamLobby(room) {
  const teams = {
    team1: room.teams.team1.map(id => {
      const p = room.players.get(id);
      return p ? { id: p.id, name: p.name } : null;
    }).filter(Boolean),
    team2: room.teams.team2.map(id => {
      const p = room.players.get(id);
      return p ? { id: p.id, name: p.name } : null;
    }).filter(Boolean),
  };
  
  broadcast(room, {
    type: "team_lobby_update",
    teams,
  });
}

function selectTeam(room, playerId, teamNum) {
  const player = room.players.get(playerId);
  if (!player) return;
  
  // Remove from both teams first
  room.teams.team1 = room.teams.team1.filter(id => id !== playerId);
  room.teams.team2 = room.teams.team2.filter(id => id !== playerId);
  
  // Add to selected team
  if (teamNum === 1) {
    room.teams.team1.push(playerId);
    player.team = 1;
  } else if (teamNum === 2) {
    room.teams.team2.push(playerId);
    player.team = 2;
  }
  
  broadcastTeamLobby(room);
}

function startMatch(room) {
  if (room.matchStarted) return;
  
  // Validate teams
  if (room.teams.team1.length === 0 || room.teams.team2.length === 0) {
    return false;
  }
  
  if (room.teams.team1.length + room.teams.team2.length < 2) {
    return false;
  }
  
  room.matchStarted = true;
  
  // Spawn all players
  for (const player of room.players.values()) {
    respawnPlayer(room, player);
  }
  
  // Start game loop
  spawnFood(room);
  scheduleBonus(room);
  startLoop(room);
  
  // Notify all players
  for (const player of room.players.values()) {
    player.ws.send(stringify({
      type: "match_started",
      myTeam: player.team,
      isSpectator: false,
    }));
  }
  
  broadcastState(room);
  return true;
}

function broadcastState(room) {
  const snapshot = {
    type: "state",
    food: room.food,
    bonusFood: room.bonusFood,
    decomposedFood: room.decomposedFood.map(f => ({ x: f.x, y: f.y })), // Send decomposed food to clients
    mapSize: room.options.mapSize,
    players: [],
    leaderboard: [],
    hostId: room.hostId,
    endAt: room.endAt,
    ended: room.ended,
    gameMode: room.options.gameMode,
    teamScores: room.teamScores,
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
      team: player.team,
    });
    scores.push({ 
      id: player.id, 
      name: player.name, 
      score: player.score,
      team: player.team,
    });
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
    } else if (message.type === "select_team" && currentRoom && currentPlayer) {
      if (currentRoom.options.gameMode !== "team") {
        ws.send(stringify({ type: "error", message: "Not in team mode." }));
        return;
      }
      if (currentRoom.matchStarted) {
        ws.send(stringify({ type: "error", message: "Match already started." }));
        return;
      }
      selectTeam(currentRoom, currentPlayer.id, message.team);
    } else if (message.type === "start_match" && currentRoom && currentPlayer) {
      if (currentRoom.options.gameMode !== "team") {
        ws.send(stringify({ type: "error", message: "Not in team mode." }));
        return;
      }
      if (currentPlayer.id !== currentRoom.hostId) {
        ws.send(stringify({ type: "error", message: "Only host can start match." }));
        return;
      }
      if (!startMatch(currentRoom)) {
        ws.send(stringify({ type: "error", message: "Need at least 1 player per team." }));
      }
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
      // Check if spectator
      if (currentRoom.spectators && currentRoom.spectators.has(currentPlayer.id)) {
        currentRoom.spectators.delete(currentPlayer.id);
        broadcast(currentRoom, {
          type: "system",
          message: `${currentPlayer.name} (spectator) left.`,
        });
        return;
      }
      
      // Regular player leaving
      currentRoom.players.delete(currentPlayer.id);
      
      // Remove from teams if in team mode
      if (currentRoom.options.gameMode === "team") {
        currentRoom.teams.team1 = currentRoom.teams.team1.filter(id => id !== currentPlayer.id);
        currentRoom.teams.team2 = currentRoom.teams.team2.filter(id => id !== currentPlayer.id);
      }
      
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
      }
      
      // Update team lobby or game state
      if (currentRoom.options.gameMode === "team" && !currentRoom.matchStarted) {
        broadcastTeamLobby(currentRoom);
      } else {
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


const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const landing = document.getElementById("landing");
const play = document.getElementById("play");

const statusEl = document.getElementById("status");
const roomLabel = document.getElementById("room-label");
const timerLabel = document.getElementById("timer-label");

const board = document.getElementById("board");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayBody = document.getElementById("overlay-body");
const overlayLeaders = document.getElementById("overlay-leaders");

const leadersEl = document.getElementById("leaders");
const copyBtn = document.getElementById("copy-link");
const endRoomBtn = document.getElementById("end-room-btn");
const exitBtn = document.getElementById("exit-btn");

const createBtn = document.getElementById("create-btn");
const joinBtn = document.getElementById("join-btn");
const createNameInput = document.getElementById("create-name");
const joinNameInput = document.getElementById("join-name");
const roomCodeInput = document.getElementById("room-code");
const mapSizeInput = document.getElementById("map-size");
const speedInput = document.getElementById("speed");
const maxPlayersInput = document.getElementById("max-players");
const timerMinutesInput = document.getElementById("timer-minutes");

const mapSizeValue = document.getElementById("map-size-value");
const speedValue = document.getElementById("speed-value");
const maxPlayersValue = document.getElementById("max-players-value");
const timerValue = document.getElementById("timer-value");

let logicalSize = 0;

let socket = null;
let playerId = null;
let roomCode = null;
let isHost = false;
let connected = false;
// roundRect fallback for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const radius = Math.min(r || 0, w / 2, h / 2);
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + w - radius, y);
    this.quadraticCurveTo(x + w, y, x + w, y + radius);
    this.lineTo(x + w, y + h - radius);
    this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    this.lineTo(x + radius, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
  };
}

let endAt = null;
let roomEnded = false;

let lastState = {
  players: [],
  food: null,
  bonusFood: null,
  mapSize: 32,
  leaderboard: [],
  hostId: null,
  endAt: null,
  ended: false,
};

function updateSliderDisplay() {
  mapSizeValue.textContent = mapSizeInput.value;
  speedValue.textContent = speedInput.value;
  maxPlayersValue.textContent = maxPlayersInput.value;
  timerValue.textContent = timerMinutesInput.value;
}

mapSizeInput.addEventListener("input", updateSliderDisplay);
speedInput.addEventListener("input", updateSliderDisplay);
maxPlayersInput.addEventListener("input", updateSliderDisplay);
timerMinutesInput.addEventListener("input", updateSliderDisplay);
updateSliderDisplay();

function go(view) {
  if (view === "play") {
    landing.classList.add("hidden");
    play.classList.remove("hidden");
  } else {
    landing.classList.remove("hidden");
    play.classList.add("hidden");
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function setOverlay(title, body, show = true, leaders = []) {
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  overlay.classList.toggle("hidden", !show);
  overlayLeaders.innerHTML = "";
  leaders.forEach((entry) => {
    const li = document.createElement("li");
    li.textContent = `${entry.name}: ${entry.score}`;
    overlayLeaders.appendChild(li);
  });
}

function connect(type) {
  if (socket) {
    socket.close();
  }

  const wsProtocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${wsProtocol}://${location.host}`);

  const name =
    type === "create"
      ? createNameInput.value.trim() || "host"
      : joinNameInput.value.trim() || "guest";

  const payload =
    type === "create"
      ? {
          type: "create_room",
          name,
          options: {
            mapSize: Number(mapSizeInput.value),
            speed: Number(speedInput.value),
            maxPlayers: Number(maxPlayersInput.value),
            timerMinutes: Number(timerMinutesInput.value),
          },
        }
      : {
          type: "join_room",
          name,
          roomCode: roomCodeInput.value.trim().toUpperCase(),
        };

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify(payload));
    setStatus("Connecting…");
  });

  socket.addEventListener("message", (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (err) {
      return;
    }
    handleMessage(data);
  });

  socket.addEventListener("close", () => {
    connected = false;
    setStatus("Disconnected.");
    setOverlay("Disconnected", "Create or join a room to play again.");
    go("landing");
  });
}

function handleMessage(message) {
  switch (message.type) {
    case "joined": {
      connected = true;
      playerId = message.playerId;
      roomCode = message.roomCode;
      lastState.mapSize = message.options?.mapSize || 32;
      lastState.hostId = message.hostId;
      endAt = message.endAt || null;
      roomEnded = false;
      isHost = message.hostId === playerId;
      setStatus("In room.");
      roomLabel.textContent = `Room ${roomCode}`;
      timerLabel.hidden = !endAt;
      endRoomBtn.hidden = !isHost;
      copyBtn.hidden = false;
      copyBtn.onclick = () => {
        const url = `${location.origin}?room=${roomCode}`;
        navigator.clipboard.writeText(url);
        copyBtn.textContent = "Link copied";
        setTimeout(() => (copyBtn.textContent = "Copy invite"), 1000);
      };
      setOverlay(
        "Quiet start",
        "Use WASD / arrows. Avoid walls and bodies.",
        false,
      );
      go("play");
      break;
    }
    case "state": {
      lastState = {
        ...lastState,
        ...message,
      };
      endAt = message.endAt || null;
      roomEnded = message.ended || false;
      isHost = message.hostId === playerId;
      endRoomBtn.hidden = !isHost;
      timerLabel.hidden = !endAt;
      updateLeaderboard(message.leaderboard || []);
      break;
    }
    case "room_ended": {
      roomEnded = true;
      setStatus("Room ended.");
      setOverlay("Room closed", "Final board", true, message.leaderboard || []);
      updateLeaderboard(message.leaderboard || []);
      break;
    }
    case "system":
      setStatus(message.message);
      break;
    case "error":
      setStatus(message.message || "Error.");
      setOverlay("Oops", message.message || "Something went wrong.");
      break;
    default:
      break;
  }
}

function updateLeaderboard(entries) {
  leadersEl.innerHTML = "";
  entries.forEach((item) => {
    const li = document.createElement("li");
    const you = item.id === playerId ? " (you)" : "";
    li.textContent = `${item.name}: ${item.score}${you}`;
    leadersEl.appendChild(li);
  });
}

function sendDirection(dir) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ type: "change_dir", dir }));
}

window.addEventListener(
  "keydown",
  (e) => {
    const key = e.key.toLowerCase();
    const focusedInput = document.activeElement?.tagName === "INPUT";
    if (
      !focusedInput &&
      ["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)
    ) {
      e.preventDefault();
    }
    if (["arrowup", "w"].includes(key)) sendDirection("up");
    if (["arrowdown", "s"].includes(key)) sendDirection("down");
    if (["arrowleft", "a"].includes(key)) sendDirection("left");
    if (["arrowright", "d"].includes(key)) sendDirection("right");
  },
  { passive: false },
);

createBtn.addEventListener("click", () => connect("create"));
joinBtn.addEventListener("click", () => connect("join"));
exitBtn.addEventListener("click", () => leaveGame());
endRoomBtn.addEventListener("click", () => {
  if (!isHost) return;
  socket?.send(JSON.stringify({ type: "end_room" }));
});

function leaveGame() {
  socket?.close();
  socket = null;
  playerId = null;
  roomCode = null;
  isHost = false;
  endAt = null;
  roomEnded = false;
  lastState = {
    ...lastState,
    players: [],
    food: null,
    bonusFood: null,
    leaderboard: [],
    hostId: null,
    endAt: null,
  };
  setStatus("Not connected.");
  setOverlay("Welcome", "Create or join a room to play.");
  go("landing");
}

function drawGrid(size, cell) {
  // No grid - clean minimalist look
}

function drawFood(food, cell, color, sizeFactor = 0.8) {
  const size = cell * sizeFactor;
  const x = food.x * cell + (cell - size) / 2;
  const y = food.y * cell + (cell - size) / 2;
  
  // Pixelated square food - no rounded corners
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  
  // Simple highlight square in corner for depth
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(x, y, size * 0.4, size * 0.4);
}

function drawSnake(player, cell) {
  // Draw snake with pixelated square design
  player.body.forEach((part, idx) => {
    const x = part.x * cell;
    const y = part.y * cell;
    const size = cell - 4;
    
    // Main body segment - square, no rounded corners
    ctx.fillStyle = player.color;
    ctx.fillRect(x + 2, y + 2, size, size);
    
    // Simple square highlight in corner
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x + 2, y + 2, size * 0.3, size * 0.3);
  });

  // Draw pixelated square eyes on head
  const head = player.body[0];
  if (head) {
    const x = head.x * cell;
    const y = head.y * cell;
    const eyeSize = 4;
    
    // Left eye (white square)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + cell / 2 - 8, y + cell / 2 - 5, eyeSize, eyeSize);
    
    // Right eye (white square)
    ctx.fillRect(x + cell / 2 + 4, y + cell / 2 - 5, eyeSize, eyeSize);
    
    // Pupils (black squares)
    ctx.fillStyle = "#000000";
    const pupilSize = 2;
    ctx.fillRect(x + cell / 2 - 7, y + cell / 2 - 4, pupilSize, pupilSize);
    ctx.fillRect(x + cell / 2 + 5, y + cell / 2 - 4, pupilSize, pupilSize);
  }
}

function resizeCanvas() {
  const bounds = board.getBoundingClientRect();
  // Use 98% of the available space for maximum size
  const maxSize = Math.floor(Math.min(bounds.width, bounds.height) * 0.98);
  const cell = Math.max(14, Math.floor(maxSize / lastState.mapSize));
  const renderSize = Math.max(450, cell * lastState.mapSize);
  const ratio = window.devicePixelRatio || 1;

  logicalSize = renderSize;
  canvas.style.width = `${renderSize}px`;
  canvas.style.height = `${renderSize}px`;
  canvas.width = Math.floor(renderSize * ratio);
  canvas.height = Math.floor(renderSize * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function render() {
  const { mapSize, players, food, bonusFood } = lastState;
  const ratio = window.devicePixelRatio || 1;
  const cell = Math.max(8, Math.floor(logicalSize / mapSize));

  // Clean flat background
  ctx.fillStyle = "#fafafa";
  ctx.fillRect(0, 0, logicalSize * ratio, logicalSize * ratio);

  // No grid - clean look

  if (food) {
    drawFood(food, cell, "#66bb6a");
  }

  if (bonusFood) {
    drawFood(bonusFood, cell, "#ef5350", 1);
  }

  players.forEach((p) => drawSnake(p, cell));

  if (endAt) {
    const remaining = Math.max(0, endAt - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerLabel.textContent = `Timer ${mins}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);

// Landing page form toggling
const modeSelector = document.getElementById("mode-selector");
const formsContainer = document.getElementById("forms-container");
const createForm = document.getElementById("create-form");
const joinForm = document.getElementById("join-form");
const showCreateBtn = document.getElementById("show-create-btn");
const showJoinBtn = document.getElementById("show-join-btn");
const backFromCreate = document.getElementById("back-from-create");
const backFromJoin = document.getElementById("back-from-join");

function showCreateForm() {
  modeSelector.style.display = "none";
  formsContainer.style.display = "block";
  createForm.style.display = "block";
  joinForm.style.display = "none";
}

function showJoinForm() {
  modeSelector.style.display = "none";
  formsContainer.style.display = "block";
  createForm.style.display = "none";
  joinForm.style.display = "block";
}

function showModeSelector() {
  modeSelector.style.display = "flex";
  formsContainer.style.display = "none";
  createForm.style.display = "none";
  joinForm.style.display = "none";
}

showCreateBtn.addEventListener("click", showCreateForm);
showJoinBtn.addEventListener("click", showJoinForm);
backFromCreate.addEventListener("click", showModeSelector);
backFromJoin.addEventListener("click", showModeSelector);

// Check for invite link
const params = new URLSearchParams(location.search);
const roomFromUrl = params.get("room");
if (roomFromUrl) {
  roomCodeInput.value = roomFromUrl;
  showJoinForm();
}

setOverlay("Welcome", "Create or join a room to play.");


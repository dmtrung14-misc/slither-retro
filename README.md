# Slither Retro

Retro-flavored multiplayer snake/slither game with shareable rooms, customizable settings, and lightweight WebSocket backend.

## Features
- 1–4 players per room with invite links and room codes
- Adjustable map size, speed, max player slots, and optional room timer
- Always-on green orb plus occasional red bonus orb (+50, extra growth)
- Server-authoritative collisions, scoring, and top-5 leaderboard
- Minimal two-stage flow: landing screen → game screen with exit/end-room controls

## Running locally
```bash
npm install
npm start
# open http://localhost:3000
```

## How to play
- Create a room (nickname, map size, speed, slots, optional timer) or join with a code.
- Move with WASD/arrow keys. Avoid walls and other snakes.
- Green orb: +10 points, grows tail. Big red bonus: +50 and extra growth.
- Host can end the room early; timer will end the room and show the final leaderboard.
- Share the invite link (copies room code via clipboard) for friends to join.
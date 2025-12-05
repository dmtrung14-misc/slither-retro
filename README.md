# 🐍 Slither Retro

A competitive multiplayer snake game with a clean, pixelated aesthetic inspired by Crossy Road. Built for intense PvP action with wraparound borders, kill bonuses, and body decomposition mechanics.

![Slither Retro](assets/banner.png)

## ✨ Features

### 🎮 Competitive Gameplay
- **PvP-Focused**: Eliminate opponents to earn massive bonuses
- **Wraparound Borders**: No walls—snakes seamlessly cross from edge to edge
- **Kill Rewards**: Earn points and growth based on your victim's size
- **Body Decomposition**: Eliminated snakes leave behind collectible remains for 10 seconds

### 🎨 Clean Pixelated Design
- Minimalist Crossy Road-inspired aesthetic
- No glow effects or visual noise—pure, crisp squares
- Monospace typography and bold borders throughout
- Satisfying box-shadow animations on all interactions

### 🎯 Game Mechanics
- **Green Food** (+10 pts): Standard growth
- **Red Bonus** (+50 pts): Rare spawns with extra growth
- **Blue Remains** (+15 pts): Collect from eliminated players
- **Kill Bonus**: 30 + (victim's length × 5) points
- **Dynamic Scoring**: Bigger victims = bigger rewards

### 👥 Multiplayer
- 1-4 players per room with shareable invite links
- Host controls: Adjustable map size (16-64), speed (1-5), player slots, and optional timer
- Real-time leaderboard with top 5 players
- Room codes for easy joining

### 🎭 Smooth UX
- Two-stage flow: Clean landing → immersive game screen
- Conditional form display (Create/Join only shows when needed)
- Auto-populated room codes from invite links
- WebSocket-based real-time updates

## 🚀 Quick Start

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
# Opens on http://localhost:3000
```

### Production
```bash
npm start
```

## 🎯 How to Play

### Getting Started
1. **Create a Room** or **Enter Room** from the landing page
2. Customize settings (host only):
   - Map size: 16-64 tiles
   - Speed: 1-5 (faster = harder)
   - Max players: 1-4
   - Timer: 0-30 minutes (optional)
3. Share the invite link with friends

### Controls
- **WASD** or **Arrow Keys** to move
- No reversing allowed (can't go back on yourself)

### Scoring System
| Item | Points | Effect |
|------|--------|--------|
| Green Food 🟢 | +10 | Standard growth |
| Red Bonus 🔴 | +50 | Extra growth burst |
| Blue Remains 🔵 | +15 | From eliminated players |
| **Player Kill** 💀 | **30 + (victim size × 5)** | **Major bonus + growth** |

### Strategy Tips
- 🎯 Hunt larger snakes for bigger kill bonuses
- 🔄 Use wraparound borders to escape or ambush
- 💎 Collect blue remains after kills for quick recovery
- ⚡ Speed setting affects tick rate—higher speeds = faster reactions needed
- 🧠 Remember: Eliminated snakes respawn, but their remains vanish after 10s

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript + Canvas API
- **Backend**: Node.js + Express + WebSocket (ws)
- **Styling**: Custom CSS with pixelated design system
- **State Management**: Server-authoritative game loop

## 📁 Project Structure

```
slither-retro/
├── public/
│   ├── client.js       # Game rendering & client logic
│   ├── index.html      # Main HTML structure
│   └── style.css       # Pixelated design system
├── server.js           # WebSocket server & game logic
├── package.json
└── README.md
```

## 🎮 Game Logic Highlights

### Collision Detection
- **Player vs Player**: Victim decomposes, killer gains bonus
- **Player vs Food**: Growth and points
- **Border Collision**: Wraparound (no death)

### Server Authority
- All game state managed server-side
- Client receives updates via WebSocket
- Prevents cheating and ensures synchronization

### Tick System
- Base tick: 140ms
- Adjusted by speed: `max(60ms, 140ms - (speed - 1) × 18)`
- Speed 5 = 68ms tick (very fast!)

## 🎨 Design Philosophy

![Gameplay](assets/gameplay.png)

This game embraces a **brutalist, pixelated aesthetic**:
- ✅ Sharp squares and hard borders
- ✅ Monospace fonts (Courier New)
- ✅ Box shadows instead of soft shadows
- ✅ No rounded corners, no gradients, no glow effects
- ✅ Flat colors with minimal highlights
- ✅ Crisp, pixelated rendering

Inspired by Crossy Road's clean visual language and Agar.io's competitive multiplayer dynamics.

## 🤝 Contributing

Feel free to fork, modify, and submit PRs! Some ideas:
- Additional power-ups
- More player slots
- Spectator mode
- Tournament brackets
- Custom color palettes

## 📝 License

MIT License - feel free to use this for your own projects!

## 🎯 Roadmap

- [ ] Spectator mode
- [ ] Better mobile support (touch controls)
- [ ] Replay system
- [ ] Achievement system
- [ ] Custom game modes (team battle, capture the flag, etc.)

---

**Built with 💜 by a developer who thinks glowing effects are overrated**

Enjoy the game! 🐍✨

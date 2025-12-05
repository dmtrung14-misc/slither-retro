# Team Deathmatch Mode Guide

## Overview
Team Deathmatch is a new game mode that adds competitive team-based gameplay to Slither Retro. Players can form teams of their choice and compete for the highest team score.

## Features Implemented

### 1. Game Mode Selection
- When creating a room, hosts can now choose between "Classic" and "Team Deathmatch" modes
- Classic mode works exactly as before
- Team Deathmatch mode routes players to a team selection lobby

### 2. Team Selection Lobby
- After joining a Team Deathmatch room, players enter a lobby
- Two teams available: Team 1 (Red border) and Team 2 (Cyan border)
- Players can switch teams freely before match starts
- Real-time updates show which players are on each team
- Host sees a "Start Match" button once teams are ready

### 3. Team Match Rules
- Minimum 2 players required to start (can be 1v1, 2v2, 1v3, etc.)
- Both teams must have at least 1 player
- Once match starts, late joiners become spectators

### 4. Spectator Mode
- Players joining after a Team Deathmatch has started automatically become spectators
- Spectators can watch the game but cannot control any snake
- "SPECTATOR" badge displayed in the UI
- Spectators receive all game state updates in real-time

### 5. Visual Team Indicators
- Each snake has a colored border indicating their team:
  - Team 1: Red border (#FF6B6B)
  - Team 2: Cyan border (#4ECDC4)
- Team scores displayed prominently in the leaderboard
- Leaderboard entries color-coded by team

### 6. Team Gameplay Mechanics
- **Friendly Fire**: Colliding with teammates still causes death (be careful!)
- **Team Scoring**: Kill bonuses are added to both individual AND team scores
- **No Friendly Kills**: No bonus points for teammate collisions
- Team scores accumulate throughout the match

## How to Play

### For Host:
1. Create a room
2. Select "Team Deathmatch" from Game Mode dropdown
3. Configure other settings (map size, speed, etc.)
4. Click "Start Room"
5. Choose your team in the lobby
6. Wait for other players to join and choose teams
7. Click "Start Match" when ready

### For Players:
1. Join a Team Deathmatch room via room code or invite link
2. In the lobby, click "Join Team 1" or "Join Team 2"
3. You can switch teams before the match starts
4. Wait for host to start the match
5. Play and cooperate with your team!

### For Late Joiners:
1. If you join after match starts, you become a spectator
2. Watch the action unfold
3. Wait for the next match to play

## Strategy Tips

- **Coordinate with teammates**: Use the wraparound borders to trap opponents between team members
- **Protect your team**: Block enemy snakes from attacking teammates
- **Watch friendly fire**: Don't crash into your own team!
- **Size advantage**: Bigger snakes = bigger kill bonuses for your team
- **Map control**: Spread out to cover more territory and food spawns

## Technical Details

### Server-Side Changes:
- Added `gameMode` option to room creation
- Team management with `teams` object tracking team1/team2 player IDs
- `matchStarted` flag prevents spectators from playing
- `spectators` Map for tracking spectator connections
- Team score tracking in `teamScores` object
- Friendly fire detection in collision logic

### Client-Side Changes:
- New team lobby screen (`#team-lobby`)
- Team selection UI with real-time updates
- Visual team indicators in snake rendering
- Team scores display in leaderboard
- Spectator mode support with control restrictions

## Future Enhancements

Potential additions for team mode:
- Team chat
- Best of 3/5 match series
- Team power-ups
- Capture the flag variant
- King of the hill team mode
- Tournament bracket system

## Testing Checklist

- [ ] Create Team Deathmatch room
- [ ] Join room and select teams
- [ ] Switch teams in lobby
- [ ] Start match with 2+ players
- [ ] Verify team borders display correctly
- [ ] Test friendly fire collision
- [ ] Test enemy collision with team score update
- [ ] Test late joiner becoming spectator
- [ ] Verify spectator cannot control snake
- [ ] Check team scores update correctly
- [ ] Test leaving/rejoining during lobby
- [ ] Test host leaving and host migration

---

**Enjoy the new team mode!** 🎮🐍

# Tanks-A-Lot

A classic 2D tank artillery game inspired by Scorched Earth, built as a Progressive Web App using TypeScript.

## Features

### Game Modes
- **1 Player**: Battle against an AI-controlled tank
- **2 Players**: Hot-seat multiplayer on the same device

### Gameplay
- **Turn-based combat**: Players alternate turns aiming and firing
- **Random terrain**: Each level features procedurally generated terrain
- **Physics simulation**: Realistic projectile motion affected by gravity and wind
- **Terrain deformation**: Explosions create craters that settle like viscous sand (no overhangs)
- **Wind system**: Random wind each round affects projectile trajectory
- **Economic system**: Earn money for victories, spend on weapons and upgrades

### Weapons Arsenal
1. **Normal** ($0) - Standard shell
2. **Napalm** ($100) - Creates spreading fire damage (Radius: 40, Damage: 40)
3. **MIRV** ($200) - Multiple Independent Reentry Vehicle (Radius: 25, Damage: 25 each)
4. **Funky Bomb** ($150) - Bouncing projectile (Radius: 30, Damage: 35)
5. **Laser** ($300) - Precision direct-fire weapon (Radius: 5, Damage: 50)
6. **Digger** ($250) - Tunnels through terrain (Radius: 35, Damage: 40)
7. **Nuke** ($500) - Massive explosion (Radius: 100, Damage: 100)
8. **Black Hole** ($1000) - Gravitational weapon (Radius: 60, Damage: 60)

### Defense & Upgrades
- **Shields** ($200) - Absorbs up to 50 damage
- **Repair Kits** ($150) - Restores 30 health points

### Controls
- **Angle Slider**: Adjust firing angle (0-180°)
- **Power Slider**: Set shot power (10-100%)
- **Weapon Dropdown**: Select which weapon to fire
- **Fire Button**: Launch your shot
- **Keyboard Shortcuts**:
  - Arrow Left/Right: Adjust angle ±5°
  - Arrow Up/Down: Adjust power ±5%
  - Space or Enter: Fire

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm

### Build Instructions
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Serve locally (using Python)
npm run serve
# Or use any HTTP server pointed at the dist/ directory
```

### Play Online
Open `dist/index.html` in a modern web browser after building.

### Install as PWA
When running the game in a browser, you can install it as a Progressive Web App:
1. Look for the install prompt in your browser
2. Click "Install" or use the browser's menu option
3. The game will be added to your apps and can run offline

## Technology Stack
- **TypeScript**: Type-safe game logic
- **HTML5 Canvas**: 2D rendering
- **CSS3**: Responsive styling
- **Service Worker**: PWA offline functionality
- **Web App Manifest**: PWA installation support

## Game Rules
1. Players take turns firing at each other
2. Adjust angle and power to hit your opponent
3. Account for wind when aiming (shown at top of screen)
4. Last tank standing wins the round
5. Winner earns $500 to spend in the shop
6. Purchase special weapons, shields, or repairs between rounds
7. Game continues until one player is victorious

## Credits
Inspired by the classic DOS game [Scorched Earth](https://en.wikipedia.org/wiki/Scorched_Earth_(video_game))

## License
MIT


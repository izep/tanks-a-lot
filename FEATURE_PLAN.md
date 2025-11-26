# Feature Implementation Plan - Tanks-A-Lot
Based on Scorched Earth 1.5 Manual

## Priority Ranking: Most Impactful First

### 🔴 **TIER 1: Core Gameplay Enhancements** (Highest Impact)

#### 1. **Guidance Systems** ⭐⭐⭐⭐⭐
**Impact:** Very High - Dramatically improves gameplay depth and strategy
**Complexity:** Medium
**Features:**
- **Heat Guidance**: Auto-aims at nearest enemy tank when projectile gets close
- **Ballistic Guidance**: Calculates optimal power based on angle to hit target
- **Horizontal Guidance**: Projectile flies horizontally when aligned with target
- **Vertical Guidance**: Projectile drops straight down when above target
- **Lazy Boy**: Ultimate guidance - click target and it hits (with some skill requirement)

**Implementation:**
- Add guidance system selection to Tank Control Panel
- Modify projectile update logic to apply guidance corrections
- Add target selection UI (click or number key for tank selection)
- Store guidance type on Projectile class
- Guidance systems consumed on use

**Estimated Effort:** 2-3 days

---

#### 2. **Contact Triggers** ⭐⭐⭐⭐⭐
**Impact:** Very High - Essential for controlling weapon behavior
**Complexity:** Low
**Features:**
- Toggle tunneling on/off per shot
- Projectile explodes immediately on contact with terrain
- Useful for napalm, diggers, and other weapons that need surface explosions

**Implementation:**
- Add `useContactTrigger` boolean to Tank
- Add toggle in Tank Control Panel or HUD
- Modify projectile collision detection to check trigger state
- Visual indicator when triggers are active

**Estimated Effort:** 1 day

---

#### 3. **Tank Movement with Fuel** ⭐⭐⭐⭐
**Impact:** High - Adds tactical positioning element
**Complexity:** Medium
**Features:**
- Tanks can move left/right using fuel
- Fuel consumed based on distance and terrain slope
- Cannot climb too steep hills
- Tanks can slip/fall on steep descents
- Movement panel accessible via 'f' key or fuel icon

**Implementation:**
- Add `fuel` property to Tank class
- Add fuel tank shop item
- Create movement control panel
- Implement terrain collision for movement
- Add falling damage when tank slips
- Update tank position based on terrain after movement

**Estimated Effort:** 2 days

---

#### 4. **Enhanced Weapon Types** ⭐⭐⭐⭐
**Impact:** High - More variety and strategy
**Complexity:** Medium
**Priority Weapons:**
- **Rollers**: Roll downhill until hitting valley or tank
- **Dirt Clods/Balls**: Explode into dirt spheres (bury enemies)
- **Baby Roller**: Smaller version of roller
- **Riot Charges**: Destroy wedge of dirt around turret (unbury self)
- **Tracers**: Non-destructive targeting shots

**Implementation:**
- Add weapon types to constants
- Implement special behaviors in Projectile class
- Add rolling physics for rollers
- Add dirt generation for dirt weapons
- Update shop to include new weapons

**Estimated Effort:** 2-3 days

---

### 🟠 **TIER 2: Defense & Support Systems** (High Impact)

#### 5. **Parachutes** ⭐⭐⭐⭐
**Impact:** High - Prevents fall damage
**Complexity:** Medium
**Features:**
- Deploy/passive toggle
- Safety threshold setting (1-100)
- Auto-activate when fall damage exceeds threshold
- Prevents damage from falling (unless landing on enemy)

**Implementation:**
- Add parachute properties to Tank
- Add parachute shop item
- Implement fall damage calculation
- Add parachute activation logic
- Add parachute visual when deployed
- Add to Tank Control Panel

**Estimated Effort:** 1-2 days

---

#### 6. **Batteries & Power Recharge** ⭐⭐⭐
**Impact:** Medium-High - Extends tank lifespan
**Complexity:** Low
**Features:**
- Batteries restore 10 power each
- Can use multiple batteries
- Auto-use when power drops below threshold (optional)
- Required for energy weapons (if implemented)

**Implementation:**
- Add battery inventory to Tank
- Add battery shop item
- Add battery use in Tank Control Panel
- Update power when battery used
- Add battery icon to HUD

**Estimated Effort:** 1 day

---

#### 7. **Enhanced Shield Types** ⭐⭐⭐
**Impact:** Medium - More defensive options
**Complexity:** Low-Medium
**Features:**
- **Force Shield**: Deflects projectiles, more durable
- **Heavy Shield**: Immune to failures, very durable
- **Mag Deflector**: Upward force on projectiles (less effective against fast projectiles)

**Implementation:**
- Add shield types to constants
- Modify shield rendering and behavior
- Add deflection physics for force shields
- Update shop with new shield types

**Estimated Effort:** 1-2 days

---

### 🟡 **TIER 3: UI & Quality of Life** (Medium Impact)

#### 8. **Status Bar** ⭐⭐⭐
**Impact:** Medium - Better information display
**Complexity:** Medium
**Features:**
- Second line below main HUD
- Shows: Max power, battery count, parachute state, shield %, guidance, triggers, fuel
- Clickable icons for quick access
- Keyboard shortcuts (b, p, s, e, g, f, -)

**Implementation:**
- Add status bar HTML/CSS
- Populate with tank data
- Add click handlers for icons
- Add keyboard shortcuts
- Make toggleable in settings

**Estimated Effort:** 1-2 days

---

#### 9. **Inventory Panel** ⭐⭐⭐
**Impact:** Medium - Quick access to items
**Complexity:** Low-Medium
**Features:**
- Press 'i' or right-click name to open
- Icon grid of all owned items
- Click weapon icon to select weapon
- Click shield to energize
- Click parachute/trigger to toggle
- Click battery to use
- Click fuel to open movement panel

**Implementation:**
- Create inventory panel UI
- Generate icon grid from tank inventory
- Add click handlers for each item type
- Add keyboard shortcut
- Add visual feedback (flash/beep)

**Estimated Effort:** 1-2 days

---

#### 10. **Enhanced AI Types** ⭐⭐⭐
**Impact:** Medium - Better computer opponents
**Complexity:** High
**AI Types:**
- **Moron**: Random angle/power (current implementation)
- **Shooter**: Straight line shots only
- **Tosser**: Refines aim over time
- **Spoiler**: Perfect shots accounting for wind/gravity
- **Cyborg**: Strategic targeting (weak, winning, or previous attackers)

**Implementation:**
- Create AI strategy classes
- Implement different decision algorithms
- Add AI type selection in player setup
- Update makeAIDecision method with strategy pattern

**Estimated Effort:** 2-3 days

---

### 🟢 **TIER 4: Advanced Features** (Lower Priority)

#### 11. **Teams Mode** ⭐⭐
**Impact:** Medium - Multiplayer coordination
**Complexity:** Medium
**Features:**
- Standard teams (shared goals, separate money)
- Corporate teams (shared bank account)
- Vicious teams (free-for-all when only one team left)
- Team damage penalties

**Implementation:**
- Add team property to Tank
- Modify damage/scoring for team interactions
- Add team selection in player setup
- Update game over logic for teams

**Estimated Effort:** 2 days

---

#### 12. **Weapon Tunneling Improvements** ⭐⭐
**Impact:** Low-Medium - More realistic physics
**Complexity:** Medium
**Features:**
- Projectiles tunnel through dirt at reduced velocity
- Can emerge on other side of small hills
- Contact triggers override tunneling
- Visual tunneling effect

**Implementation:**
- Modify projectile collision detection
- Add velocity reduction on terrain hit
- Continue projectile path through terrain
- Add visual tunneling trail

**Estimated Effort:** 1-2 days

---

#### 13. **Physics Options** ⭐⭐
**Impact:** Low-Medium - Customization
**Complexity:** Medium
**Features:**
- Air viscosity (slows projectiles)
- Adjustable gravity
- Changing wind (wind varies between shots)
- Border effects (concrete, rubber, wraparound)

**Implementation:**
- Add physics settings to game config
- Modify projectile physics for viscosity
- Add wind variation logic
- Implement border collision types

**Estimated Effort:** 2 days

---

#### 14. **Energy Weapons** ⭐
**Impact:** Low - Niche weapons
**Complexity:** Medium
**Features:**
- **Plasma Blast**: Area damage around tank (no aiming needed)
- **Laser**: Already implemented, but could use battery system
- Battery selection after firing

**Implementation:**
- Add plasma blast weapon
- Modify laser to use batteries
- Add battery selection UI after firing
- Implement area damage for plasma

**Estimated Effort:** 1-2 days

---

## Features to Skip (Not Suitable for Web App)

- ❌ **Sound Effects**: Can be added later if desired, but not critical
- ❌ **Save/Restore Games**: Web storage can handle this, but low priority
- ❌ **Talking Tanks**: Fun but not essential
- ❌ **Multiple Configuration Files**: Overkill for web app
- ❌ **Simultaneous Mode**: Complex keyboard handling, low priority
- ❌ **Synchronous Mode**: Interesting but niche
- ❌ **Free Market Economy**: Complex, low priority
- ❌ **Scanned Mountains**: Requires file system access

---

## Recommended Implementation Order

### Phase 1: Core Enhancements (Week 1-2)
1. Contact Triggers (1 day)
2. Tank Movement with Fuel (2 days)
3. Enhanced Weapon Types - Rollers & Dirt Clods (2 days)
4. Parachutes (1-2 days)

### Phase 2: Advanced Systems (Week 3-4)
5. Guidance Systems (2-3 days)
6. Batteries & Power Recharge (1 day)
7. Status Bar (1-2 days)
8. Inventory Panel (1-2 days)

### Phase 3: Polish & Variety (Week 5+)
9. Enhanced AI Types (2-3 days)
10. Enhanced Shield Types (1-2 days)
11. Teams Mode (2 days)
12. Weapon Tunneling Improvements (1-2 days)

---

## Quick Wins (Can be done immediately)
- Contact Triggers (1 day)
- Batteries (1 day)
- Enhanced Shield Types (1-2 days)
- Status Bar (1-2 days)

---

## Notes
- All features should maintain current code quality standards
- Features should be toggleable/optional where possible
- Consider mobile responsiveness for all UI additions
- Test thoroughly with different screen sizes
- Maintain backward compatibility with existing saves (if implemented)

// Game Configuration Constants
export const GAME_CONFIG = {
    // Physics
    GRAVITY: 0.5,
    WIND_MIN: -2,
    WIND_MAX: 2,
    WIND_RANGE: 4, // WIND_MAX - WIND_MIN

    // Economy
    INITIAL_MONEY: 1000,
    ROUND_WIN_REWARD: 500,

    // Tank
    INITIAL_HEALTH: 100,
    MAX_HEALTH: 100,
    MAX_SHIELD: 50,
    SHIELD_AMOUNT: 50,
    REPAIR_AMOUNT: 30,

    // Tank positioning
    TANK_Y_OFFSET: 10,

    // Terrain
    TERRAIN_HEIGHT_RATIO: 0.6,
    TERRAIN_SEGMENTS: 10, // Increased for more hill variation
    TERRAIN_HEIGHT_MIN_RATIO: 0.2,
    TERRAIN_HEIGHT_MAX_RATIO: 0.6,
    TERRAIN_NOISE_AMPLITUDE: 10, // Restored some noise for texture
    TERRAIN_MAX_SLOPE: 3,
    TERRAIN_SETTLE_ITERATIONS: 25, // Moderate settling

    // Projectile
    PROJECTILE_SPEED_MULTIPLIER: 0.3, // Controls physics/range
    PROJECTILE_ANIMATION_SPEED_MULTIPLIER: 300.0, // Real-time speed factor for projectile simulation
    PROJECTILE_TRAIL_MAX_LENGTH: 200,
    WIND_EFFECT_MULTIPLIER: 0.01,

    // Explosion
    EXPLOSION_PARTICLE_COUNT: 50,
    EXPLOSION_PARTICLE_COUNT_NUKE: 100,
    EXPLOSION_PARTICLE_SPEED_MIN: 2,
    EXPLOSION_PARTICLE_SPEED_MAX: 7,
    EXPLOSION_PARTICLE_GRAVITY: 0.3,
    EXPLOSION_LIFETIME: 1.0,
    EXPLOSION_LIFETIME_NUKE: 2.0,

    // Timing
    EXPLOSION_DELAY: 2000,
    TURN_DELAY: 1000,
    AI_THINK_DELAY: 1500,
    AI_SHOOT_DELAY: 500,

    // Tank controls
    ANGLE_STEP: 5,
    POWER_STEP: 5,
    ANGLE_MIN: 0,
    ANGLE_MAX: 180,
    POWER_MIN: 10,
    POWER_MAX: 300,

    // Game loop
    MAX_DELTA_TIME: 0.1,
    DEFAULT_DELTA_TIME: 0.016,

    // Tank positioning
    TANK1_X_RATIO: 0.2,
    TANK2_X_RATIO: 0.8,
} as const;

// Weapon Configuration
export interface WeaponConfig {
    name: string;
    value: string;
    cost: number;
    damage: number;
    radius: number;
    description: string;
}

export const WEAPONS: WeaponConfig[] = [
    {
        name: 'Normal',
        value: 'normal',
        cost: 0,
        damage: 30,
        radius: 30,
        description: 'Standard shell'
    },
    {
        name: 'Napalm',
        value: 'napalm',
        cost: 100,
        damage: 40,
        radius: 40,
        description: 'Explodes before hitting, creates spreading fire pools'
    },
    {
        name: 'MIRV',
        value: 'mirv',
        cost: 200,
        damage: 25,
        radius: 25,
        description: 'Splits into 5 warheads at peak altitude'
    },
    {
        name: 'Funky Bomb',
        value: 'funky',
        cost: 150,
        damage: 35,
        radius: 30,
        description: 'Bounces 3 times before exploding'
    },
    {
        name: 'Laser',
        value: 'laser',
        cost: 300,
        damage: 50,
        radius: 5,
        description: 'Precision direct-fire weapon'
    },
    {
        name: 'Digger',
        value: 'digger',
        cost: 250,
        damage: 40,
        radius: 35,
        description: 'Tunnels through terrain before exploding'
    },
    {
        name: 'Baby Digger',
        value: 'babydigger',
        cost: 150,
        damage: 25,
        radius: 20,
        description: 'Smaller tunneling weapon'
    },
    {
        name: 'Nuke',
        value: 'nuke',
        cost: 500,
        damage: 100,
        radius: 100,
        description: 'Massive explosion'
    },
    {
        name: 'Black Hole',
        value: 'blackhole',
        cost: 1000,
        damage: 60,
        radius: 60,
        description: 'Gravitational weapon'
    },
    {
        name: 'Roller',
        value: 'roller',
        cost: 300,
        damage: 30,
        radius: 30,
        description: 'Rolls downhill until hitting tank or valley'
    },
    {
        name: 'Baby Roller',
        value: 'babyroller',
        cost: 200,
        damage: 20,
        radius: 20,
        description: 'Smaller rolling projectile'
    },
    {
        name: 'Dirt Clod',
        value: 'dirtclod',
        cost: 250,
        damage: 20,
        radius: 30,
        description: 'Explodes into dirt sphere, buries enemies'
    },
    {
        name: 'Dirt Ball',
        value: 'dirtball',
        cost: 250,
        damage: 25,
        radius: 40,
        description: 'Larger dirt explosion'
    },
    {
        name: 'Riot Charge',
        value: 'riotcharge',
        cost: 100,
        damage: 0,
        radius: 36,
        description: 'Destroys wedge of dirt around turret (unbury self)'
    },
    {
        name: 'Tracer',
        value: 'tracer',
        cost: 5,
        damage: 0,
        radius: 0,
        description: 'Non-destructive targeting shot'
    }
] as const;

// Shop Items Configuration
export interface ShopItemConfig {
    name: string;
    value: string;
    cost: number;
    description: string;
}

export const SHOP_ITEMS: ShopItemConfig[] = [
    {
        name: 'Shield',
        value: 'shield',
        cost: 200,
        description: 'Absorbs 50 damage'
    },
    {
        name: 'Repair Kit',
        value: 'repair',
        cost: 150,
        description: 'Restores 30 health'
    },
    {
        name: 'Contact Trigger',
        value: 'contact_trigger',
        cost: 1000,
        description: 'Explode on impact. (25 triggers)'
    }
] as const;

// Valid weapon types (for validation)
export const VALID_WEAPON_TYPES = WEAPONS.map(w => w.value);
export const VALID_SHOP_ITEM_TYPES = SHOP_ITEMS.map(i => i.value);

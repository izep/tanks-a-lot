import { describe, it, expect } from 'vitest';
import { Tank } from '../src/tank';
import { GAME_CONFIG } from '../src/constants';

describe('Tank', () => {
    it('clamps angle and power to configured limits', () => {
        const tank = new Tank(0, 0, '#fff');

        tank.setAngle(-10);
        expect(tank.angle).toBe(GAME_CONFIG.ANGLE_MIN);

        tank.setAngle(999);
        expect(tank.angle).toBe(GAME_CONFIG.ANGLE_MAX);

        tank.setPower(-50);
        expect(tank.power).toBe(GAME_CONFIG.POWER_MIN);

        tank.setPower(999);
        expect(tank.power).toBe(GAME_CONFIG.POWER_MAX);
    });

    it('applies damage to shields before health', () => {
        const tank = new Tank(0, 0, '#fff');
        tank.addShield(30);

        tank.takeDamage(20);
        expect(tank.shield).toBe(10);
        expect(tank.health).toBe(GAME_CONFIG.INITIAL_HEALTH);

        tank.takeDamage(20);
        expect(tank.shield).toBe(0);
        expect(tank.health).toBe(GAME_CONFIG.INITIAL_HEALTH - 10);
    });

    it('repairs and recharges within maximums', () => {
        const tank = new Tank(0, 0, '#fff');
        tank.takeDamage(80);
        tank.addShield(100);

        tank.repair(50);
        expect(tank.health).toBe(GAME_CONFIG.INITIAL_HEALTH - 30);

        tank.repair(100);
        expect(tank.health).toBe(GAME_CONFIG.MAX_HEALTH);

        tank.addShield(10);
        expect(tank.shield).toBe(GAME_CONFIG.MAX_SHIELD);
    });

    it('reports alive state based on remaining health', () => {
        const tank = new Tank(0, 0, '#fff');
        expect(tank.isAlive()).toBe(true);

        tank.takeDamage(200);
        expect(tank.isAlive()).toBe(false);
    });
});

describe('Tank Contact Triggers', () => {
    it('should initialize contactTriggers to 0 and useContactTrigger to false', () => {
        const tank = new Tank(0, 0, '#fff');
        expect(tank.contactTriggers).toBe(0);
        expect(tank.useContactTrigger).toBe(false);
    });

    it('should allow toggling useContactTrigger', () => {
        const tank = new Tank(0, 0, '#fff');
        expect(tank.useContactTrigger).toBe(false);
        tank.useContactTrigger = true;
        expect(tank.useContactTrigger).toBe(true);
        tank.useContactTrigger = false;
        expect(tank.useContactTrigger).toBe(false);
    });
});

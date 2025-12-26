import Phaser from 'phaser';
import { AI_PROFILE_OPTIONS } from '../ai/profiles.js';

type GameMode = '1player' | '2player';

interface StartConfig {
    mode: GameMode;
    aiProfile: string;
}

export default class MenuScene extends Phaser.Scene {
    private gameMode: GameMode = '1player';
    private aiIndex = 0;
    private readonly titleKey = 'title-text';
    private readonly modeKey = 'mode-text';
    private readonly aiKey = 'ai-text';
    private readonly startKey = 'start-button';

    constructor() {
        super('menu');
    }

    create() {
        const { width, height } = this.scale;
        const centerX = width / 2;
        const centerY = height / 2;

        this.add.text(centerX, centerY - 160, 'Tanks-A-Lot', {
            fontFamily: 'Arial',
            fontSize: '56px',
            color: '#ffffff',
        }).setOrigin(0.5).setName(this.titleKey);

        this.add.text(centerX, centerY - 60, '', {
            fontFamily: 'Arial',
            fontSize: '28px',
            color: '#ffd166',
        }).setOrigin(0.5).setName(this.modeKey);

        this.add.text(centerX, centerY + 10, '', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#76c7c0',
        }).setOrigin(0.5).setName(this.aiKey);

        const startText = this.add.text(centerX, centerY + 120, 'Click to Deploy', {
            fontFamily: 'Arial',
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#1f487e',
            padding: { x: 20, y: 12 },
        }).setOrigin(0.5).setName(this.startKey).setInteractive({ useHandCursor: true });

        startText.on('pointerover', () => startText.setStyle({ backgroundColor: '#22577a' }));
        startText.on('pointerout', () => startText.setStyle({ backgroundColor: '#1f487e' }));
        startText.on('pointerdown', () => {
            this.startGame();
        });

        this.input.keyboard?.on('keydown-LEFT', () => this.toggleMode());
        this.input.keyboard?.on('keydown-RIGHT', () => this.toggleMode());
        this.input.keyboard?.on('keydown-UP', () => this.changeAI(-1));
        this.input.keyboard?.on('keydown-DOWN', () => this.changeAI(1));
        this.input.keyboard?.on('keydown-ENTER', () => this.startGame());
        this.input.keyboard?.on('keydown-SPACE', () => this.startGame());

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.y < centerY - 20) {
                this.toggleMode();
            } else if (pointer.y < centerY + 80) {
                this.changeAI(1);
            }
        });

        this.refreshText();
    }

    private toggleMode(): void {
        this.gameMode = this.gameMode === '1player' ? '2player' : '1player';
        this.refreshText();
    }

    private changeAI(direction: number): void {
        if (this.gameMode !== '1player') {
            return;
        }
        const total = AI_PROFILE_OPTIONS.length;
        this.aiIndex = (this.aiIndex + direction + total) % total;
        this.refreshText();
    }

    private refreshText(): void {
        const modeLabel = this.children.getByName(this.modeKey) as Phaser.GameObjects.Text | null;
        const aiLabel = this.children.getByName(this.aiKey) as Phaser.GameObjects.Text | null;
        if (modeLabel) {
            modeLabel.setText(`Mode: ${this.gameMode === '1player' ? '1 Player vs AI' : '2 Player Hotseat'}`);
        }
        if (aiLabel) {
            if (this.gameMode === '1player') {
                const profile = AI_PROFILE_OPTIONS[this.aiIndex];
                aiLabel.setText(`Computer Skill: ${profile.label}`);
                aiLabel.setVisible(true);
            } else {
                aiLabel.setVisible(false);
            }
        }
    }

    private startGame(): void {
        const payload: StartConfig = {
            mode: this.gameMode,
            aiProfile: AI_PROFILE_OPTIONS[this.aiIndex]?.id ?? 'moron',
        };
        this.scene.start('battle', payload);
    }
}

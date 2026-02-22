import Matter from 'matter-js';
import { DinoState, Vec2, MAX_FORCE, DINO_COLORS } from 'dino-arena-shared';

interface DinoInfo {
  id: string;
  colorIndex: number;
  name: string;
}

interface DinoBody {
  info: DinoInfo;
  body: Matter.Body;
  alive: boolean;
}

export class PhysicsEngine {
  private engine: Matter.Engine;
  private platformRadius: number;
  private dinoRadius: number;
  private dinos: DinoBody[] = [];

  constructor(platformRadius: number, dinoRadius: number) {
    this.platformRadius = platformRadius;
    this.dinoRadius = dinoRadius;
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 1 },
    });

    // Add friction to slow things down
    this.engine.world.gravity.x = 0;
    this.engine.world.gravity.y = 0;
  }

  initDinos(players: DinoInfo[]): void {
    this.dinos = [];
    Matter.Composite.clear(this.engine.world, false);

    const count = players.length;
    const placementRadius = this.platformRadius * 0.5;

    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      const x = Math.cos(angle) * placementRadius;
      const y = Math.sin(angle) * placementRadius;

      const body = Matter.Bodies.circle(x, y, this.dinoRadius, {
        restitution: 0.8,
        friction: 0.05,
        frictionAir: 0.02,
        mass: 5,
        label: `dino-${players[i].id}`,
      });

      Matter.Composite.add(this.engine.world, body);

      this.dinos.push({
        info: players[i],
        body,
        alive: true,
      });
    }
  }

  applyForce(playerId: string, angle: number, power: number): void {
    const dino = this.dinos.find(d => d.info.id === playerId);
    if (!dino || !dino.alive) return;

    const normalizedPower = (power / 100) * MAX_FORCE;
    const force: Vec2 = {
      x: Math.cos(angle) * normalizedPower,
      y: Math.sin(angle) * normalizedPower,
    };

    Matter.Body.applyForce(dino.body, dino.body.position, force);
  }

  step(dt: number): void {
    Matter.Engine.update(this.engine, dt * 1000);
    this.checkBounds();
  }

  private checkBounds(): void {
    for (const dino of this.dinos) {
      if (!dino.alive) continue;
      const pos = dino.body.position;
      const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
      if (dist > this.platformRadius + this.dinoRadius) {
        dino.alive = false;
        Matter.Composite.remove(this.engine.world, dino.body);
      }
    }
  }

  getDinoStates(): DinoState[] {
    return this.dinos.map(d => ({
      id: d.info.id,
      playerId: d.info.id,
      playerName: d.info.name,
      colorIndex: d.info.colorIndex,
      position: { x: d.body.position.x, y: d.body.position.y },
      velocity: { x: d.body.velocity.x, y: d.body.velocity.y },
      alive: d.alive,
    }));
  }
}

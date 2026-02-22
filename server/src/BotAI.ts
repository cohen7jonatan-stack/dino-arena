import type { DinoState, PlayerInput } from 'dino-arena-shared';

export function generateBotInput(botId: string, allDinos: DinoState[]): PlayerInput {
  const me = allDinos.find(d => d.playerId === botId && d.alive);
  const others = allDinos.filter(d => d.playerId !== botId && d.alive);

  if (!me || others.length === 0) {
    return { angle: Math.random() * Math.PI * 2, power: 50 };
  }

  // Find the nearest opponent
  let nearest = others[0];
  let nearestDist = Infinity;
  for (const other of others) {
    const dx = other.position.x - me.position.x;
    const dy = other.position.y - me.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = other;
    }
  }

  const dx = nearest.position.x - me.position.x;
  const dy = nearest.position.y - me.position.y;
  const baseAngle = Math.atan2(dy, dx);

  // Add random offset (up to ~20 degrees) for unpredictability
  const angleJitter = (Math.random() - 0.5) * 0.7;
  const angle = baseAngle + angleJitter;

  // Power scales with distance, with randomness in 60-100 range
  const power = Math.min(100, Math.max(60, 60 + Math.random() * 40));

  return { angle, power };
}

export const BOT_NAMES = ['Rex', 'Spike', 'Trixie', 'Chomp', 'Cera', 'Raptor', 'Stego', 'Pterry'];

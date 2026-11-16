import type { Gamer, GamePlayersAction } from '../fees.interface';

export interface GamerPair {
  id: string;
  players: Gamer[];
}

export function isStoredGamer(value: unknown): value is Gamer {
  if (typeof value !== 'object' || value === null) return false;
  return 'license' in value && typeof value.license === 'string'
    && 'firstname' in value && typeof value.firstname === 'string'
    && 'lastname' in value && typeof value.lastname === 'string'
    && 'is_member' in value && typeof value.is_member === 'boolean'
    && 'validated' in value && typeof value.validated === 'boolean'
    && 'enabled' in value && typeof value.enabled === 'boolean'
    && 'in_euro' in value && typeof value.in_euro === 'boolean'
    && 'index' in value && typeof value.index === 'number' && Number.isInteger(value.index)
    && 'price' in value && typeof value.price === 'number' && Number.isFinite(value.price)
    && 'game_credits' in value && typeof value.game_credits === 'number'
    && 'debt' in value && typeof value.debt === 'number'
    && 'credit' in value && typeof value.credit === 'number'
    && 'member_id' in value && (value.member_id === null || typeof value.member_id === 'string')
    && 'my_birthday' in value && (value.my_birthday === null || typeof value.my_birthday === 'string')
    && 'photo_url$' in value && value.photo_url$ === null;
}

export function decodeGamePlayers(value: unknown): Gamer[] {
  // Older direct DynamoDB writes encoded the AWSJSON list as a JSON string.
  for (let depth = 0; depth < 2 && typeof value === 'string'; depth++) {
    value = JSON.parse(value);
  }
  const players: unknown = Array.isArray(value) ? value.map(player =>
    typeof player === 'object' && player !== null ? { ...player, photo_url$: null } : player) : value;
  if (!Array.isArray(players) || !players.every(isStoredGamer)) {
    throw new Error('Le format de la liste des joueurs est invalide.');
  }
  return players;
}

export function gamerPairs(gamers: Gamer[]): GamerPair[] {
  const pairs = new Map<string, GamerPair>();
  const indexes = new Set<number>();
  for (const gamer of [...gamers].sort((a, b) => a.index - b.index)) {
    if (!Number.isInteger(gamer.index) || gamer.index < 0 || indexes.has(gamer.index)) {
      throw new Error('La liste contient des positions ambiguës. Vérifiez les paires avant de la modifier.');
    }
    indexes.add(gamer.index);
    const id = gamer.pair_id ?? `legacy-${Math.floor(gamer.index / 2)}`;
    const pair = pairs.get(id) ?? { id, players: [] };
    pair.players.push(gamer);
    if (pair.players.length > 2) throw new Error('Une paire ne peut pas contenir plus de deux joueurs.');
    pairs.set(id, pair);
  }
  return [...pairs.values()];
}

export function rosterSignature(gamers: Gamer[]): string {
  return JSON.stringify(gamerPairs(gamers).map(pair => [pair.id, ...pair.players.map(player => player.license)]));
}

export function changePairPlayers(
  gamers: Gamer[],
  action: Exclude<GamePlayersAction, { type: 'check-in' }>,
  newPairId: string,
): Gamer[] {
  const pairs = gamerPairs(gamers);
  const current = pairs.flatMap(pair => pair.players.map(player => ({ ...player, pair_id: pair.id })));
  const verifyNewPlayer = (player: Gamer) => {
    if (!/^\d{8}$/.test(player.license) || player.license === '00000000') {
      throw new Error('Sélectionnez un joueur disposant d’une licence valide.');
    }
    if (current.some(existing => existing.license === player.license
      || (player.ffb_person_id != null && existing.ffb_person_id === player.ffb_person_id))) {
      throw new Error(`${player.firstname} ${player.lastname} est déjà inscrit dans ce tournoi.`);
    }
  };
  const freshPlayer = (player: Gamer, index: number, pairId: string): Gamer => ({
    ...player, index, pair_id: pairId, validated: false, enabled: true, in_euro: false,
    photo_url$: null, check_in_updated_at: undefined, check_in_updated_by: undefined, check_in_source: undefined,
  });
  if (action.type === 'add') {
    if (action.players.length !== 2) throw new Error('Sélectionnez les deux joueurs de la paire.');
    action.players.forEach(verifyNewPlayer);
    const [first, second] = action.players;
    if (first.license === second.license
      || (first.ffb_person_id != null && first.ffb_person_id === second.ffb_person_id)) {
      throw new Error('Les deux joueurs doivent être différents.');
    }
    const nextIndex = Math.max(-1, ...current.map(player => player.index)) + 1;
    return [...current, ...action.players.map((player, offset) => freshPlayer(player, nextIndex + offset, newPairId))];
  }
  if (action.type === 'remove') {
    const pair = pairs.find(candidate => candidate.id === action.pairId);
    if (!pair) throw new Error('Cette paire n’existe plus. Actualisez la liste.');
    if (pair.players.some(player => player.validated)) throw new Error('Dépointez les deux joueurs avant de supprimer la paire.');
    return current.filter(player => player.pair_id !== pair.id);
  }
  const replaced = current.find(player => player.license === action.license);
  if (!replaced) throw new Error('Ce joueur n’est plus inscrit. Actualisez la liste.');
  if (replaced.validated) throw new Error('Dépointez le joueur avant de le remplacer.');
  verifyNewPlayer(action.player);
  return current.map(player => player.license === action.license
    ? freshPlayer(action.player, player.index, player.pair_id!)
    : player);
}

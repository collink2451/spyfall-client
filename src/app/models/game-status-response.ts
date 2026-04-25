import { PlayerResponse } from './player-response';

export interface GameStatusResponse {
  code: string;
  status: string;
  hostPlayerId: number | null;
  players: PlayerResponse[];
}

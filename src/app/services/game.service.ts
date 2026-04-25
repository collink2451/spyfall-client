import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { PlayerResponse } from '../models/player-response';

export interface GameStartedPayload {
  role: string | null;
  location: string | null;
}

export interface VoteTallyPayload {
  guilty: number;
  notGuilty: number;
  total: number;
}

export interface GameEndedPayload {
  outcome: string;
  location: string;
  spyName: string;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private hub: signalR.HubConnection;

  // Server -> Client events
  private playerJoinedSubject = new Subject<PlayerResponse[]>();
  playerJoined$ = this.playerJoinedSubject.asObservable();

  private playerLeftSubject = new Subject<PlayerResponse[]>();
  playerLeft$ = this.playerLeftSubject.asObservable();

  private readyStateChangedSubject = new Subject<PlayerResponse[]>();
  readyStateChanged$ = this.readyStateChangedSubject.asObservable();

  private promotedToHostSubject = new Subject<void>();
  promotedToHost$ = this.promotedToHostSubject.asObservable();

  private removedFromGameSubject = new Subject<string>();
  removedFromGame$ = this.removedFromGameSubject.asObservable();

  private gameStartedSubject = new Subject<GameStartedPayload>();
  gameStarted$ = this.gameStartedSubject.asObservable();

  private accusationStartedSubject = new Subject<string>();
  accusationStarted$ = this.accusationStartedSubject.asObservable();

  private voteTallySubject = new Subject<VoteTallyPayload>();
  voteTally$ = this.voteTallySubject.asObservable();

  private voteResultSubject = new Subject<string>();
  voteResult$ = this.voteResultSubject.asObservable();

  private gameEndedSubject = new Subject<GameEndedPayload>();
  gameEnded$ = this.gameEndedSubject.asObservable();

  private errorSubject = new Subject<string>();
  error$ = this.errorSubject.asObservable();

  constructor() {
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/game')
      .withAutomaticReconnect()
      .build();

    this.hub.on('PlayerJoined', (players: PlayerResponse[]) => this.playerJoinedSubject.next(players));
    this.hub.on('PlayerLeft', (players: PlayerResponse[]) => this.playerLeftSubject.next(players));
    this.hub.on('ReadyStateChanged', (players: PlayerResponse[]) => this.readyStateChangedSubject.next(players));
    this.hub.on('PromotedToHost', () => this.promotedToHostSubject.next());
    this.hub.on('RemovedFromGame', (reason: string) => this.removedFromGameSubject.next(reason));
    this.hub.on('GameStarted', (role: string | null, location: string | null) =>
      this.gameStartedSubject.next({ role, location }),
    );
    this.hub.on('AccusationStarted', (accusedName: string) => this.accusationStartedSubject.next(accusedName));
    this.hub.on('VoteTally', (guilty: number, notGuilty: number, total: number) =>
      this.voteTallySubject.next({ guilty, notGuilty, total }),
    );
    this.hub.on('VoteResult', (result: string) => this.voteResultSubject.next(result));
    this.hub.on('GameEnded', (outcome: string, location: string, spyName: string) =>
      this.gameEndedSubject.next({ outcome, location, spyName }),
    );
    this.hub.on('Error', (message: string) => this.errorSubject.next(message));
  }

  async start(): Promise<void> {
    await this.hub.start();
  }

  // Client -> Server methods
  joinRoom(code: string, playerId: number): Promise<void> {
    return this.hub.invoke('JoinRoom', code, playerId);
  }

  startGame(code: string, playerId: number): Promise<void> {
    return this.hub.invoke('StartGame', code, playerId);
  }

  setReady(code: string, playerId: number, isReady: boolean): Promise<void> {
    return this.hub.invoke('SetReady', code, playerId, isReady);
  }

  leaveGame(code: string, playerId: number): Promise<void> {
    return this.hub.invoke('LeaveGame', code, playerId);
  }

  kickPlayer(code: string, hostPlayerId: number, targetPlayerId: number): Promise<void> {
    return this.hub.invoke('KickPlayer', code, hostPlayerId, targetPlayerId);
  }

  accusePlayer(code: string, accusedPlayerId: number): Promise<void> {
    return this.hub.invoke('AccusePlayer', code, accusedPlayerId);
  }

  castVote(code: string, votingPlayerId: number, guilty: boolean): Promise<void> {
    return this.hub.invoke('CastVote', code, votingPlayerId, guilty);
  }

  spyGuessLocation(code: string, locationGuess: string): Promise<void> {
    return this.hub.invoke('SpyGuessLocation', code, locationGuess);
  }

  endGame(code: string, playerId: number, spyWon: boolean): Promise<void> {
    return this.hub.invoke('EndGame', code, playerId, spyWon);
  }
}

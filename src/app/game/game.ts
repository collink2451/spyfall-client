import { NgClass } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LocationResponse } from '../models/location-response';
import { PlayerResponse } from '../models/player-response';
import { ApiService } from '../services/api.service';
import { GameService, VoteTallyPayload } from '../services/game.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-game',
  imports: [NgClass],
  templateUrl: './game.html',
  styleUrl: './game.scss',
})
export class Game implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private gameService = inject(GameService);
  private toastService = inject(ToastService);

  // Identity
  code = '';
  playerId = 0;
  role: string | null = null;
  location: string | null = null;
  isSpy = false;

  cardRevealed = signal(false);

  // Signals
  players = signal<PlayerResponse[]>([]);
  hostPlayerId = signal<number | null>(null);
  accusedPlayerName = signal<string | null>(null);
  voteTally = signal<VoteTallyPayload | null>(null);
  hasVoted = signal(false);
  locations = signal<LocationResponse[]>([]);
  crossedOutLocations = signal<Set<number>>(new Set());
  crossedOutPlayers = signal<Set<number>>(new Set());
  guessingMode = signal(false);
  timerSeconds = signal(600);
  timerPaused = signal(false);
  accuseLoading = signal(false);
  endGameLoading = signal(false);
  endGamePending = signal<boolean | null>(null);
  guessLocationPending = signal<LocationResponse | null>(null);

  // Computed
  isHost = computed(() => this.playerId === this.hostPlayerId());
  isVotingActive = computed(() => this.accusedPlayerName() !== null);
  timerColor = computed(() => {
    const s = this.timerSeconds();
    if (s <= 60) return 'text-danger';
    if (s <= 120) return 'text-warning';
    return 'text-success';
  });
  formattedTime = computed(() => {
    const s = this.timerSeconds();
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  });

  private subscriptions = new Subscription();
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  async ngOnInit(): Promise<void> {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.playerId = Number(localStorage.getItem('playerId'));
    this.role = localStorage.getItem('role') || "Don't Get Caught";
    this.location = localStorage.getItem('location') || 'You are the Spy';
    this.isSpy = this.role === "Don't Get Caught";

    if (!this.code || !this.playerId) {
      this.router.navigate(['/']);
      return;
    }

    this.apiService.getGameStatus(this.code).subscribe({
      next: (status) => {
        this.players.set(status.players);
        this.hostPlayerId.set(status.hostPlayerId);
      },
      error: () => {
        this.toastService.show('Could not load game.', 'error');
        this.router.navigate(['/']);
      },
    });

    this.apiService.getLocations().subscribe({
      next: (locs) => this.locations.set(locs),
      error: () => this.toastService.show('Could not load locations.', 'error'),
    });

    this.subscriptions.add(
      this.gameService.accusationStarted$.subscribe((accusedName) => {
        this.accusedPlayerName.set(accusedName);
        this.voteTally.set(null);
        this.hasVoted.set(false);
      }),
    );

    this.subscriptions.add(
      this.gameService.voteTally$.subscribe((tally) => this.voteTally.set(tally)),
    );

    this.subscriptions.add(
      this.gameService.voteResult$.subscribe((result) => {
        this.accusedPlayerName.set(null);
        this.voteTally.set(null);
        if (result === 'NotGuilty') {
          this.toastService.show('Not guilty — the spy survives!', 'info');
        }
      }),
    );

    this.subscriptions.add(
      this.gameService.gameEnded$.subscribe((payload) => {
        localStorage.setItem('gameOutcome', payload.outcome);
        localStorage.setItem('gameLocation', payload.location);
        localStorage.setItem('gameSpyName', payload.spyName);
        this.router.navigate(['/results', this.code]);
      }),
    );

    this.subscriptions.add(
      this.gameService.error$.subscribe((message) => this.toastService.show(message, 'error')),
    );

    this.subscriptions.add(
      this.gameService.timerState$.subscribe(({ seconds, isPaused }) => {
        this.timerSeconds.set(seconds);
        this.timerPaused.set(isPaused);
        if (!isPaused) this.startLocalTimer();
      }),
    );

    this.subscriptions.add(
      this.gameService.timerStarted$.subscribe((seconds) => {
        this.timerSeconds.set(seconds);
        this.timerPaused.set(false);
        this.startLocalTimer();
      }),
    );

    this.subscriptions.add(
      this.gameService.timerPaused$.subscribe((seconds) => {
        this.timerSeconds.set(seconds);
        this.timerPaused.set(true);
        this.stopLocalTimer();
      }),
    );

    this.subscriptions.add(
      this.gameService.timerResumed$.subscribe((seconds) => {
        this.timerSeconds.set(seconds);
        this.timerPaused.set(false);
        this.startLocalTimer();
      }),
    );

    this.subscriptions.add(
      this.gameService.timerSync$.subscribe((seconds) => {
        this.timerSeconds.set(seconds);
        if (!this.timerPaused() && this.timerInterval === null) {
          this.startLocalTimer();
        }
      }),
    );

    try {
      await this.gameService.start();
      await this.gameService.joinRoom(this.code, this.playerId);
    } catch {
      this.toastService.show('Could not connect to game server.', 'error');
    }

    try {
      await this.gameService.getTimerState(this.code);
    } catch {
      // Timer may not exist yet if game hasn't started
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopLocalTimer();
  }

  private startLocalTimer(): void {
    this.stopLocalTimer();
    this.timerInterval = setInterval(() => {
      this.timerSeconds.update((s) => Math.max(0, s - 1));
    }, 1000);
  }

  private stopLocalTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  async accusePlayer(targetId: number): Promise<void> {
    if (this.accuseLoading()) return;
    this.accuseLoading.set(true);
    try {
      await this.gameService.accusePlayer(this.code, targetId);
    } catch {
      this.toastService.show('Failed to accuse player.', 'error');
    } finally {
      this.accuseLoading.set(false);
    }
  }

  async castVote(guilty: boolean): Promise<void> {
    this.hasVoted.set(true);
    try {
      await this.gameService.castVote(this.code, this.playerId, guilty);
    } catch {
      this.hasVoted.set(false);
      this.toastService.show('Failed to cast vote.', 'error');
    }
  }

  toggleGuessingMode(): void {
    if (!this.isSpy) {
      this.toastService.show('Only the spy can guess the location.', 'error');
      return;
    }
    this.guessingMode.update((v) => !v);
  }

  tapLocation(location: LocationResponse): void {
    if (this.isSpy && this.guessingMode()) {
      this.guessingMode.set(false);
      this.guessLocationPending.set(location);
    } else {
      this.crossedOutLocations.update((set) => this.toggleSet(set, location.id));
    }
  }

  confirmGuess(): void {
    const location = this.guessLocationPending();
    if (!location) return;
    this.guessLocationPending.set(null);
    this.gameService.spyGuessLocation(this.code, location.name).catch(() => {
      this.toastService.show('Failed to submit guess.', 'error');
    });
  }

  tapPlayer(player: PlayerResponse): void {
    this.crossedOutPlayers.update((set) => this.toggleSet(set, player.id));
  }

  imageUrl(name: string | null): string {
    if (!name) return '';
    return `/images/locations/${name.replace(/\s+/g, '')}.webp`;
  }

  private toggleSet(set: Set<number>, id: number): Set<number> {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  }

  requestEndGame(spyWon: boolean): void {
    this.endGamePending.set(spyWon);
  }

  async confirmEndGame(): Promise<void> {
    const spyWon = this.endGamePending();
    if (spyWon === null) return;
    this.endGamePending.set(null);
    if (this.endGameLoading()) return;
    this.endGameLoading.set(true);
    try {
      await this.gameService.endGame(this.code, this.playerId, spyWon);
    } catch {
      this.toastService.show('Failed to end game.', 'error');
      this.endGameLoading.set(false);
    }
  }

  async pauseTimer(): Promise<void> {
    try {
      await this.gameService.pauseTimer(this.code, this.playerId);
    } catch {
      this.toastService.show('Failed to pause timer.', 'error');
    }
  }

  async resumeTimer(): Promise<void> {
    try {
      await this.gameService.resumeTimer(this.code, this.playerId);
    } catch {
      this.toastService.show('Failed to resume timer.', 'error');
    }
  }
}

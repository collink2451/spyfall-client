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

  // Computed
  isHost = computed(() => this.playerId === this.hostPlayerId());
  isVotingActive = computed(() => this.accusedPlayerName() !== null);

  private subscriptions = new Subscription();

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

    try {
      await this.gameService.start();
      await this.gameService.joinRoom(this.code, this.playerId);
    } catch {
      this.toastService.show('Could not connect to game server.', 'error');
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async accusePlayer(targetId: number): Promise<void> {
    try {
      await this.gameService.accusePlayer(this.code, targetId);
    } catch {
      this.toastService.show('Failed to accuse player.', 'error');
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
      this.gameService.spyGuessLocation(this.code, location.name).catch(() => {
        this.toastService.show('Failed to submit guess.', 'error');
      });
    } else {
      this.crossedOutLocations.update((set) => {
        const next = new Set(set);
        if (next.has(location.id)) {
          next.delete(location.id);
        } else {
          next.add(location.id);
        }
        return next;
      });
    }
  }

  tapPlayer(player: PlayerResponse): void {
    this.crossedOutPlayers.update((set) => {
      const next = new Set(set);
      if (next.has(player.id)) {
        next.delete(player.id);
      } else {
        next.add(player.id);
      }
      return next;
    });
  }

  async endGame(spyWon: boolean): Promise<void> {
    try {
      await this.gameService.endGame(this.code, this.playerId, spyWon);
    } catch {
      this.toastService.show('Failed to end game.', 'error');
    }
  }
}

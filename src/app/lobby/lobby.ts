import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { PlayerResponse } from '../models/player-response';
import { ApiService } from '../services/api.service';
import { GameService } from '../services/game.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-lobby',
  imports: [],
  templateUrl: './lobby.html',
  styleUrl: './lobby.scss',
})
export class Lobby implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private gameService = inject(GameService);
  private toastService = inject(ToastService);

  code = '';
  playerId = 0;

  players = signal<PlayerResponse[]>([]);
  hostPlayerId = signal<number | null>(null);
  selfReady = signal(false);

  isHost = computed(() => this.playerId === this.hostPlayerId());
  canStart = computed(
    () => this.isHost() && this.players().length >= 3 && this.players().every((p) => p.isReady),
  );

  private subscriptions = new Subscription();

  private updatePlayers(players: PlayerResponse[]): void {
    this.players.set(players);
    this.selfReady.set(players.find((p) => p.id === this.playerId)?.isReady ?? false);
  }

  async ngOnInit(): Promise<void> {
    this.code = this.route.snapshot.paramMap.get('code') ?? '';
    this.playerId = Number(localStorage.getItem('playerId'));

    if (!this.code || !this.playerId) {
      this.router.navigate(['/']);
      return;
    }

    // Load initial data immediately so the UI isn't blank while SignalR connects
    this.apiService.getGameStatus(this.code).subscribe({
      next: (status) => {
        this.updatePlayers(status.players);
        this.hostPlayerId.set(status.hostPlayerId);
      },
      error: () => {
        this.toastService.show('Could not load game. Returning to home.', 'error');
        this.router.navigate(['/']);
      },
    });

    this.subscriptions.add(
      this.gameService.playerJoined$.subscribe((players) => this.updatePlayers(players)),
    );

    this.subscriptions.add(
      this.gameService.playerLeft$.subscribe((players) => this.updatePlayers(players)),
    );

    this.subscriptions.add(
      this.gameService.readyStateChanged$.subscribe((players) => this.updatePlayers(players)),
    );

    this.subscriptions.add(
      this.gameService.promotedToHost$.subscribe(() => {
        this.hostPlayerId.set(this.playerId);
        this.toastService.show('You are now the host.', 'info');
      }),
    );

    this.subscriptions.add(
      this.gameService.removedFromGame$.subscribe((reason) => {
        this.toastService.show(reason, 'error');
        this.router.navigate(['/']);
      }),
    );

    this.subscriptions.add(
      this.gameService.gameStarted$.subscribe((payload) => {
        localStorage.setItem('role', payload.role ?? '');
        localStorage.setItem('location', payload.location ?? '');
        this.router.navigate(['/game', this.code]);
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
      return;
    }

    // Re-fetch after joinRoom so hostPlayerId is set correctly in the DB
    this.apiService.getGameStatus(this.code).subscribe({
      next: (status) => {
        this.updatePlayers(status.players);
        this.hostPlayerId.set(status.hostPlayerId);
      },
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async toggleReady(): Promise<void> {
    try {
      await this.gameService.setReady(this.code, this.playerId, !this.selfReady());
    } catch {
      this.toastService.show('Failed to update ready state.', 'error');
    }
  }

  async startGame(): Promise<void> {
    try {
      await this.gameService.startGame(this.code, this.playerId);
    } catch {
      this.toastService.show('Failed to start game.', 'error');
    }
  }

  async kickPlayer(targetId: number): Promise<void> {
    try {
      await this.gameService.kickPlayer(this.code, this.playerId, targetId);
    } catch {
      this.toastService.show('Failed to kick player.', 'error');
    }
  }

  async leaveGame(): Promise<void> {
    try {
      await this.gameService.leaveGame(this.code, this.playerId);
    } catch {
      // ignore — navigate home regardless
    } finally {
      this.router.navigate(['/']);
    }
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.code);
    this.toastService.show('Room code copied!', 'success');
  }
}

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { GameService } from '../services/game.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-results',
  imports: [],
  templateUrl: './results.html',
  styleUrl: './results.scss',
})
export class Results implements OnInit, OnDestroy {
  private router = inject(Router);
  private gameService = inject(GameService);
  private toastService = inject(ToastService);

  code = '';
  playerId = 0;
  outcome: 'SpyWins' | 'PlayersWin' | null = null;
  location = '';
  spyName = '';

  private subscriptions = new Subscription();

  get spyWon(): boolean {
    return this.outcome === 'SpyWins';
  }

  get locationImageUrl(): string {
    if (!this.location) return '';
    return `/images/locations/${this.location.replace(/\s+/g, '')}.png`;
  }

  async ngOnInit(): Promise<void> {
    this.code = localStorage.getItem('code') ?? '';
    this.playerId = Number(localStorage.getItem('playerId'));
    this.outcome = (localStorage.getItem('gameOutcome') as 'SpyWins' | 'PlayersWin') ?? null;
    this.location = localStorage.getItem('gameLocation') ?? '';
    this.spyName = localStorage.getItem('gameSpyName') ?? '';

    if (!this.code || !this.outcome) {
      this.router.navigate(['/']);
      return;
    }

    this.subscriptions.add(
      this.gameService.playAgain$.subscribe(() => {
        this.router.navigate(['/lobby', this.code]);
      }),
    );

    // Hub connection persists from the game screen — just ensure it's started
    // Don't call joinRoom here as it's not needed and can cause errors
    try {
      await this.gameService.start();
    } catch {
      this.toastService.show('Could not connect to game server.', 'error');
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async playAgain(): Promise<void> {
    try {
      await this.gameService.playAgain(this.code);
    } catch {
      this.toastService.show('Failed to start new game.', 'error');
    }
  }

  leave(): void {
    localStorage.removeItem('gameOutcome');
    localStorage.removeItem('gameLocation');
    localStorage.removeItem('gameSpyName');
    localStorage.removeItem('playerId');
    localStorage.removeItem('code');
    localStorage.removeItem('role');
    localStorage.removeItem('location');
    this.router.navigate(['/']);
  }
}

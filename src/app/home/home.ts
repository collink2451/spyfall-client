import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private router = inject(Router);
  private apiService = inject(ApiService);
  private toastService = inject(ToastService);

  name = '';
  code = '';
  mode: 'create' | 'join' = 'create';
  loading = false;

  setMode(mode: 'create' | 'join'): void {
    this.mode = mode;
  }

  submit(): void {
    if (!this.name.trim()) {
      this.toastService.show('Please enter your name.', 'error');
      return;
    }

    if (this.mode === 'join' && !this.code.trim()) {
      this.toastService.show('Please enter a room code.', 'error');
      return;
    }

    this.loading = true;

    if (this.mode === 'create') {
      this.apiService.createGame().subscribe({
        next: (gameCode) => {
          this.apiService.joinGame(gameCode, this.name.trim()).subscribe({
            next: (playerId) => {
              localStorage.setItem('playerId', String(playerId));
              localStorage.setItem('code', gameCode);
              this.router.navigate(['/lobby', gameCode]);
            },
            error: (err) => {
              this.toastService.show(err.error || 'Failed to join game. Please try again.', 'error');
              this.loading = false;
            },
          });
        },
        error: (err) => {
          this.toastService.show(err.error || 'Failed to create game. Please try again.', 'error');
          this.loading = false;
        },
      });
    } else {
      const trimmedCode = this.code.trim().toUpperCase();
      this.apiService.joinGame(trimmedCode, this.name.trim()).subscribe({
        next: (playerId) => {
          localStorage.setItem('playerId', String(playerId));
          localStorage.setItem('code', trimmedCode);
          this.router.navigate(['/lobby', trimmedCode]);
        },
        error: (err) => {
          this.toastService.show(err.error || 'Failed to join game. Please try again.', 'error');
          this.loading = false;
        },
      });
    }
  }
}

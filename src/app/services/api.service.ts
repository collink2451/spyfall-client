import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GameStatusResponse } from '../models/game-status-response';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = '/api/games';

  constructor(private http: HttpClient) {}

  createGame(): Observable<string> {
    return this.http.post(this.baseUrl, {}, { responseType: 'text' });
  }

  joinGame(code: string, name: string): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/${code}/join`, { name });
  }

  getGameStatus(code: string): Observable<GameStatusResponse> {
    return this.http.get<GameStatusResponse>(`${this.baseUrl}/${code}`);
  }
}

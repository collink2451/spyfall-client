import { Routes } from '@angular/router';
import { Game } from './game/game';
import { Home } from './home/home';
import { Lobby } from './lobby/lobby';
import { Results } from './results/results';

export const routes: Routes = [
    {
        path: '',
        component: Home
    },
    {
        path: 'lobby/:code',
        component: Lobby
    },
    {
        path: 'game/:code',
        component: Game
    },
    {
        path: 'results/:code',
        component: Results
    },
    {
        path: '**',
        redirectTo: ''
    }
];

import { Component, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styles: ``,
})
export class Toast {
  protected toastService = inject(ToastService);
}

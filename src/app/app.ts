import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from '@shared/ui/toast';

@Component({
  selector: 'jf-root',
  imports: [RouterOutlet, ToastContainer],
  templateUrl: './app.html',
})
export class App {}

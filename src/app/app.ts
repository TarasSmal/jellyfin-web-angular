import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PlaybackController } from '@features/playback-controller';
import { PlaybackOutlet } from '@widgets/playback-stage';
import { ToastContainer } from '@shared/ui/toast';

@Component({
  selector: 'jf-root',
  imports: [RouterOutlet, PlaybackOutlet, ToastContainer],
  templateUrl: './app.html',
})
export class App {
  protected readonly playback = inject(PlaybackController);
}

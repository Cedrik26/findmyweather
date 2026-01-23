import { Component, EventEmitter, Output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import {MatLabel} from '@angular/material/input';

@Component({
  selector: 'app-graphwindow',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, MatLabel],
  templateUrl: './graphwindow.html',
  styleUrl: './graphwindow.css',
})
export class Graphwindow {
  @Output() close = new EventEmitter<void>();
}

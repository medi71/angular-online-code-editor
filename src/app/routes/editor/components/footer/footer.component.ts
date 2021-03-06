import { Component, Input } from '@angular/core';

@Component({
  selector: 'footer-component',
  templateUrl: './footer.html',
  styleUrls: ['./footer.css']
})
export class FooterComponent {
  @Input() users: number;
  @Input() creationTimestamp: number = Date.now();
  @Input() lastModified: number = Date.now();
}

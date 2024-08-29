import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-test',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './test.component.html',
  styleUrl: './test.component.scss'
})
export class TestComponent {
  fileOutput: any;
  base64String: string = '';

  onChange(event: any) {
    const file: File = event.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      this.base64String = reader.result as string;
      console.log(this.base64String);

    };
    if (file) {
      reader.readAsDataURL(file);
    }
    // reader.readAsText(file);
  }





}

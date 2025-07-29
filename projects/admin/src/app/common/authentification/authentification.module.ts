import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignInComponent } from './sign-in/sign-in.component';
import { ReactiveFormsModule, Form, FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SignOutComponent } from './sign-out/sign-out.component';




const routes: Routes = [
  { path: 'sign-in', component: SignInComponent },
  { path: 'sign-out', component: SignOutComponent },
  { path: '**', redirectTo: 'sign-in' }
];


@NgModule({
  declarations: [SignInComponent],
  exports: [SignInComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes)
  ]
})


export class AuthentificationModule { }

import { AbstractControl, FormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export function normalizeMemberEmail(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase();
}

export const requiredMemberEmailValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const email = normalizeMemberEmail(control.value);
  if (!email) return { required: true };
  return Validators.email(new FormControl(email));
};

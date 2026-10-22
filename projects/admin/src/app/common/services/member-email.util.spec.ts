import { FormControl } from '@angular/forms';
import { normalizeMemberEmail, requiredMemberEmailValidator } from './member-email.util';

describe('member email utilities', () => {
  it('normalizes case and surrounding spaces', () => {
    expect(normalizeMemberEmail(' Alice@Example.FR ')).toBe('alice@example.fr');
  });

  it('validates the normalized email and rejects empty or invalid values', () => {
    expect(requiredMemberEmailValidator(new FormControl(' Alice@Example.FR '))).toBeNull();
    expect(requiredMemberEmailValidator(new FormControl('   '))).toEqual({ required: true });
    expect(requiredMemberEmailValidator(new FormControl('not-an-email'))).toEqual({ email: true });
  });
});

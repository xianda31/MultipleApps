import { AppInstallService } from './app-install.service';

describe('AppInstallService', () => {
  const dismissedUntilKey = 'bcsto.install.dismissedUntil';

  beforeEach(() => {
    localStorage.removeItem(dismissedUntilKey);
  });

  it('exposes the native install prompt and hides after acceptance', async () => {
    const service = new AppInstallService();
    const prompt = jasmine.createSpy('prompt').and.resolveTo();
    const event = new Event('beforeinstallprompt');

    Object.defineProperties(event, {
      prompt: { value: prompt },
      userChoice: { value: Promise.resolve({ outcome: 'accepted', platform: 'web' }) }
    });

    window.dispatchEvent(event);

    expect(service.state().mode).toBe('prompt');
    await expectAsync(service.install()).toBeResolvedTo(true);
    expect(prompt).toHaveBeenCalledOnceWith();
    expect(service.state().mode).toBe('hidden');
  });

  it('remembers a dismissal for a future visit', () => {
    const service = new AppInstallService();

    service.dismiss();

    expect(service.state().mode).toBe('hidden');
    expect(Number(localStorage.getItem(dismissedUntilKey))).toBeGreaterThan(Date.now());
  });
});
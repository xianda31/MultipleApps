#nullable enable

using NfcDiagnostic;
using Microsoft.Win32;
using System.Security;

namespace ppNFC;

internal sealed class TrayContext : ApplicationContext
{
    private const string StartupKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string StartupValueName = "ppNFC";
    private readonly DiagnosticForm _window = new();
    private readonly NotifyIcon _icon;
    private readonly ContextMenuStrip _menu = new();
    private readonly ToolStripMenuItem _startupItem = new("Demarrer avec Windows")
    {
        CheckOnClick = true
    };
    private readonly CancellationTokenSource _stop = new();
    private readonly INfcReader _monitor = new ReaderMonitor(() => new PresenceReader());
    private readonly Task _worker;
    private bool _quitting;

    public TrayContext()
    {
        _menu.Items.Add("Diagnostic", null, (_, _) => ShowDiagnostic());
        try
        {
            _startupItem.Checked = IsStartupEnabled();
        }
        catch (Exception error) when (IsStartupAccessError(error))
        {
            MessageBox.Show($"Impossible de lire le demarrage automatique : {error.Message}",
                "ppNFC - Demarrage", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        _startupItem.Click += (_, _) => SetStartupEnabled(_startupItem.Checked);
        _menu.Items.Add(_startupItem);
        _menu.Items.Add("Quitter", null, (_, _) => Quit());
        _icon = new NotifyIcon
        {
            Icon = SystemIcons.Information,
            Text = "ppNFC - Demarrage",
            ContextMenuStrip = _menu,
            Visible = true
        };
        _icon.DoubleClick += (_, _) => ShowDiagnostic();
        _window.QuitRequested += Quit;
        _ = _window.Handle;
        _window.Render(_monitor.Current);
        _monitor.Updated += PostUpdate;
        _worker = Task.Run(RunAsync);
        ShowDiagnostic();
    }

    private static bool IsStartupEnabled()
    {
        using var key = Registry.CurrentUser.OpenSubKey(StartupKeyPath);
        return key?.GetValue(StartupValueName) is string;
    }

    private void SetStartupEnabled(bool enabled)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(StartupKeyPath, writable: true)
                ?? throw new InvalidOperationException("Impossible d'ouvrir la cle de demarrage Windows.");
            if (enabled)
            {
                var executablePath = Environment.ProcessPath
                    ?? throw new InvalidOperationException("Chemin de ppNFC.exe introuvable.");
                key.SetValue(StartupValueName, $"\"{executablePath}\"", RegistryValueKind.String);
            }
            else
            {
                key.DeleteValue(StartupValueName, throwOnMissingValue: false);
            }
        }
        catch (Exception error) when (IsStartupAccessError(error))
        {
            _startupItem.Checked = !enabled;
            MessageBox.Show($"Impossible de modifier le demarrage automatique : {error.Message}",
                "ppNFC - Demarrage", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static bool IsStartupAccessError(Exception error) =>
        error is UnauthorizedAccessException or SecurityException or IOException or InvalidOperationException;

    private void ShowDiagnostic()
    {
        _window.Show();
        _window.WindowState = FormWindowState.Normal;
        _window.Activate();
    }

    private void PostUpdate(ReaderUpdate update)
    {
        _window.BeginInvoke(() =>
        {
            _window.Render(update);
            _icon.Text = $"ppNFC - {DiagnosticForm.StatusText(update.Status)}";
            _icon.Icon = update.Status is ReaderStatus.Error or ReaderStatus.Disconnected
                ? SystemIcons.Warning : SystemIcons.Information;
        });
    }

    private async Task RunAsync()
    {
        try
        {
            while (!_stop.IsCancellationRequested)
            {
                _monitor.Tick(DateTimeOffset.UtcNow);
                var delay = _monitor.Current.Status is ReaderStatus.Disconnected or ReaderStatus.Error ? 1000 : 200;
                await Task.Delay(delay, _stop.Token);
            }
        }
        catch (OperationCanceledException) when (_stop.IsCancellationRequested)
        {
        }
        catch (Exception error)
        {
            PostUpdate(_monitor.Current with
            {
                Status = ReaderStatus.Error,
                Message = $"Lecture arretee : {error}. Quittez puis relancez ppNFC."
            });
        }
        finally
        {
            _monitor.Dispose();
        }
    }

    private async void Quit()
    {
        if (_quitting)
            return;
        _quitting = true;
        _stop.Cancel();
        try
        {
            await _worker;
        }
        catch (Exception error)
        {
            MessageBox.Show(error.ToString(), "ppNFC - Erreur de fermeture",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            _icon.Visible = false;
            _icon.Dispose();
            _menu.Dispose();
            _window.Dispose();
            _stop.Dispose();
            ExitThread();
        }
    }
}

#nullable enable

namespace ppNFC;

static class Program
{
    [STAThread]
    static int Main()
    {
        ApplicationConfiguration.Initialize();
        using var instance = new Mutex(true, @"Local\ppNFC", out var firstInstance);
        if (!firstInstance)
        {
            MessageBox.Show("ppNFC est deja ouvert. Utilisez son icone dans la zone de notification.",
                "ppNFC", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return 1;
        }

        try
        {
            using var context = new TrayContext();
            Application.Run(context);
            return 0;
        }
        catch (Exception error)
        {
            MessageBox.Show(error.ToString(), "ppNFC - Erreur", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
        finally
        {
            instance.ReleaseMutex();
        }
    }
}
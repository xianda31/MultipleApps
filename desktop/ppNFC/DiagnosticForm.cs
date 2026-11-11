#nullable enable

namespace ppNFC;

internal sealed class DiagnosticForm : Form
{
    private readonly Label _status = new() { AutoSize = true };
    private readonly Label _reader = new() { AutoSize = true };
    private readonly TextBox _uid = new() { ReadOnly = true, Dock = DockStyle.Fill };
    private readonly Label _count = new() { AutoSize = true };
    private readonly Label _message = new() { AutoSize = true, MaximumSize = new Size(740, 0) };
    private readonly ListBox _events = new() { Dock = DockStyle.Fill, HorizontalScrollbar = true };
    public event Action? QuitRequested;

    public DiagnosticForm()
    {
        Text = "ppNFC - Diagnostic ACR";
        Size = new Size(800, 490);
        MinimumSize = new Size(650, 400);
        StartPosition = FormStartPosition.CenterScreen;
        var layout = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(12), ColumnCount = 1, RowCount = 8 };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        for (var i = 0; i < 6; i++)
            layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        layout.Controls.Add(_status, 0, 0);
        layout.Controls.Add(_reader, 0, 1);
        layout.Controls.Add(_uid, 0, 2);
        layout.Controls.Add(_count, 0, 3);
        layout.Controls.Add(_message, 0, 4);
        layout.Controls.Add(new Label { Text = "Prototype local : aucun backend, aucune lumiere, aucun buzzer.", AutoSize = true }, 0, 5);
        layout.Controls.Add(_events, 0, 6);
        var buttons = new FlowLayoutPanel { AutoSize = true, Dock = DockStyle.Fill };
        var hide = new Button { Text = "Masquer", AutoSize = true };
        hide.Click += (_, _) => Hide();
        var quit = new Button { Text = "Quitter ppNFC", AutoSize = true };
        quit.Click += (_, _) => QuitRequested?.Invoke();
        buttons.Controls.AddRange([hide, quit]);
        layout.Controls.Add(buttons, 0, 7);
        Controls.Add(layout);
        FormClosing += (_, args) =>
        {
            if (args.CloseReason == CloseReason.UserClosing)
            {
                args.Cancel = true;
                Hide();
            }
        };
    }

    public static string StatusText(ReaderStatus status) => status switch
    {
        ReaderStatus.Starting => "Demarrage",
        ReaderStatus.Ready => "Pret",
        ReaderStatus.CardRead => "Carte lue",
        ReaderStatus.Disconnected => "Deconnecte",
        ReaderStatus.Error => "Erreur",
        _ => throw new ArgumentOutOfRangeException(nameof(status))
    };

    public void Render(ReaderUpdate update)
    {
        var status = StatusText(update.Status);
        _status.Text = $"Etat : {status}";
        _reader.Text = $"Lecteur : {update.ReaderName ?? "non detecte"}";
        _uid.Text = update.Uid ?? "Aucun UID lu";
        var time = update.LastReadAt?.ToLocalTime().ToString("HH:mm:ss.fff") ?? "-";
        _count.Text = $"Lectures : {update.Readings} | Derniere lecture : {time}";
        _message.Text = update.Message;
        _events.Items.Add($"{DateTime.Now:HH:mm:ss.fff} {status} - {update.Message}");
        while (_events.Items.Count > 200)
            _events.Items.RemoveAt(0);
        _events.TopIndex = _events.Items.Count - 1;
    }
}

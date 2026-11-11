#nullable enable

using NfcDiagnostic;

namespace ppNFC;

public sealed class ReaderMonitor(Func<IPcscReader> openReader) : INfcReader
{
    private IPcscReader? _device;
    private bool _presentationHandled;
    private string? _lastUid;
    private DateTimeOffset? _lastReadAt;
    private int _readings;
    private string? _readerName;

    public ReaderUpdate Current { get; private set; } =
        new(ReaderStatus.Starting, null, null, 0, null, "Demarrage du lecteur...");
    public event Action<ReaderUpdate>? Updated;

    public void Tick(DateTimeOffset now)
    {
        try
        {
            _device ??= openReader();
            var readers = _device.ListReaders()
                .Where(name => name.Contains("ACR1555", StringComparison.OrdinalIgnoreCase)
                    && name.Contains("PICC", StringComparison.OrdinalIgnoreCase))
                .ToArray();
            if (readers.Length != 1)
            {
                if (_readerName is not null)
                    _presentationHandled = true;
                SetState(readers.Length == 0 ? ReaderStatus.Disconnected : ReaderStatus.Error,
                    readers.Length == 0
                        ? "Aucun ACR1555 PICC disponible. Verifiez son etat Online dans l'outil ACS."
                        : "Plusieurs ACR1555 PICC detectes. Ne connectez qu'un lecteur pour ce prototype.");
                return;
            }
            if (_readerName is not null && _readerName != readers[0])
                _presentationHandled = true;
            _readerName = readers[0];

            if (!_device.IsCardPresent(_readerName))
            {
                _presentationHandled = false;
                SetState(ReaderStatus.Ready, "Pret. Presentez une carte.");
                return;
            }
            if (_presentationHandled)
            {
                if (Current.Status is ReaderStatus.CardRead or ReaderStatus.Error)
                    return;
                SetState(ReaderStatus.Ready, "Carte presente. Retirez-la avant une nouvelle lecture.");
                return;
            }

            var uid = _device.ReadUid(_readerName);
            if (uid is null)
            {
                SetState(ReaderStatus.Ready, "Carte retiree avant lecture. Presentez-la a nouveau.");
                return;
            }
            _presentationHandled = true;
            if (_lastUid == uid && _lastReadAt is { } previous && now - previous < TimeSpan.FromSeconds(1))
            {
                SetState(ReaderStatus.Ready, "Double lecture rapprochee ignoree. Retirez la carte.");
                return;
            }
            _lastUid = uid;
            _lastReadAt = now;
            _readings++;
            SetState(ReaderStatus.CardRead, "UID lu. Retirez la carte avant de la representer.");
        }
        catch (PcscException error)
        {
            _presentationHandled = true;
            var details = error.Message;
            try
            {
                ReleaseReader();
            }
            catch (PcscException cleanupError)
            {
                details += $"; liberation du contexte : {cleanupError.Message}";
            }
            var disconnected = error.Code is 0x80100017 or 0x80100009 or 0x80100006
                or 0x8010001D or 0x8010001E or 0x8010002E;
            SetState(disconnected ? ReaderStatus.Disconnected : ReaderStatus.Error,
                $"{details}. Nouvelle tentative automatique ; retirez la carte avant de la representer.");
        }
        catch (InvalidDataException error)
        {
            _presentationHandled = true;
            SetState(ReaderStatus.Error, $"{error.Message} Retirez la carte avant de la representer.");
        }
    }

    private void SetState(ReaderStatus status, string message)
    {
        var update = new ReaderUpdate(status, _readerName, _lastUid, _readings, _lastReadAt, message);
        if (update == Current)
            return;
        Current = update;
        Updated?.Invoke(update);
    }

    private void ReleaseReader()
    {
        var device = _device;
        _device = null;
        device?.Dispose();
    }

    public void Dispose() => ReleaseReader();
}

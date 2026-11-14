#nullable enable

namespace ppNFC;

public sealed class UidCapture
{
    private readonly object _gate = new();
    private ReaderUpdate _latest = new(ReaderStatus.Starting, null, null, 0, null, "Demarrage");
    private TaskCompletionSource<string>? _pending;
    private int _baseline;

    public bool IsCapturing
    {
        get { lock (_gate) return _pending is not null; }
    }

    public object GetStatus()
    {
        lock (_gate)
            return new
            {
                version = typeof(UidCapture).Assembly.GetName().Version?.ToString(),
                readerStatus = _latest.Status.ToString(),
                readerName = _latest.ReaderName,
                message = _latest.Message,
                capturing = _pending is not null
            };
    }

    public void Observe(ReaderUpdate update)
    {
        lock (_gate)
        {
            _latest = update;
            if (update.Status is ReaderStatus.Error or ReaderStatus.Disconnected)
                _pending?.TrySetException(new IOException("Lecteur indisponible. Retirez la carte et reessayez."));
            else if (update.Status == ReaderStatus.CardRead && update.Readings > _baseline && update.Uid is { } uid)
                _pending?.TrySetResult(uid);
        }
    }

    public async Task<string> AcquireAsync(TimeSpan timeout, CancellationToken cancellationToken)
    {
        TaskCompletionSource<string> pending;
        lock (_gate)
        {
            if (_pending is not null)
                throw new InvalidOperationException("Une acquisition est deja en cours dans un autre editeur.");
            if (_latest.Status is ReaderStatus.Starting or ReaderStatus.Disconnected or ReaderStatus.Error)
                throw new IOException("Lecteur indisponible. Verifiez ppNFC et la connexion Bluetooth.");
            _baseline = _latest.Readings;
            pending = new(TaskCreationOptions.RunContinuationsAsynchronously);
            _pending = pending;
        }
        try
        {
            return await pending.Task.WaitAsync(timeout, cancellationToken);
        }
        finally
        {
            lock (_gate)
                _pending = null;
        }
    }
}

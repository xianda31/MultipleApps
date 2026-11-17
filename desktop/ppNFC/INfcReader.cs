#nullable enable

namespace ppNFC;

public enum ReaderStatus { Starting, Ready, CardRead, Disconnected, Error }

public sealed record ReaderUpdate(
    ReaderStatus Status, string? ReaderName, string? Uid,
    int Readings, DateTimeOffset? LastReadAt, string Message);

public enum ReaderProbeState { Unverified, Responsive, Unresponsive }

public sealed record ReaderProbeResult(
    ReaderProbeState State, byte? PcdPiccStatus, string Message);

public interface INfcReader : IDisposable
{
    ReaderUpdate Current { get; }
    event Action<ReaderUpdate>? Updated;
    void Tick(DateTimeOffset now);
    ReaderProbeResult Probe();
}

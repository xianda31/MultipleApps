using System.IO;
using NfcDiagnostic;

namespace ppNFC.Tests;

public sealed class ReaderMonitorTests
{
    private static readonly DateTimeOffset Start = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
    private const string Name = "ACS ACR1555U TEST PICC 0";
    private const string Uid = "04E50142E37384";

    [Fact]
    public void NfcReaderContractExposesStateReadingsAndReleasesResources()
    {
        var device = new FakeReader();
        var opens = 0;
        using INfcReader reader = new ReaderMonitor(() =>
        {
            opens++;
            return device;
        });
        var updates = new List<ReaderUpdate>();
        reader.Updated += updates.Add;

        Assert.Equal(ReaderStatus.Starting, reader.Current.Status);
        Assert.Null(reader.Current.Uid);
        Assert.Equal(0, opens);

        reader.Tick(Start);
        Assert.Equal(ReaderStatus.Ready, reader.Current.Status);
        Assert.Equal(1, opens);
        device.Present = true;
        reader.Tick(Start.AddSeconds(1));
        Assert.Equal(ReaderStatus.CardRead, reader.Current.Status);
        Assert.Equal(Name, reader.Current.ReaderName);
        Assert.Equal(Uid, reader.Current.Uid);
        Assert.Equal(1, reader.Current.Readings);
        Assert.Equal(Start.AddSeconds(1), reader.Current.LastReadAt);

        device.Names = [];
        reader.Tick(Start.AddSeconds(2));
        Assert.Equal(ReaderStatus.Disconnected, reader.Current.Status);
        device.Names = [Name];
        device.Present = false;
        reader.Tick(Start.AddSeconds(3));
        Assert.Equal(ReaderStatus.Ready, reader.Current.Status);
        Assert.Equal(1, reader.Current.Readings);
        Assert.Equal(
            new[] { ReaderStatus.Ready, ReaderStatus.CardRead, ReaderStatus.Disconnected, ReaderStatus.Ready },
            updates.Select(update => update.Status));
        Assert.Equal(reader.Current, updates[^1]);

        reader.Dispose();
        Assert.True(device.Disposed);
    }

    [Fact]
    public void DisposingUnstartedNfcReaderDoesNotOpenDevice()
    {
        var opens = 0;
        INfcReader reader = new ReaderMonitor(() =>
        {
            opens++;
            return new FakeReader();
        });

        reader.Dispose();

        Assert.Equal(0, opens);
    }

    [Fact]
    public void HeldCardIsReadOnceAndCanBeReadAgainAfterRemoval()
    {
        var device = new FakeReader { Present = true };
        using var monitor = new ReaderMonitor(() => device);
        monitor.Tick(Start);
        monitor.Tick(Start.AddSeconds(3));
        Assert.Equal(1, monitor.Current.Readings);
        Assert.Equal(1, device.UidRequests);
        device.Present = false;
        monitor.Tick(Start.AddSeconds(4));
        device.Present = true;
        monitor.Tick(Start.AddSeconds(5));
        Assert.Equal(2, monitor.Current.Readings);
        Assert.Equal(Uid, monitor.Current.Uid);
    }

    [Fact]
    public void TwentyPresentationsYieldExactlyTwentyReadings()
    {
        var device = new FakeReader();
        using var monitor = new ReaderMonitor(() => device);
        for (var i = 0; i < 20; i++)
        {
            device.Present = false;
            monitor.Tick(Start.AddSeconds(i * 4));
            device.Present = true;
            monitor.Tick(Start.AddSeconds(i * 4 + 2));
            monitor.Tick(Start.AddSeconds(i * 4 + 3));
            Assert.Equal(i + 1, monitor.Current.Readings);
            Assert.Equal(Uid, monitor.Current.Uid);
        }
        Assert.Equal(20, device.UidRequests);
    }

    [Fact]
    public void RapidSameUidIsSuppressedButDifferentUidIsAccepted()
    {
        var device = new FakeReader { Present = true };
        using var monitor = new ReaderMonitor(() => device);
        monitor.Tick(Start);
        device.Present = false;
        monitor.Tick(Start.AddMilliseconds(200));
        device.Present = true;
        monitor.Tick(Start.AddMilliseconds(400));
        Assert.Equal(1, monitor.Current.Readings);
        device.Present = false;
        monitor.Tick(Start.AddMilliseconds(600));
        device.Present = true;
        device.Uid = "04E50142E37385";
        monitor.Tick(Start.AddMilliseconds(800));
        Assert.Equal(2, monitor.Current.Readings);
    }

    [Fact]
    public void SameUidIsAcceptedAtOneSecondBoundary()
    {
        var device = new FakeReader { Present = true };
        using var monitor = new ReaderMonitor(() => device);
        monitor.Tick(Start);
        device.Present = false;
        monitor.Tick(Start.AddMilliseconds(500));
        device.Present = true;
        monitor.Tick(Start.AddSeconds(1));
        Assert.Equal(2, monitor.Current.Readings);
    }

    [Fact]
    public void ReaderLossReopensContextWithoutCountingCardUntilRemoval()
    {
        var device = new FakeReader { Present = true };
        var recovered = new FakeReader { Present = true };
        var opens = 0;
        using var monitor = new ReaderMonitor(() => ++opens == 1 ? device : recovered);
        monitor.Tick(Start);
        device.Failure = new PcscException(0x80100017, "Read UID");
        monitor.Tick(Start.AddSeconds(2));
        Assert.True(device.Disposed);
        Assert.Equal(ReaderStatus.Disconnected, monitor.Current.Status);
        monitor.Tick(Start.AddSeconds(3));
        Assert.Equal(0, recovered.UidRequests);
        Assert.Equal(1, monitor.Current.Readings);
        recovered.Present = false;
        monitor.Tick(Start.AddSeconds(4));
        recovered.Present = true;
        monitor.Tick(Start.AddSeconds(5));
        Assert.Equal(2, monitor.Current.Readings);
        Assert.Equal(2, opens);
    }

    [Fact]
    public void MissingReaderRecoversWhenItAppears()
    {
        var device = new FakeReader { Names = [] };
        using var monitor = new ReaderMonitor(() => device);
        monitor.Tick(Start);
        Assert.Equal(ReaderStatus.Disconnected, monitor.Current.Status);
        device.Names = [Name];
        monitor.Tick(Start.AddSeconds(1));
        Assert.Equal(ReaderStatus.Ready, monitor.Current.Status);
    }

    [Fact]
    public void InterruptedTransmitIsNotCountedAndRecoversAfterRemoval()
    {
        var device = new FakeReader
        {
            Present = true,
            ReadFailure = new PcscException(0x80100017, "Read UID"),
            DisposeFailure = new PcscException(0x80100006, "Release context")
        };
        var recovered = new FakeReader { Present = true };
        var opens = 0;
        using var monitor = new ReaderMonitor(() => ++opens == 1 ? device : recovered);
        monitor.Tick(Start);
        Assert.Equal(ReaderStatus.Disconnected, monitor.Current.Status);
        Assert.Contains("liberation du contexte", monitor.Current.Message);
        Assert.Equal(0, monitor.Current.Readings);
        monitor.Tick(Start.AddSeconds(1));
        Assert.Equal(0, recovered.UidRequests);
        recovered.Present = false;
        monitor.Tick(Start.AddSeconds(2));
        recovered.Present = true;
        monitor.Tick(Start.AddSeconds(3));
        Assert.Equal(1, monitor.Current.Readings);
    }

    [Fact]
    public void MultipleReadersAreAnExplicitErrorAndSamIsExcluded()
    {
        var device = new FakeReader { Names = [Name, "ACS ACR1555U SECOND PICC 0"] };
        using var monitor = new ReaderMonitor(() => device);
        monitor.Tick(Start);
        Assert.Equal(ReaderStatus.Error, monitor.Current.Status);
        device.Names = [Name, "ACS ACR1555U TEST SAM 0"];
        monitor.Tick(Start.AddSeconds(1));
        Assert.Equal(ReaderStatus.Ready, monitor.Current.Status);
    }

    [Fact]
    public void CardRemovedDuringReadIsNotCounted()
    {
        var device = new FakeReader { Present = true, Uid = null };
        using var monitor = new ReaderMonitor(() => device);
        monitor.Tick(Start);
        Assert.Equal(0, monitor.Current.Readings);
        Assert.Null(monitor.Current.Uid);
        device.Uid = Uid;
        monitor.Tick(Start.AddSeconds(2));
        Assert.Equal(1, monitor.Current.Readings);
    }

    [Fact]
    public void InvalidCardResponseIsVisibleAndRequiresRemoval()
    {
        var device = new FakeReader { Present = true, Failure = new InvalidDataException("Invalid UID") };
        using var monitor = new ReaderMonitor(() => device);
        monitor.Tick(Start);
        Assert.Equal(ReaderStatus.Error, monitor.Current.Status);
        Assert.Contains("Invalid UID", monitor.Current.Message);
        device.Failure = null;
        monitor.Tick(Start.AddSeconds(1));
        Assert.Equal(0, monitor.Current.Readings);
        Assert.Equal(ReaderStatus.Error, monitor.Current.Status);
        device.Present = false;
        monitor.Tick(Start.AddSeconds(2));
        Assert.Equal(ReaderStatus.Ready, monitor.Current.Status);
    }

    [Fact]
    public void NonConnectivityPcscErrorIsNotReportedAsReady()
    {
        using var monitor = new ReaderMonitor(() => throw new PcscException(0x8010000B, "Sharing violation"));
        monitor.Tick(Start);
        Assert.Equal(ReaderStatus.Error, monitor.Current.Status);
        Assert.Contains("8010000B", monitor.Current.Message);
    }

    [Fact]
    public void UnchangedStateDoesNotFloodDiagnosticEvents()
    {
        using var monitor = new ReaderMonitor(() => new FakeReader());
        var updates = 0;
        monitor.Updated += _ => updates++;
        monitor.Tick(Start);
        monitor.Tick(Start.AddSeconds(1));
        Assert.Equal(1, updates);
    }

    [Theory]
    [InlineData(4)]
    [InlineData(7)]
    [InlineData(10)]
    public void UidResponseIsNormalizedWithoutStatusWord(int length)
    {
        var uid = Enumerable.Range(1, length).Select(i => (byte)i).ToArray();
        var response = uid.Concat(new byte[] { 0x90, 0 }).ToArray();
        Assert.Equal(Convert.ToHexString(uid), PresenceReader.DecodeUid(response, response.Length));
    }

    [Theory]
    [InlineData(new byte[] { }, 0)]
    [InlineData(new byte[] { 0x90 }, 1)]
    [InlineData(new byte[] { 0x90, 0 }, 3)]
    [InlineData(new byte[] { 1, 2, 3, 0x90, 0 }, 5)]
    [InlineData(new byte[] { 1, 2, 3, 4, 0x6A, 0x82 }, 6)]
    public void MalformedUidResponseFailsExplicitly(byte[] response, int length)
    {
        Assert.Throws<InvalidDataException>(() => PresenceReader.DecodeUid(response, length));
    }

    private sealed class FakeReader : IPcscReader
    {
        public string[] Names { get; set; } = [Name];
        public bool Present { get; set; }
        public string? Uid { get; set; } = ReaderMonitorTests.Uid;
        public Exception? Failure { get; set; }
        public Exception? ReadFailure { get; set; }
        public PcscException? DisposeFailure { get; set; }
        public int UidRequests { get; private set; }
        public bool Disposed { get; private set; }

        public string[] ListReaders() => Names;
        public bool IsCardPresent(string reader)
        {
            if (Failure is PcscException error)
                throw error;
            return Present;
        }
        public string ReadUid(string reader)
        {
            UidRequests++;
            if (ReadFailure is not null)
                throw ReadFailure;
            if (Failure is not null)
                throw Failure;
            return Uid!;
        }
        public void Dispose()
        {
            Disposed = true;
            if (DisposeFailure is not null)
                throw DisposeFailure;
        }
    }
}

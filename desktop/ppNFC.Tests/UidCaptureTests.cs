namespace ppNFC.Tests;

public sealed class UidCaptureTests
{
    private static ReaderUpdate Update(int readings, ReaderStatus status = ReaderStatus.CardRead, string uid = "04E50142E37384") =>
        new(status, "ACR1555 PICC", uid, readings, DateTimeOffset.UtcNow, "Test");

    [Fact]
    public async Task CaptureRequiresANewPresentationNotTheLastUid()
    {
        var capture = new UidCapture();
        capture.Observe(Update(1));
        var task = capture.AcquireAsync(TimeSpan.FromSeconds(1), CancellationToken.None);
        capture.Observe(Update(1, ReaderStatus.Ready));
        Assert.False(task.IsCompleted);
        capture.Observe(Update(2, uid: "04E50142E37385"));
        Assert.Equal("04E50142E37385", await task);
    }

    [Fact]
    public async Task OnlyOneEditorCanAcquireAtATime()
    {
        var capture = new UidCapture();
        capture.Observe(Update(0, ReaderStatus.Ready));
        var first = capture.AcquireAsync(TimeSpan.FromSeconds(1), CancellationToken.None);
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => capture.AcquireAsync(TimeSpan.FromSeconds(1), CancellationToken.None));
        capture.Observe(Update(1));
        Assert.Equal("04E50142E37384", await first);
    }

    [Fact]
    public async Task CancellationReleasesCaptureForTheNextEditor()
    {
        var capture = new UidCapture();
        capture.Observe(Update(0, ReaderStatus.Ready));
        using var stop = new CancellationTokenSource();
        var task = capture.AcquireAsync(TimeSpan.FromSeconds(1), stop.Token);
        stop.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => task);
        var next = capture.AcquireAsync(TimeSpan.FromSeconds(1), CancellationToken.None);
        capture.Observe(Update(1));
        Assert.Equal("04E50142E37384", await next);
    }

    [Fact]
    public async Task TimeoutDoesNotReturnAStaleUid()
    {
        var capture = new UidCapture();
        capture.Observe(Update(1));
        await Assert.ThrowsAsync<TimeoutException>(
            () => capture.AcquireAsync(TimeSpan.FromMilliseconds(10), CancellationToken.None));
    }

    [Fact]
    public async Task ReaderDisconnectionFailsTheAcquisition()
    {
        var capture = new UidCapture();
        capture.Observe(Update(0, ReaderStatus.Ready));
        var task = capture.AcquireAsync(TimeSpan.FromSeconds(1), CancellationToken.None);
        capture.Observe(Update(0, ReaderStatus.Disconnected));
        await Assert.ThrowsAsync<IOException>(() => task);
        await Assert.ThrowsAsync<IOException>(
            () => capture.AcquireAsync(TimeSpan.FromSeconds(1), CancellationToken.None));
    }
}

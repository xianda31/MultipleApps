using System.Net;
using System.Net.Http.Json;

namespace ppNFC.Tests;

public sealed class LocalCaptureServerTests
{
    private const string Origin = "http://localhost:4200";

    [Theory]
    [InlineData("http://localhost:4200", true)]
    [InlineData("https://admin.example.test", true)]
    [InlineData("http://admin.example.test", false)]
    [InlineData("https://admin.example.test/path", false)]
    [InlineData("https://admin.example.test/", false)]
    [InlineData("null", false)]
    public void OriginsMustBeExactHttpsOrLoopbackOrigins(string origin, bool expected) =>
        Assert.Equal(expected, LocalCaptureServer.IsValidOrigin(origin));

    [Fact]
    public async Task ServerRejectsUntrustedOriginsAndRequestsWithoutEditorHeader()
    {
        await using var server = new LocalCaptureServer(new UidCapture(), [Origin], 0);
        await server.StartAsync(CancellationToken.None);
        using var client = new HttpClient { BaseAddress = new Uri(server.Address) };
        using var untrusted = new HttpRequestMessage(HttpMethod.Post, "/capture");
        untrusted.Headers.Add("Origin", "https://untrusted.example.test");
        untrusted.Headers.Add("X-ppNFC-Editor", "1");
        using var denied = await client.SendAsync(untrusted);
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        Assert.False(denied.Headers.Contains("Access-Control-Allow-Origin"));
        using var missingHeader = new HttpRequestMessage(HttpMethod.Post, "/capture");
        missingHeader.Headers.Add("Origin", Origin);
        using var deniedHeader = await client.SendAsync(missingHeader);
        Assert.Equal(HttpStatusCode.Forbidden, deniedHeader.StatusCode);
        await server.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TrustedPreflightAllowsOnlyTheEditorPost()
    {
        await using var server = new LocalCaptureServer(new UidCapture(), [Origin], 0);
        await server.StartAsync(CancellationToken.None);
        using var client = new HttpClient { BaseAddress = new Uri(server.Address) };
        using var request = new HttpRequestMessage(HttpMethod.Options, "/capture");
        request.Headers.Add("Origin", Origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "x-ppnfc-editor");
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(Origin, response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal("true", response.Headers.GetValues("Access-Control-Allow-Private-Network").Single());
        await server.StopAsync(CancellationToken.None);
    }

    [Fact]
    public async Task TrustedPostReturnsAFreshUidAndShutdownCancelsPendingRequests()
    {
        var capture = new UidCapture();
        capture.Observe(new(ReaderStatus.Ready, "ACR1555 PICC", null, 0, null, "Pret"));
        await using var server = new LocalCaptureServer(capture, [Origin], 0);
        await server.StartAsync(CancellationToken.None);
        using var client = new HttpClient { BaseAddress = new Uri(server.Address) };
        using var request = Request();
        var responseTask = client.SendAsync(request);
        await WaitForCapture(capture);
        capture.Observe(new(ReaderStatus.CardRead, "ACR1555 PICC", "04E50142E37384", 1, DateTimeOffset.UtcNow, "Lu"));
        using var response = await responseTask;
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.Equal("04E50142E37384", body!["uid"]);
        using var second = Request();
        var pendingResponse = client.SendAsync(second);
        await WaitForCapture(capture);
        await server.StopAsync(CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(3));
        await Assert.ThrowsAsync<HttpRequestException>(() => pendingResponse);
    }

    private static HttpRequestMessage Request()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/capture");
        request.Headers.Add("Origin", Origin);
        request.Headers.Add("X-ppNFC-Editor", "1");
        return request;
    }

    private static async Task WaitForCapture(UidCapture capture)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        while (!capture.IsCapturing)
            await Task.Delay(10, timeout.Token);
    }
}

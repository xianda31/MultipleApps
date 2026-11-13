#nullable enable

using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace ppNFC;

public sealed class LocalCaptureServer : IAsyncDisposable
{
    public const int Port = 17835;
    public static readonly string OriginsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ppNFC", "editor-origins.json");
    private readonly WebApplication _app;

    public LocalCaptureServer(UidCapture capture, IReadOnlyCollection<string> origins, int port = Port)
    {
        if (origins.Count == 0 || origins.Any(origin => !IsValidOrigin(origin)))
            throw new InvalidDataException("La liste des origines de l'editeur ppNFC est invalide.");
        var allowed = origins.ToHashSet(StringComparer.Ordinal);
        var builder = WebApplication.CreateSlimBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseKestrel(options => options.Listen(IPAddress.Loopback, port));
        _app = builder.Build();
        _app.Use(async (context, next) =>
        {
            var origin = context.Request.Headers.Origin.ToString();
            if (context.Request.Host.Host != "127.0.0.1" || !allowed.Contains(origin))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsJsonAsync(new { message = "Origine non autorisee dans ppNFC." });
                return;
            }
            context.Response.Headers.AccessControlAllowOrigin = origin;
            context.Response.Headers.Vary = "Origin";
            context.Response.Headers.CacheControl = "no-store";
            if (context.Request.Method == "OPTIONS")
            {
                if (context.Request.Headers.AccessControlRequestMethod != "POST"
                    || !string.Equals(context.Request.Headers.AccessControlRequestHeaders.ToString(),
                        "x-ppnfc-editor", StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    return;
                }
                context.Response.Headers.AccessControlAllowMethods = "POST";
                context.Response.Headers.AccessControlAllowHeaders = "X-ppNFC-Editor";
                context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
                context.Response.StatusCode = StatusCodes.Status204NoContent;
                return;
            }
            if (context.Request.Headers["X-ppNFC-Editor"] != "1")
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }
            await next(context);
        });
        _app.MapPost("/capture", async (HttpContext context) =>
        {
            using var stop = CancellationTokenSource.CreateLinkedTokenSource(
                context.RequestAborted, _app.Lifetime.ApplicationStopping);
            try
            {
                var uid = await capture.AcquireAsync(TimeSpan.FromSeconds(30), stop.Token);
                await context.Response.WriteAsJsonAsync(new { uid });
            }
            catch (TimeoutException)
            {
                context.Response.StatusCode = StatusCodes.Status408RequestTimeout;
                await context.Response.WriteAsJsonAsync(new { message = "Aucune nouvelle carte lue en 30 secondes." });
            }
            catch (InvalidOperationException error)
            {
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                await context.Response.WriteAsJsonAsync(new { message = error.Message });
            }
            catch (IOException error)
            {
                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                await context.Response.WriteAsJsonAsync(new { message = error.Message });
            }
            catch (OperationCanceledException) when (stop.IsCancellationRequested)
            {
                context.Abort();
            }
        });
    }

    public string Address => _app.Urls.Single();
    public Task StartAsync(CancellationToken cancellationToken) => _app.StartAsync(cancellationToken);
    public Task StopAsync(CancellationToken cancellationToken) => _app.StopAsync(cancellationToken);
    public ValueTask DisposeAsync() => _app.DisposeAsync();

    public static string[] LoadOrigins() => File.Exists(OriginsPath)
        ? JsonSerializer.Deserialize<string[]>(File.ReadAllText(OriginsPath))
            ?? throw new InvalidDataException("La liste des origines ppNFC est vide.")
        : ["http://localhost:4200"];

    public static bool IsValidOrigin(string origin) =>
        Uri.TryCreate(origin, UriKind.Absolute, out var uri)
        && uri.GetLeftPart(UriPartial.Authority) == origin
        && string.IsNullOrEmpty(uri.UserInfo)
        && (uri.Scheme == "https" || (uri.Scheme == "http" && uri.IsLoopback));
}

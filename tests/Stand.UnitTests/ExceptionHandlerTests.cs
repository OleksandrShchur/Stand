using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Stand.Server.Common;

namespace Stand.UnitTests;

public class ExceptionHandlerTests
{
    [Theory]
    [InlineData(400)] [InlineData(401)] [InlineData(404)] [InlineData(409)] [InlineData(500)]
    public async Task ErrorsHaveConsistentPublicProblemDetailsWithoutInternalMessages(int status)
    {
        using var services = new ServiceCollection().AddLogging().AddOptions().BuildServiceProvider();
        var context = new DefaultHttpContext { RequestServices = services };
        context.Response.Body = new MemoryStream();
        Exception exception = status switch
        {
            400 => new ValidationAppException("Public message"),
            401 => new UnauthorizedAppException(ErrorCodes.InvalidCredentials, "Public message"),
            404 => new NotFoundAppException(ErrorCodes.NotFound, "Public message"),
            409 => new ConflictAppException(ErrorCodes.SlotFull, "Public message"),
            _ => new InvalidOperationException("SECRET database credentials"),
        };
        Assert.True(await new GlobalExceptionHandler(NullLogger<GlobalExceptionHandler>.Instance).TryHandleAsync(context, exception, default));
        Assert.Equal(status, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal(status, json.RootElement.GetProperty("status").GetInt32());
        Assert.True(json.RootElement.TryGetProperty("errorCode", out var code));
        Assert.Equal("https://stand.local/errors/" + code.GetString(), json.RootElement.GetProperty("type").GetString());
        Assert.DoesNotContain("SECRET", json.RootElement.GetRawText());
        if (status != 500) Assert.Equal("Public message", json.RootElement.GetProperty("title").GetString());
    }
}

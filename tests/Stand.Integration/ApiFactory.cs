using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Stand.Server.Data;

public sealed class ApiFactory : WebApplicationFactory<global::Program>
{
    // Never inherit the application connection string or credentials.
    public const string Connection = "Server=(localdb)\\MSSQLLocalDB;Database=StandPerfTest;Trusted_Connection=True;TrustServerCertificate=True";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", Connection);
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<StandDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<StandDbContext>>();
            services.AddDbContext<StandDbContext>(options => options.UseSqlServer(Connection));
        });
    }

    public HttpClient NewClient() => CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"),
        AllowAutoRedirect = false,
    });

    public StandDbContext NewDb() => new(new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(Connection).Options);
}

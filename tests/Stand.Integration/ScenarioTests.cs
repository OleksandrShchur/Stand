[assembly: CollectionBehavior(DisableTestParallelization = true)]

[Collection(SqlDatabaseCollection.Name)]
public sealed class ScenarioTests
{
    [Fact]
    public async Task SqlBookingScheduleAndMigrationRegressions()
    {
        // Existing checks read the checked-in migration scripts relative to the repo.
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "Stand.slnx"))) root = root.Parent;
        Assert.NotNull(root);
        var previous = Directory.GetCurrentDirectory();
        try
        {
            Directory.SetCurrentDirectory(root.FullName);
            await LegacyChecks.RunAsync([]);
        }
        finally { Directory.SetCurrentDirectory(previous); }
    }
}

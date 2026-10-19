using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Stand.Server.Common;
using Stand.Server.Controllers.Admin;
using Stand.Server.Dtos.Admin;
using Stand.Server.Options;
using Stand.Server.Services;

internal static class ScheduleArchiveChecks
{
    // These boundary checks deliberately have no database: a rejected request
    // must fail before any schedule or calendar rows can be queried or changed.
    public static async Task Run()
    {
        var clock = new ArchiveClock(new DateOnly(2026, 10, 20));
        var options = Options.Create(new BookingOptions());
        var schedule = new AdminScheduleController(null!, options, clock);
        var calendar = new AdminDatesController(null!, clock);
        var exceptions = new AdminExceptionsController(null!, clock);
        async Task Rejected(Func<Task<IActionResult>> action, string description)
        {
            try { await action(); }
            catch (ValidationAppException error) when (error.StatusCode == 400 && error.Message.Contains("Архів"))
            { Console.WriteLine("PASS " + description); return; }
            throw new Exception("Archive write accepted: " + description);
        }
        SaveScheduleDto Plan(params string[] dates) => new(dates.ToList(), true, [], true);
        await Rejected(() => schedule.Save(Plan("2026-10-19"), default), "Direct schedule save rejects yesterday before database access");
        await Rejected(() => schedule.Preview(Plan("2026-10-19"), default), "Preview rejects an archived destination");
        await Rejected(() => schedule.Save(Plan("2026-10-21", "2026-10-19"), default), "A mixed bulk copy is rejected as a whole");
        await Rejected(() => calendar.Set(new("2026-10-19", true), default), "Legacy API cannot activate an archived day");
        await Rejected(() => calendar.Set(new("2026-10-19", false), default), "Legacy API cannot close an archived day");
        await Rejected(() => calendar.Bulk(new(2026, 10, [], true), default), "Legacy month updates cannot alter past dates");
        await Rejected(() => exceptions.Upsert(new("2026-10-19", 1, true, null), default), "Legacy API cannot change archived intervals");

        ScheduleArchive.EnsureEditable([clock.TodayLocal, clock.TodayLocal.AddDays(1)], clock.TodayLocal);
        Console.WriteLine("PASS Today and future days remain editable");
        clock.TodayLocal = clock.TodayLocal.AddDays(1);
        await Rejected(() => schedule.Save(Plan("2026-10-20"), default), "A day becomes immutable at the next Kyiv date");
    }

    private sealed class ArchiveClock(DateOnly today) : IKyivClock
    {
        public DateOnly TodayLocal { get; set; } = today;
        public DateTime NowLocal => TodayLocal.ToDateTime(TimeOnly.MinValue);
        public DateTime UtcNow => NowLocal.AddHours(-3);
        public DateTime ToUtc(DateTime localTime) => localTime.AddHours(-3);
    }
}

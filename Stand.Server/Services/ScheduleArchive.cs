using Stand.Server.Common;

namespace Stand.Server.Services;

public static class ScheduleArchive
{
    public static void EnsureEditable(IEnumerable<DateOnly> dates, DateOnly today)
    {
        if (dates.Any(date => date < today))
            throw new ValidationAppException("Архівний розклад не можна змінювати. Оберіть сьогоднішню або майбутню дату.");
    }
}

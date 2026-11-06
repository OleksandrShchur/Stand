using Stand.Server.Common;

namespace Stand.Server.Services;

public static class StatisticsPeriod
{
    public static (DateOnly From, DateOnly To) GetRange(string period, int year, int? month, int? quarter)
    {
        if (year is < 1 or > 9998) throw new ValidationAppException("Оберіть коректний рік.");
        return period switch
        {
            "month" when month is >= 1 and <= 12 && quarter is null =>
                (new(year, month.Value, 1), new DateOnly(year, month.Value, 1).AddMonths(1).AddDays(-1)),
            "quarter" when quarter is >= 1 and <= 4 && month is null =>
                (new(year, (quarter.Value - 1) * 3 + 1, 1), new DateOnly(year, (quarter.Value - 1) * 3 + 1, 1).AddMonths(3).AddDays(-1)),
            "year" when month is null && quarter is null => (new(year, 1, 1), new(year, 12, 31)),
            _ => throw new ValidationAppException("Оберіть місяць, квартал або рік та відповідний період."),
        };
    }
}

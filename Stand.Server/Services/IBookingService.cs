using Stand.Server.Dtos.Public;

namespace Stand.Server.Services;

public interface IBookingService
{
    Task<List<MyShiftDto>> GetMyUpcomingShiftsAsync(int authorizedUserId, CancellationToken ct);

    Task<BookingSummaryDto> BookAsync(
        DateOnly date, int locationId, int timeSlotId,
        int authorizedUserId, CancellationToken ct);

    Task<List<BookingSummaryDto>> BookManyAsync(
        DateOnly date, int locationId, IReadOnlyList<int> timeSlotIds,
        int authorizedUserId, CancellationToken ct);

    Task<BookingSummaryDto> GetByCancelTokenAsync(Guid cancelToken, CancellationToken ct);

    Task<BookingSummaryDto> CancelAsync(Guid cancelToken, CancellationToken ct);
}

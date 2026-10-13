using Stand.Server.Dtos.Public;

namespace Stand.Server.Services;

public interface IBookingService
{
    Task<HoldResponseDto> HoldAsync(DateOnly date, int locationId, int timeSlotId, CancellationToken ct);

    Task<BookingSummaryDto> ConfirmAsync(
        Guid holdToken, string firstName, string lastName, string phoneRaw, string? comment, CancellationToken ct);

    Task<BookingSummaryDto> GetByCancelTokenAsync(Guid cancelToken, CancellationToken ct);

    Task<BookingSummaryDto> CancelAsync(Guid cancelToken, CancellationToken ct);
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Common;
using Stand.Server.Controllers.Admin;
using Stand.Server.Data;
using Stand.Server.Data.Entities;

internal static class LocationChecks
{
    public static async Task Run(string connection)
    {
        var options = new DbContextOptionsBuilder<StandDbContext>().UseSqlServer(connection).Options;
        await using var setup = new StandDbContext(options);
        var removable = new Location { Name = "Delete check " + Guid.NewGuid(), IsActive = true, Capacity = 3 };
        var protectedLocation = new Location { Name = "History check " + Guid.NewGuid(), IsActive = true, Capacity = 3 };
        setup.AddRange(removable, protectedLocation);
        await setup.SaveChangesAsync();
        var ids = new[] { removable.Id, protectedLocation.Id };
        var date = await setup.AvailableDates.Select(d => d.Date).FirstAsync();
        var slot = await setup.TimeSlots.Select(s => s.Id).FirstAsync();
        void Check(bool condition, string message)
        {
            if (!condition) throw new Exception(message);
            Console.WriteLine("PASS " + message);
        }
        try
        {
            setup.ScheduleSlots.AddRange(ids.Select(id => new ScheduleSlot { Date = date, LocationId = id, TimeSlotId = slot }));
            var booking = new Booking
            {
                PublicNumber = Guid.NewGuid().ToString("N")[..20], Date = date, TimeSlotId = slot,
                LocationId = protectedLocation.Id, IsBooked = true, Phone = "+380670000001", FirstName = "Delete", LastName = "Check",
            };
            setup.Bookings.Add(booking);
            await setup.SaveChangesAsync();
            foreach (var booked in new[] { true, false })
            {
                booking.IsBooked = booked;
                await setup.SaveChangesAsync();
                await using var db = new StandDbContext(options);
                try
                {
                    await new AdminLocationsController(db).Delete(protectedLocation.Id, default);
                    throw new Exception("Deleted a location with booking history");
                }
                catch (ConflictAppException)
                {
                    Check(await setup.Bookings.AnyAsync(b => b.Id == booking.Id && b.IsBooked == booked)
                        && await setup.ScheduleSlots.AnyAsync(s => s.LocationId == protectedLocation.Id)
                        && await setup.Locations.AnyAsync(l => l.Id == protectedLocation.Id),
                        $"Location deletion preserves {(booked ? "active bookings" : "cancelled booking history")} and its schedule");
                }
            }
            await using (var db = new StandDbContext(options))
                Check(await new AdminLocationsController(db).Delete(removable.Id, default) is NoContentResult,
                    "Location without booking history can be deleted");
            Check(!await setup.Locations.AnyAsync(l => l.Id == removable.Id)
                && !await setup.ScheduleSlots.AnyAsync(s => s.LocationId == removable.Id)
                && await setup.ScheduleSlots.AnyAsync(s => s.LocationId == protectedLocation.Id),
                "Deletion removes only the selected location and its scheduled times");
            await using (var db = new StandDbContext(options))
            {
                try
                {
                    await new AdminLocationsController(db).Delete(removable.Id, default);
                    throw new Exception("Missing location deletion succeeded");
                }
                catch (NotFoundAppException) { Console.WriteLine("PASS Missing location deletion returns not found"); }
            }
        }
        finally
        {
            await using var cleanup = new StandDbContext(options);
            await cleanup.ScheduleSlots.Where(s => ids.Contains(s.LocationId)).ExecuteDeleteAsync();
            await cleanup.Bookings.Where(b => ids.Contains(b.LocationId)).ExecuteDeleteAsync();
            await cleanup.Locations.Where(l => ids.Contains(l.Id)).ExecuteDeleteAsync();
        }
    }
}

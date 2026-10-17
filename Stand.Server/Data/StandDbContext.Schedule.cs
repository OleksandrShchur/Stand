using Microsoft.EntityFrameworkCore;
using Stand.Server.Data.Entities;

namespace Stand.Server.Data;

public partial class StandDbContext
{
    public virtual DbSet<ScheduleSlot> ScheduleSlots { get; set; }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ScheduleSlot>(entity =>
        {
            entity.HasKey(e => new { e.Date, e.LocationId, e.TimeSlotId });
            entity.HasIndex(e => e.TimeSlotId, "IX_ScheduleSlots_TimeSlotId");
            entity.HasOne(e => e.AvailableDate).WithMany().HasForeignKey(e => e.Date)
                .HasPrincipalKey(e => e.Date).OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("FK_ScheduleSlots_AvailableDates");
            entity.HasOne(e => e.Location).WithMany().HasForeignKey(e => e.LocationId).OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("FK_ScheduleSlots_Locations");
            entity.HasOne(e => e.TimeSlot).WithMany().HasForeignKey(e => e.TimeSlotId).OnDelete(DeleteBehavior.ClientSetNull).HasConstraintName("FK_ScheduleSlots_TimeSlots");
        });
    }
}

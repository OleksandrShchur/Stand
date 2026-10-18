using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Stand.Server.Data.Entities;

namespace Stand.Server.Data;

public partial class StandDbContext : DbContext
{
    public StandDbContext(DbContextOptions<StandDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AdminUser> AdminUsers { get; set; }

    public virtual DbSet<AuthorizedUser> AuthorizedUsers { get; set; }

    public virtual DbSet<AvailableDate> AvailableDates { get; set; }

    public virtual DbSet<Booking> Bookings { get; set; }

    public virtual DbSet<DateTimeSlotException> DateTimeSlotExceptions { get; set; }

    public virtual DbSet<Location> Locations { get; set; }

    public virtual DbSet<SchemaVersion> SchemaVersions { get; set; }

    public virtual DbSet<TimeSlot> TimeSlots { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AdminUser>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__AdminUse__3214EC07A7E5D737");

            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())", "DF_AdminUsers_CreatedAtUtc");
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_AdminUsers_IsActive");
        });

        modelBuilder.Entity<AuthorizedUser>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Authoriz__3214EC07F3C8B4A2");

            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())", "DF_AuthorizedUsers_CreatedAtUtc");
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_AuthorizedUsers_IsActive");
        });

        modelBuilder.Entity<AvailableDate>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Availabl__3214EC07549A1293");

            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())", "DF_AvailableDates_CreatedAtUtc");
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_AvailableDates_IsActive");
        });

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Bookings__3214EC073F32DF7C");

            entity.HasIndex(e => new { e.Phone, e.Date, e.LocationId, e.TimeSlotId }, "UQ_Bookings_Phone_Date_Location_TimeSlot")
                .IsUnique()
                .HasFilter("([IsBooked]=1 AND [Phone] IS NOT NULL)");

            entity.Property(e => e.CancelToken).HasDefaultValueSql("(newid())", "DF_Bookings_CancelToken");
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())", "DF_Bookings_CreatedAtUtc");
            entity.Property(e => e.IsBooked).HasDefaultValue(true, "DF_Bookings_IsBooked");

            entity.HasOne(d => d.Location).WithMany(p => p.Bookings)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bookings_Locations");

            entity.HasOne(d => d.TimeSlot).WithMany(p => p.Bookings)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Bookings_TimeSlots");
        });

        modelBuilder.Entity<DateTimeSlotException>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__DateTime__3214EC07224C4401");

            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())", "DF_DateTimeSlotExceptions_CreatedAtUtc");
            entity.Property(e => e.IsBlocked).HasDefaultValue(true, "DF_DateTimeSlotExceptions_IsBlocked");

            entity.HasOne(d => d.TimeSlot).WithMany(p => p.DateTimeSlotExceptions)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_DateTimeSlotExceptions_TimeSlots");
        });

        modelBuilder.Entity<Location>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Location__3214EC073E291BC5");

            entity.Property(e => e.Capacity).HasDefaultValue(2, "DF_Locations_Capacity");
            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())", "DF_Locations_CreatedAtUtc");
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_Locations_IsActive");
        });

        modelBuilder.Entity<SchemaVersion>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK____Schema__3214EC0716D923FC");

            entity.Property(e => e.AppliedOnUtc).HasDefaultValueSql("(sysutcdatetime())", "DF___SchemaVersions_AppliedOnUtc");
        });

        modelBuilder.Entity<TimeSlot>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__TimeSlot__3214EC07B64E63F5");

            entity.Property(e => e.CreatedAtUtc).HasDefaultValueSql("(sysutcdatetime())", "DF_TimeSlots_CreatedAtUtc");
            entity.Property(e => e.IsActive).HasDefaultValue(true, "DF_TimeSlots_IsActive");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

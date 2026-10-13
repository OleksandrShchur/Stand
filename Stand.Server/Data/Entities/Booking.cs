using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Index("Date", "LocationId", "TimeSlotId", "Status", Name = "IX_Bookings_Date_Location_TimeSlot_Status")]
[Index("CancelToken", Name = "UQ_Bookings_CancelToken", IsUnique = true)]
[Index("PublicNumber", Name = "UQ_Bookings_PublicNumber", IsUnique = true)]
public partial class Booking
{
    [Key]
    public int Id { get; set; }

    [StringLength(30)]
    public string PublicNumber { get; set; } = null!;

    public int LocationId { get; set; }

    public DateOnly Date { get; set; }

    public int TimeSlotId { get; set; }

    [StringLength(100)]
    public string? FirstName { get; set; }

    [StringLength(100)]
    public string? LastName { get; set; }

    [StringLength(20)]
    public string? Phone { get; set; }

    [StringLength(500)]
    public string? Comment { get; set; }

    [StringLength(20)]
    public string Status { get; set; } = null!;

    [Precision(3)]
    public DateTime CreatedAtUtc { get; set; }

    [Precision(3)]
    public DateTime? ConfirmedAtUtc { get; set; }

    [Precision(3)]
    public DateTime? CancelledAtUtc { get; set; }

    public Guid CancelToken { get; set; }

    [Precision(3)]
    public DateTime? HoldExpiresAtUtc { get; set; }

    [ForeignKey("LocationId")]
    [InverseProperty("Bookings")]
    public virtual Location Location { get; set; } = null!;

    [ForeignKey("TimeSlotId")]
    [InverseProperty("Bookings")]
    public virtual TimeSlot TimeSlot { get; set; } = null!;
}

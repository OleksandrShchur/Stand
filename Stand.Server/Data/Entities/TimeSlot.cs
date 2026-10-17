using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Index("IsActive", "SortOrder", Name = "IX_TimeSlots_IsActive_SortOrder")]
public partial class TimeSlot
{
    [Key]
    public int Id { get; set; }

    [Precision(0)]
    public TimeOnly StartTime { get; set; }

    [Precision(0)]
    public TimeOnly EndTime { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    public bool IsScheduleOnly { get; set; }

    [Precision(3)]
    public DateTime CreatedAtUtc { get; set; }

    [Precision(3)]
    public DateTime? UpdatedAtUtc { get; set; }

    [InverseProperty("TimeSlot")]
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();

    [InverseProperty("TimeSlot")]
    public virtual ICollection<DateTimeSlotException> DateTimeSlotExceptions { get; set; } = new List<DateTimeSlotException>();
}

using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Index("Date", "TimeSlotId", Name = "UQ_DateTimeSlotExceptions_Date_TimeSlot", IsUnique = true)]
public partial class DateTimeSlotException
{
    [Key]
    public int Id { get; set; }

    public DateOnly Date { get; set; }

    public int TimeSlotId { get; set; }

    public bool IsBlocked { get; set; }

    [StringLength(300)]
    public string? Note { get; set; }

    [Precision(3)]
    public DateTime CreatedAtUtc { get; set; }

    [ForeignKey("TimeSlotId")]
    [InverseProperty("DateTimeSlotExceptions")]
    public virtual TimeSlot TimeSlot { get; set; } = null!;
}

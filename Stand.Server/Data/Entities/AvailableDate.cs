using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Index("Date", Name = "UQ_AvailableDates_Date", IsUnique = true)]
public partial class AvailableDate
{
    [Key]
    public int Id { get; set; }

    public DateOnly Date { get; set; }

    public bool IsActive { get; set; }

    public bool UseCustomSchedule { get; set; }

    [Precision(3)]
    public DateTime CreatedAtUtc { get; set; }

    [Precision(3)]
    public DateTime? UpdatedAtUtc { get; set; }
}

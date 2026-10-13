using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Index("IsActive", "SortOrder", Name = "IX_Locations_IsActive_SortOrder")]
public partial class Location
{
    [Key]
    public int Id { get; set; }

    [StringLength(200)]
    public string Name { get; set; } = null!;

    [StringLength(300)]
    public string? Address { get; set; }

    public int Capacity { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    [Precision(3)]
    public DateTime CreatedAtUtc { get; set; }

    [Precision(3)]
    public DateTime? UpdatedAtUtc { get; set; }

    [InverseProperty("Location")]
    public virtual ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}

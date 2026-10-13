using System;
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Index("Phone", Name = "UQ_AuthorizedUsers_Phone", IsUnique = true)]
public partial class AuthorizedUser
{
    [Key]
    public int Id { get; set; }

    [StringLength(13)]
    public string Phone { get; set; } = null!;

    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    [Precision(3)]
    public DateTime CreatedAtUtc { get; set; }

    [Precision(3)]
    public DateTime? LastLoginAtUtc { get; set; }
}

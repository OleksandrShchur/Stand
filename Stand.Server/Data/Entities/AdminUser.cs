using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Index("Login", Name = "UQ_AdminUsers_Login", IsUnique = true)]
public partial class AdminUser
{
    [Key]
    public int Id { get; set; }

    [StringLength(50)]
    public string Login { get; set; } = null!;

    [StringLength(500)]
    public string PasswordHash { get; set; } = null!;

    public bool IsActive { get; set; }

    [Precision(3)]
    public DateTime CreatedAtUtc { get; set; }

    [Precision(3)]
    public DateTime? LastLoginAtUtc { get; set; }
}

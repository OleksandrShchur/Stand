using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Table("Feedback")]
public sealed class Feedback
{
    public int Id { get; set; }
    public int? AuthorizedUserId { get; set; }
    [StringLength(13)]
    public string Phone { get; set; } = string.Empty;
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;
    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;
    [StringLength(500)]
    public string Comment { get; set; } = string.Empty;
    [Precision(3)]
    public DateTime CreatedAtUtc { get; set; }
}

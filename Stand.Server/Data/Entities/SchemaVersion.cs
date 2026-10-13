using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Stand.Server.Data.Entities;

[Table("__SchemaVersions")]
[Index("ScriptName", Name = "UQ___SchemaVersions_ScriptName", IsUnique = true)]
public partial class SchemaVersion
{
    [Key]
    public int Id { get; set; }

    [StringLength(260)]
    public string ScriptName { get; set; } = null!;

    [StringLength(100)]
    public string? Checksum { get; set; }

    [Precision(3)]
    public DateTime AppliedOnUtc { get; set; }
}

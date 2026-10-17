namespace Stand.Server.Data.Entities;

public partial class ScheduleSlot
{
    public DateOnly Date { get; set; }
    public int LocationId { get; set; }
    public int TimeSlotId { get; set; }
    public virtual Location Location { get; set; } = null!;
    public virtual TimeSlot TimeSlot { get; set; } = null!;
    public virtual AvailableDate AvailableDate { get; set; } = null!;
}

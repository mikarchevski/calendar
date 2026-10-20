namespace MacCalendar.Models;

public class CalendarEvent
{
    public long Id { get; set; }
    public string Title { get; set; } = "";
    public string Start { get; set; } = "";  // ISO 8601
    public string End { get; set; } = "";
    public long CalendarId { get; set; }
    public string? Description { get; set; }
    public bool IsAllDay { get; set; }
}
namespace Calendar.Models;

public class CalendarItem
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#ff6b6b";
    public bool IsVisible { get; set; } = true;
}
using MacCalendar.Models;
using Microsoft.Data.Sqlite;
using System.IO;
using System.Text.Json;
using Calendar.Models;

namespace Calendar.Database;

public static class CalendarDb
{
    private static string DbPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "MacCalendar", "calendar.db");

    public static void Initialize()
    {
        var dir = Path.GetDirectoryName(DbPath)!;
        if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);

        using var conn = new SqliteConnection($"Data Source={DbPath}");
        conn.Open();

        var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS calendars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                is_visible INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                start TEXT NOT NULL,
                end TEXT NOT NULL,
                calendar_id INTEGER NOT NULL,
                description TEXT,
                FOREIGN KEY (calendar_id) REFERENCES calendars(id)
            );
        ";
        cmd.ExecuteNonQuery();

        cmd.CommandText = "PRAGMA table_info(events)";
        var hasAllDayColumn = false;
        using (var reader = cmd.ExecuteReader())
        {
            while (reader.Read())
            {
                if (reader.GetString(1) == "is_all_day")
                {
                    hasAllDayColumn = true;
                    break;
                }
            }

        }

        if (!hasAllDayColumn)
        {
            cmd.CommandText = "ALTER TABLE events ADD COLUMN is_all_day INTEGER NOT NULL DEFAULT 0";
            cmd.ExecuteNonQuery();
        }

        // Добавляем дефолтные календари, если их нет
        cmd.CommandText = "SELECT COUNT(*) FROM calendars";
        var count = Convert.ToInt32(cmd.ExecuteScalar());
        if (count == 0)
        {
            var defaults = new[]
            {
                ("Personal", "#5e5ce6"),
                ("Work", "#ff9f0a"),
                ("Family", "#30d158"),
                ("School", "#bf5af2")
            };
            foreach (var (name, color) in defaults)
            {
                cmd.CommandText = "INSERT INTO calendars (name, color) VALUES (@name, @color)";
                cmd.Parameters.Clear();
                cmd.Parameters.AddWithValue("@name", name);
                cmd.Parameters.AddWithValue("@color", color);
                cmd.ExecuteNonQuery();
            }
        }
    }

    public static List<CalendarItem> GetCalendars()
    {
        using var conn = new SqliteConnection($"Data Source={DbPath}");
        conn.Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, name, color, is_visible FROM calendars";
        var list = new List<CalendarItem>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new CalendarItem
            {
                Id = reader.GetInt64(0),
                Name = reader.GetString(1),
                Color = reader.GetString(2),
                IsVisible = reader.GetInt32(3) == 1
            });
        }
        return list;
    }

    public static List<CalendarEvent> GetEvents()
    {
        using var conn = new SqliteConnection($"Data Source={DbPath}");
        conn.Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id, title, start, end, calendar_id, description, is_all_day FROM events";
        var list = new List<CalendarEvent>();
        using var reader = cmd.ExecuteReader();
        while (reader.Read())
        {
            list.Add(new CalendarEvent
            {
                Id = reader.GetInt64(0),
                Title = reader.GetString(1),
                Start = reader.GetString(2),
                End = reader.GetString(3),
                CalendarId = reader.GetInt64(4),
                Description = reader.IsDBNull(5) ? null : reader.GetString(5),
                IsAllDay = reader.GetInt32(6) == 1
            });
        }
        return list;
    }

    public static void SaveEvent(JsonElement root)
    {
        using var conn = new SqliteConnection($"Data Source={DbPath}");
        conn.Open();
        var cmd = conn.CreateCommand();

        if (root.TryGetProperty("id", out var idEl) && idEl.GetInt64() > 0)
        {
            cmd.CommandText = @"UPDATE events SET title=@t, start=@s, end=@e, 
                                calendar_id=@c, description=@d, is_all_day=@a WHERE id=@id";
            cmd.Parameters.AddWithValue("@id", idEl.GetInt64());
        }
        else
        {
            cmd.CommandText = @"INSERT INTO events (title, start, end, calendar_id, description, is_all_day) 
                                VALUES (@t, @s, @e, @c, @d, @a)";
        }

        var title = root.GetProperty("title").GetString()?.Trim();
        cmd.Parameters.AddWithValue("@t", string.IsNullOrEmpty(title) ? "Без названия" : title);
        cmd.Parameters.AddWithValue("@s", root.GetProperty("start").GetString() ?? "");
        cmd.Parameters.AddWithValue("@e", root.GetProperty("end").GetString() ?? "");
        cmd.Parameters.AddWithValue("@c", root.GetProperty("calendarId").GetInt64());
        var description = root.TryGetProperty("description", out var d)
            && d.ValueKind != JsonValueKind.Null
            && d.ValueKind != JsonValueKind.Undefined
                ? d.GetString()
                : null;
        cmd.Parameters.AddWithValue("@d", (object?)description ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@a",
            root.TryGetProperty("isAllDay", out var allDay) && allDay.GetBoolean() ? 1 : 0);
        cmd.ExecuteNonQuery();
    }

    public static void DeleteEvent(long id)
    {
        using var conn = new SqliteConnection($"Data Source={DbPath}");
        conn.Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "DELETE FROM events WHERE id = @id";
        cmd.Parameters.AddWithValue("@id", id);
        cmd.ExecuteNonQuery();
    }

    public static void SetCalendarVisibility(long id, bool visible)
    {
        using var conn = new SqliteConnection($"Data Source={DbPath}");
        conn.Open();
        var cmd = conn.CreateCommand();
        cmd.CommandText = "UPDATE calendars SET is_visible = @v WHERE id = @id";
        cmd.Parameters.AddWithValue("@v", visible ? 1 : 0);
        cmd.Parameters.AddWithValue("@id", id);
        cmd.ExecuteNonQuery();
    }
}
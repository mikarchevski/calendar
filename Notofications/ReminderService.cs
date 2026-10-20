using System.Media;
using System.Threading;
using System.Windows;
using Calendar.Database;
using MacCalendar.Models;

namespace Calendar.Notifications;

public sealed class ReminderService : IDisposable
{
    private static readonly TimeSpan UpcomingReminderLeadTime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan StartedReminderLeadTime = TimeSpan.FromSeconds(30);
    private readonly object _gate = new();
    private readonly Dictionary<long, ReminderProgress> _progress = new();
    private Timer? _timer;
    private ReminderNotificationWindow? _upcomingWindow;
    private ReminderNotificationWindow? _startedWindow;
    private bool _isDarkTheme;

    public void SetDarkTheme(bool isDarkTheme)
    {
        Application.Current.Dispatcher.BeginInvoke(new Action(() =>
        {
            _isDarkTheme = isDarkTheme;
            _upcomingWindow?.SetDarkTheme(isDarkTheme);
            _startedWindow?.SetDarkTheme(isDarkTheme);
        }));
    }

    public void Start()
    {
        lock (_gate)
        {
            if (_timer is not null) return;
            _timer = new Timer(CheckReminders, null, TimeSpan.Zero, TimeSpan.FromSeconds(5));
        }
    }

    public void Stop()
    {
        lock (_gate)
        {
            _timer?.Dispose();
            _timer = null;
        }

        Application.Current.Dispatcher.BeginInvoke(new Action(() =>
        {
            _upcomingWindow?.Close();
            _startedWindow?.Close();
            _upcomingWindow = null;
            _startedWindow = null;
        }));
    }

    private void CheckReminders(object? state)
    {
        try
        {
            var events = CalendarDb.GetEvents();
            var calendars = CalendarDb.GetCalendars();
            var now = DateTimeOffset.Now;
            var upcoming = new List<CalendarEvent>();
            var started = new List<CalendarEvent>();
            var activeIds = events.Select(item => item.Id).ToHashSet();

            lock (_gate)
            {
                foreach (var id in _progress.Keys.Where(id => !activeIds.Contains(id)).ToArray())
                {
                    _progress.Remove(id);
                }

                foreach (var calendarEvent in events)
                {
                    var calendar = calendars.FirstOrDefault(item => item.Id == calendarEvent.CalendarId);
                    if (calendar is null || !calendar.IsVisible) continue;
                    if (!DateTimeOffset.TryParse(calendarEvent.Start, out var eventStart)) continue;

                    if (!_progress.TryGetValue(calendarEvent.Id, out var progress) ||
                        progress.Start != calendarEvent.Start)
                    {
                        progress = new ReminderProgress(calendarEvent.Start);
                        _progress[calendarEvent.Id] = progress;
                    }

                    if (eventStart <= now)
                    {
                        progress.Stage = ReminderStage.Finished;
                        continue;
                    }

                    var timeUntilStart = eventStart - now;
                    if (timeUntilStart <= StartedReminderLeadTime)
                    {
                        if (progress.Stage is not (ReminderStage.Stopped or ReminderStage.Started))
                        {
                            progress.Stage = ReminderStage.Started;
                            started.Add(calendarEvent);
                        }
                    }
                    else if (timeUntilStart <= UpcomingReminderLeadTime &&
                             progress.Stage == ReminderStage.Waiting)
                    {
                        progress.Stage = ReminderStage.Upcoming;
                        upcoming.Add(calendarEvent);
                    }
                }
            }

            if (upcoming.Count > 0 || started.Count > 0)
            {
                Application.Current.Dispatcher.BeginInvoke(new Action(() =>
                {
                    if (upcoming.Count > 0) ShowNotifications(ReminderStage.Upcoming, upcoming);
                    if (started.Count > 0) ShowNotifications(ReminderStage.Started, started);
                }));
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Reminder error: {ex}");
        }
    }

    private void ShowNotifications(ReminderStage stage, IReadOnlyCollection<CalendarEvent> events)
    {
        var currentWindow = stage == ReminderStage.Upcoming ? _upcomingWindow : _startedWindow;
        if (currentWindow is not null && currentWindow.IsVisible)
        {
            currentWindow.AddEvents(events);
        }
        else
        {
            currentWindow = new ReminderNotificationWindow(stage, events, OnNotificationDismissed, _isDarkTheme);
            if (stage == ReminderStage.Upcoming)
            {
                _upcomingWindow = currentWindow;
            }
            else
            {
                _startedWindow = currentWindow;
            }
            currentWindow.Show();
        }

        SystemSounds.Exclamation.Play();
        currentWindow.Activate();
    }

    private void OnNotificationDismissed(
        ReminderStage stage,
        IReadOnlyCollection<long> eventIds,
        bool stopAll)
    {
        lock (_gate)
        {
            foreach (var id in eventIds)
            {
                if (!_progress.TryGetValue(id, out var progress)) continue;

                if (stopAll)
                {
                    progress.Stage = ReminderStage.Stopped;
                }
                else if (stage == ReminderStage.Upcoming &&
                         progress.Stage == ReminderStage.Upcoming)
                {
                    progress.Stage = ReminderStage.Acknowledged;
                }
            }
        }

        if (stage == ReminderStage.Upcoming)
        {
            _upcomingWindow = null;
        }
        else
        {
            _startedWindow = null;
        }
    }

    public void Dispose() => Stop();

    private sealed class ReminderProgress(string start)
    {
        public string Start { get; } = start;
        public ReminderStage Stage { get; set; } = ReminderStage.Waiting;
    }
}

internal enum ReminderStage
{
    Waiting,
    Upcoming,
    Acknowledged,
    Stopped,
    Started,
    Finished
}

console.log("🚀 ЗАГРУЖЕНА ВЕРСИЯ 20 ФАЙЛА APP.JS");
// === STATE ===
let state = {
    calendars: [],
    events: [],
    currentDate: new Date(),
    currentView: 'workweek',
    editingEventId: null,
    hasReceivedInitialData: false
};

const monthNames = [
    'Январь','Февраль','Март','Апрель','Май','Июнь',
    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'
];
const dayNames = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const dayNamesShort = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

function populateTimeOptions() {
    for (const prefix of ['eventStart', 'eventEnd']) {
        for (const suffix of ['Hour', 'Minute']) {
            const select = document.getElementById(`${prefix}${suffix}`);
            const values = suffix === 'Hour'
                ? Array.from({ length: 24 }, (_, value) => value)
                : [0, 15, 30, 45];
            for (const value of values) {
                const option = document.createElement('option');
                option.value = value.toString().padStart(2, '0');
                option.textContent = option.value;
                select.appendChild(option);
            }
        }
    }
}

function notifyThemeChanged(isDark) {
    sendToBackend({ type: 'setTheme', isDark });
}

function setDateTimeFields(prefix, value) {
    const date = new Date(value);
    const minute = Math.round(date.getMinutes() / 15) * 15;
    if (minute === 60) {
        date.setHours(date.getHours() + 1, 0, 0, 0);
    } else {
        date.setMinutes(minute, 0, 0);
    }
    const dateValue = formatDisplayDate(date);
    document.getElementById(`${prefix}Date`).value = dateValue;
    document.getElementById(`${prefix}NativeDate`).value = formatDateKey(date);
    document.getElementById(`${prefix}Hour`).value = date.getHours().toString().padStart(2, '0');
    document.getElementById(`${prefix}Minute`).value = date.getMinutes().toString().padStart(2, '0');
}

function getDateTimeValue(prefix) {
    const dateInput = document.getElementById(`${prefix}Date`);
    const date = parseDisplayDate(dateInput.value);
    if (!date) {
        dateInput.setCustomValidity('Введите дату в формате ДД.ММ.ГГГГ.');
        dateInput.reportValidity();
        dateInput.setCustomValidity('');
        return null;
    }

    const hour = document.getElementById(`${prefix}Hour`).value;
    const minute = document.getElementById(`${prefix}Minute`).value;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(hour), Number(minute)).toISOString();
}

function parseDisplayDate(value) {
    const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
    if (!match) return null;

    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
        ? date
        : null;
}

function formatDisplayDate(date) {
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
}

// === COMMUNICATION WITH C# ===
function sendToBackend(message) {
    console.log('[JS] Отправляем в C#:', message);

    if (window.chrome?.webview) {
        console.log('[JS] chrome.webview найден');
        window.chrome.webview.postMessage(JSON.stringify(message));  // отправляем строку
    } else {
        console.error('[JS] chrome.webview НЕ НАЙДЕН!');
    }
}


if (window.chrome?.webview) {
    window.chrome.webview.addEventListener('message', (e) => {
        const data = e.data;  // ← уже объект, парсить не нужно
                console.log('[JS] Получено от C#:', data);  // ← ДОБАВЬ

        if (data.type === 'init') {
            const preserveScroll = state.hasReceivedInitialData;
            state.calendars = data.calendars;
            state.events = data.events;
            state.hasReceivedInitialData = true;
            console.log('[JS] Calendars:', state.calendars);  // ← ДОБАВЬ

            render({ preserveScroll });
        }
    });
}

// === RENDER ===
function render({ preserveScroll = false } = {}) {
    const currentScrollTop = preserveScroll
        ? document.querySelector('.week-body-row')?.scrollTop
        : undefined;
    renderCalendarsList();
    renderMiniCalendar();
    renderToolbar();
    renderCalendarBody();
    if (currentScrollTop !== undefined) {
        const weekBody = document.querySelector('.week-body-row');
        if (weekBody) weekBody.scrollTop = currentScrollTop;
    }
}

function renderCalendarsList() {
    const container = document.getElementById('calendarsList');
    container.innerHTML = state.calendars.map(cal => `
        <label class="calendar-item">
            <input type="checkbox" 
                   ${cal.IsVisible ? 'checked' : ''} 
                   onchange="toggleCalendar(${cal.Id}, this.checked)">
            <span class="calendar-dot" style="background:${cal.Color}"></span>
            <span>${cal.Name}</span>
        </label>
    `).join('');
}

window.toggleCalendar = (id, visible) => {
    const calendar = state.calendars.find(cal => cal.Id === id);
    if (!calendar) return;

    calendar.IsVisible = visible;
    document.querySelectorAll(`.event-block[data-calendar-id="${id}"], .all-day-event[data-calendar-id="${id}"], .month-event[data-calendar-id="${id}"]`).forEach(event => {
        event.style.display = visible ? '' : 'none';
    });
    sendToBackend({ type: 'toggleCalendar', id, visible });
};

function renderMiniCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    document.getElementById('miniMonthYear').textContent = 
        `${monthNames[month]} ${year}`;

    const grid = document.getElementById('miniCalGrid');
    let html = dayNamesShort.map(d => `<div class="day-name">${d}</div>`).join('');

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const today = new Date();

    // Дни предыдущего месяца
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, prevLastDay - i);
        html += `<div class="day other-month" data-date="${formatDateKey(date)}">${prevLastDay - i}</div>`;
    }
    // Дни текущего месяца
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const date = new Date(year, month, d);
        const isToday = d === today.getDate() && 
                        month === today.getMonth() && 
                        year === today.getFullYear();
        const isSelected = formatDateKey(date) === formatDateKey(state.currentDate);
        html += `<div class="day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" data-date="${formatDateKey(date)}">${d}</div>`;
    }
    // Дни следующего месяца
    const totalCells = startOffset + lastDay.getDate();
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        html += `<div class="day other-month" data-date="${formatDateKey(date)}">${i}</div>`;
    }

    grid.innerHTML = html;
}

function renderToolbar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const title = state.currentView === 'year'
        ? year.toString()
        : state.currentView === 'day'
            ? `${state.currentDate.getDate()} ${monthNames[month]} ${year}`
            : `${monthNames[month]} ${year}`;
    document.getElementById('currentPeriodTitle').textContent = title;

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === state.currentView);
    });
}

function renderCalendarBody() {
    const body = document.getElementById('calendarBody');
    if (['day', 'workweek', 'week'].includes(state.currentView)) {
        body.innerHTML = renderTimeGrid();
        updateCurrentTimeLine();
        scrollToCurrentTime();
    } else if (state.currentView === 'month') {
        body.innerHTML = renderMonthView();
    } else {
        body.innerHTML = renderYearView();
    }
}
function scrollToCurrentTime() {
    const weekBody = document.querySelector('.week-body-row');
    if (!weekBody) return;

    const now = new Date();
    const isTodayVisible = [...document.querySelectorAll('.day-column')]
        .some(column => column.dataset.date === formatDateKey(now));
    const scrollDate = isTodayVisible ? now : new Date(state.currentDate);
    const currentHour = isTodayVisible ? scrollDate.getHours() : 9;
    const currentMinutes = isTodayVisible ? scrollDate.getMinutes() : 0;

    // Показываем текущий час и 3 часа до него
    const targetHour = Math.max(0, currentHour - 3);

    // 60px на каждый час + смещение минут
    const scrollTop = (targetHour * 60) + (currentMinutes * 1);

    weekBody.scrollTop = scrollTop;
}
function getViewName(v) {
    return { day: 'День', workweek: 'Рабочая неделя', week: 'Неделя', month: 'Месяц', year: 'Год' }[v] || v;
}

function renderTimeGrid() {
    const days = state.currentView === 'day'
        ? [new Date(state.currentDate)]
        : Array.from({ length: state.currentView === 'workweek' ? 5 : 7 }, (_, i) => {
            const d = new Date(getStartOfWeek(state.currentDate));
            d.setDate(d.getDate() + i);
            return d;
        });

    const today = new Date();
    const todayStr = formatDateKey(today);
    const columns = days.length;

    let html = `<div class="week-view time-grid-view ${state.currentView === 'day' ? 'single-day-view' : ''}">`;

    // Header row
    html += `<div class="week-header-row" style="--day-count:${columns}">`;
    html += '<div class="time-gutter-header"></div>';
    days.forEach(d => {
        const isToday = formatDateKey(d) === todayStr;
        const allDayEvents = getEventsForDate(formatDateKey(d)).filter(ev => ev.IsAllDay);
        html += `
            <div class="day-header${isToday ? ' today' : ''}">
                ${dayNames[d.getDay()]}
                <span class="day-num">${d.getDate()}</span>
                ${allDayEvents.map(ev => `<button class="all-day-event" data-event-id="${ev.Id}" data-calendar-id="${ev.CalendarId}" type="button">${escapeHtml(ev.Title || 'Без названия')}</button>`).join('')}
            </div>`;
    });
    html += '</div>';

    // Body row
    html += `<div class="week-body-row" style="--day-count:${columns}">`;

    // Time gutter
    html += '<div class="time-gutter">';
    for (let h = 0; h < 24; h++) {
        const isOffHours = h < 7 || h >= 19;
        html += `<div class="time-slot-label${isOffHours ? ' off-hours' : ''}">${h.toString().padStart(2, '0')}:00</div>`;
    }
    html += '</div>';

    // Day columns
    days.forEach(d => {
        const dateStr = formatDateKey(d);
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        html += `<div class="day-column${isWeekend ? ' weekend' : ''}" data-date="${dateStr}">`;
        for (let h = 0; h < 24; h++) {
            const isOffHours = h < 7 || h >= 19;
            html += `<div class="hour-cell${isOffHours ? ' off-hours' : ''}"></div>`;
        }

        // События этого дня — ИСПРАВЛЕННЫЙ БЛОК
        const dayEvents = getEventsForDate(dateStr).filter(ev => !ev.IsAllDay);
        getEventLayout(dayEvents).forEach(item => {
            html += renderEventBlock(item.event, d, item.lane, item.laneCount);
        });
        html += '</div>';
    });

    html += '</div>';
    html += '</div>';
    return html;
}

function getEventsForDate(dateStr) {
    return state.events.filter(ev => {
        if (!ev.Start) return false;
        const calendar = state.calendars.find(cal => cal.Id === ev.CalendarId);
        if (!calendar?.IsVisible) return false;
        const startDate = formatDateKey(new Date(ev.Start));
        if (!ev.IsAllDay) return startDate === dateStr;
        const endDate = formatDateKey(new Date(ev.End));
        return dateStr >= startDate && dateStr < endDate;
    });
}

function getEventLayout(events) {
    const timed = events.map(event => {
        const start = new Date(event.Start);
        const end = new Date(event.End);
        return {
            event,
            start: start.getHours() * 60 + start.getMinutes(),
            end: Math.max(start.getHours() * 60 + start.getMinutes() + 15, end.getHours() * 60 + end.getMinutes()),
            lane: 0,
            laneCount: 1
        };
    }).sort((a, b) => a.start - b.start || a.end - b.end);

    let cluster = [];
    let clusterEnd = -1;
    const layoutCluster = items => {
        if (items.length === 0) return;
        const laneEnds = [];
        for (const item of items) {
            let lane = laneEnds.findIndex(end => end <= item.start);
            if (lane < 0) lane = laneEnds.length;
            laneEnds[lane] = item.end;
            item.lane = lane;
        }

        const points = items.flatMap(item => [
            { time: item.start, delta: 1 },
            { time: item.end, delta: -1 }
        ]).sort((a, b) => a.time - b.time || a.delta - b.delta);
        let active = 0;
        let laneCount = 1;
        for (const point of points) {
            active += point.delta;
            laneCount = Math.max(laneCount, active);
        }
        items.forEach(item => item.laneCount = laneCount);
    };

    for (const item of timed) {
        if (cluster.length && item.start >= clusterEnd) {
            layoutCluster(cluster);
            cluster = [];
            clusterEnd = -1;
        }
        cluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.end);
    }
    layoutCluster(cluster);
    return timed;
}

function renderMonthView() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    const first = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
    const todayStr = formatDateKey(new Date());
    const selectedStr = formatDateKey(state.currentDate);
    let html = '<div class="month-view"><div class="month-grid">';

    for (let i = 1; i < dayNames.length; i++) {
        html += `<div class="month-weekday">${dayNames[i]}</div>`;
    }
    html += `<div class="month-weekday">${dayNames[0]}</div>`;

    for (let i = 0; i < 42; i++) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + i);
        const dateStr = formatDateKey(date);
        const outside = date.getMonth() !== month;
        const events = getEventsForDate(dateStr);
        const classes = [
            'month-day',
            outside ? 'other-month' : '',
            dateStr === todayStr ? 'today' : '',
            dateStr === selectedStr ? 'selected' : ''
        ].filter(Boolean).join(' ');

        html += `<div class="${classes}" data-date="${dateStr}">
            <button class="month-day-number" type="button" data-date="${dateStr}">${date.getDate()}</button>
            <div class="month-day-events">`;
        events.slice(0, 3).forEach(event => {
            const start = new Date(event.Start);
            const cal = state.calendars.find(item => item.Id === event.CalendarId);
            html += `<button class="month-event" type="button" data-event-id="${event.Id}" data-calendar-id="${event.CalendarId}"
                style="--event-color:${cal.Color}">
                ${event.IsAllDay ? '' : `<span>${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}</span>`}
                ${escapeHtml(event.Title || '')}
            </button>`;
        });
        if (events.length > 3) {
            html += `<span class="month-more">+ ещё ${events.length - 3}</span>`;
        }
        html += '</div></div>';
    }

    return `${html}</div></div>`;
}

function renderYearView() {
    const year = state.currentDate.getFullYear();
    const todayStr = formatDateKey(new Date());
    let html = '<div class="year-view">';

    for (let month = 0; month < 12; month++) {
        const first = new Date(year, month, 1);
        const gridStart = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cellCount = Math.ceil((((first.getDay() + 6) % 7) + daysInMonth) / 7) * 7;
        html += `<section class="year-month"><h2>${monthNames[month]}</h2><div class="year-month-grid">`;
        for (let i = 1; i < dayNames.length; i++) {
            html += `<span class="year-weekday">${dayNames[i][0]}</span>`;
        }
        html += `<span class="year-weekday">${dayNames[0][0]}</span>`;

        for (let i = 0; i < cellCount; i++) {
            const date = new Date(gridStart);
            date.setDate(gridStart.getDate() + i);
            const dateStr = formatDateKey(date);
            const outside = date.getMonth() !== month;
            const classes = [
                'year-day',
                outside ? 'other-month' : '',
                dateStr === todayStr ? 'today' : ''
            ].filter(Boolean).join(' ');
            html += `<button type="button" class="${classes}" data-date="${dateStr}" ${outside ? 'disabled' : ''}>${date.getDate()}</button>`;
        }
        html += '</div></section>';
    }

    return `${html}</div>`;
}

function renderEventBlock(ev, dayDate, lane = 0, laneCount = 1) {
    if (!ev.Start || !ev.End) return '';  // защита

    const cal = state.calendars.find(c => c.Id === ev.CalendarId);  // ← БОЛЬШИЕ буквы
    if (!cal) return '';

    const start = new Date(ev.Start);   // ← БОЛЬШАЯ S
    const end = new Date(ev.End);       // ← БОЛЬШАЯ E
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();
    const duration = Math.max(endMinutes - startMinutes, 15);

    const top = (startMinutes / 60) * 60;
    const height = (duration / 60) * 60;

    const timeStr = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}–${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
    const compact = duration <= 30;
    const width = 100 / laneCount;
    const left = lane * width;

    return `
        <div class="${compact ? 'event-block short-event' : 'event-block'}"
             data-calendar-id="${cal.Id}"
             style="top:${top}px;height:${height}px;left:calc(${left}% + 2px);width:calc(${width}% - 4px);right:auto;background:${cal.Color}22;border-color:${cal.Color};color:var(--event-text)"
             onclick="openEventModal(${ev.Id})">
            ${compact
                ? `<div class="event-title">${timeStr} ${escapeHtml(ev.Title || 'Без названия')}</div>`
                : `<div class="event-title">${escapeHtml(ev.Title || 'Без названия')}</div><div class="event-time">${timeStr}</div>`}
        </div>`;
}

function updateCurrentTimeLine() {
    const todayStr = formatDateKey(new Date());
    const todayColumn = document.querySelector(`.day-column[data-date="${todayStr}"]`);
    const existingLine = document.querySelector('.current-time-line');

    if (!todayColumn) {
        existingLine?.remove();
        return;
    }

    const now = new Date();
    const line = existingLine ?? document.createElement('div');
    line.className = 'current-time-line';
    line.style.top = `${now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60}px`;
    if (line.parentElement !== todayColumn) {
        todayColumn.appendChild(line);
    }
}

// === EVENT MODAL ===
window.openEventModal = (eventId = null) => {
    console.log('[JS] openEventModal вызван, eventId:', eventId);
    console.log('[JS] state.calendars:', state.calendars);
    console.log('Модалка открыта');

    state.editingEventId = eventId;
    const modal = document.getElementById('eventModal');
    const deleteBtn = document.getElementById('btnDelete');

    if (eventId) {
        const ev = state.events.find(e => e.Id === eventId);
        if (!ev) {
            console.error('[JS] Событие не найдено:', eventId);
            closeModal();
            return;
        }

        document.getElementById('modalTitle').textContent = 'Редактировать событие';
        document.getElementById('eventTitle').value = ev.Title || '';
        document.getElementById('eventAllDay').checked = Boolean(ev.IsAllDay);
        setDateTimeFields('eventStart', ev.Start);
        if (ev.IsAllDay) {
            const endDate = new Date(ev.End);
            endDate.setDate(endDate.getDate() - 1);
            setDateTimeFields('eventEnd', endDate.toISOString());
        } else {
            setDateTimeFields('eventEnd', ev.End);
        }
        const start = new Date(getDateTimeValue('eventStart'));
        const end = ev.IsAllDay ? new Date(getAllDayEndValue()) : new Date(getDateTimeValue('eventEnd'));
        if (end - start < 15 * 60 * 1000) {
            end.setTime(start.getTime() + 15 * 60 * 1000);
            setDateTimeFields('eventEnd', end.toISOString());
        }
        document.getElementById('eventDesc').value = ev.Description || '';
        deleteBtn.style.display = 'block';
    } else {
        document.getElementById('modalTitle').textContent = 'Новое событие';
        document.getElementById('eventTitle').value = '';
        document.getElementById('eventAllDay').checked = false;
        const now = new Date();
        now.setMinutes(0, 0, 0);
        const end = new Date(now);
        end.setHours(end.getHours() + 1);
        setDateTimeFields('eventStart', now.toISOString());
        setDateTimeFields('eventEnd', end.toISOString());
        document.getElementById('eventDesc').value = '';
        deleteBtn.style.display = 'none';
    }
    updateAllDayFields();

    // === ЗАПОЛНЕНИЕ СЕЛЕКТА КАЖДЫЙ РАЗ ===
    const select = document.getElementById('eventCalendar');
    select.innerHTML = '';

    console.log('[JS] Начинаем заполнение селекта');

    if (!state.calendars || state.calendars.length === 0) {
        console.warn('[JS] Календари не загружены, используем запасной вариант');
        select.innerHTML = '<option value="1">Personal</option>';
        select.value = '1';
    } else {
        state.calendars.forEach((c, index) => {
            console.log(`[JS] Календарь ${index}:`, c);
            const option = document.createElement('option');
            option.value = c.Id || c.id || index;
            option.textContent = c.Name || c.name || `Календарь ${index + 1}`;
            select.appendChild(option);
        });

        // Установить первое значение
        if (state.calendars.length > 0) {
            select.value = state.calendars[0].Id || state.calendars[0].id;
        }
    }

    console.log('[JS] Селект заполнен, значение:', select.value);

    modal.classList.add('active');
};
function closeModal() {
    document.getElementById('eventModal').classList.remove('active');
    state.editingEventId = null;
}

document.getElementById('btnCancel').onclick = closeModal;
document.getElementById('btnCloseModal').onclick = closeModal;
document.getElementById('btnSave').onclick = () => {
    const isAllDay = document.getElementById('eventAllDay').checked;
    const start = isAllDay ? getAllDayStartValue() : getDateTimeValue('eventStart');
    const end = isAllDay ? getAllDayEndValue() : getDateTimeValue('eventEnd');
    if (!start || !end) return;
    if (!isAllDay && new Date(end) - new Date(start) < 15 * 60 * 1000) {
        document.getElementById('eventEndMinute').setCustomValidity('Окончание должно быть не менее чем через 15 минут после начала.');
        document.getElementById('eventEndMinute').reportValidity();
        document.getElementById('eventEndMinute').setCustomValidity('');
        return;
    }
    if (isAllDay && new Date(end) <= new Date(start)) {
        const endDateInput = document.getElementById('eventEndDate');
        endDateInput.setCustomValidity('Дата окончания должна быть не раньше даты начала.');
        endDateInput.reportValidity();
        endDateInput.setCustomValidity('');
        return;
    }

    const payload = {
        type: 'saveEvent',
        id: state.editingEventId || 0,
        title: document.getElementById('eventTitle').value.trim() || 'Без названия',
        start,
        end,
        calendarId: parseInt(document.getElementById('eventCalendar').value) || 1, // Теперь работает!
        description: document.getElementById('eventDesc').value || null,
        isAllDay
    };
    sendToBackend(payload);
    closeModal();
};

document.getElementById('btnDelete').onclick = () => {
    if (state.editingEventId) {
        sendToBackend({ type: 'deleteEvent', id: state.editingEventId });
        closeModal();
    }
};

function updateAllDayFields() {
    const allDay = document.getElementById('eventAllDay').checked;
    document.querySelector('.time-row').hidden = allDay;
}

function setDisplayDate(prefix, date) {
    const value = formatDisplayDate(date);
    document.getElementById(`${prefix}Date`).value = value;
    document.getElementById(`${prefix}NativeDate`).value = formatDateKey(date);
}

function getAllDayStartValue() {
    const dateInput = document.getElementById('eventStartDate');
    const date = parseDisplayDate(dateInput.value);
    if (!date) {
        dateInput.setCustomValidity('Введите дату в формате ДД.ММ.ГГГГ.');
        dateInput.reportValidity();
        dateInput.setCustomValidity('');
        return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function getAllDayEndValue() {
    const dateInput = document.getElementById('eventEndDate');
    const date = parseDisplayDate(dateInput.value);
    if (!date) {
        dateInput.setCustomValidity('Введите дату в формате ДД.ММ.ГГГГ.');
        dateInput.reportValidity();
        dateInput.setCustomValidity('');
        return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();
}

document.getElementById('eventAllDay').addEventListener('change', updateAllDayFields);
document.getElementById('eventAllDay').addEventListener('change', () => {
    if (document.getElementById('eventAllDay').checked) {
        const startDate = parseDisplayDate(document.getElementById('eventStartDate').value);
        if (startDate) setDisplayDate('eventEnd', startDate);
    }
});
document.getElementById('eventStartDate').addEventListener('change', () => {
    if (document.getElementById('eventAllDay').checked) updateAllDayFields();
});

// === NAVIGATION ===
document.getElementById('btnToday').onclick = () => {
    state.currentDate = new Date();
    render();
};

document.getElementById('prevPeriod').onclick = () => {
    navigatePeriod(-1);
};
document.getElementById('nextPeriod').onclick = () => {
    navigatePeriod(1);
};

function navigatePeriod(dir) {
    const d = state.currentDate;
    if (state.currentView === 'workweek' || state.currentView === 'week') {
        d.setDate(d.getDate() + dir * 7);
    } else if (state.currentView === 'month') {
        shiftMonth(d, dir);
    } else if (state.currentView === 'year') {
        shiftMonth(d, dir * 12);
    } else {
        d.setDate(d.getDate() + dir);
    }
    render();
}

document.querySelectorAll('.view-btn').forEach(btn => {
    btn.onclick = () => {
        state.currentView = btn.dataset.view;
        render();
    };
});

document.getElementById('miniPrev').onclick = () => {
    shiftMonth(state.currentDate, -1);
    render();
};
document.getElementById('miniNext').onclick = () => {
    shiftMonth(state.currentDate, 1);
    render();
};

document.getElementById('miniCalGrid').addEventListener('click', (e) => {
    const day = e.target.closest('.day[data-date]');
    if (!day) return;

    const [year, month, date] = day.dataset.date.split('-').map(Number);
    state.currentDate = new Date(year, month - 1, date);
    state.currentView = 'day';
    render();
});

document.getElementById('calendarBody').addEventListener('click', (e) => {
    const eventButton = e.target.closest('.month-event, .all-day-event');
    if (eventButton) {
        window.openEventModal(Number(eventButton.dataset.eventId));
        return;
    }

    const dateTarget = e.target.closest('[data-date]');
    if (!dateTarget || !dateTarget.closest('.month-day, .year-day, .month-day-number')) return;

    const [year, month, date] = dateTarget.dataset.date.split('-').map(Number);
    state.currentDate = new Date(year, month - 1, date);
    state.currentView = 'day';
    render();
});

const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('calendar-theme');
document.body.classList.toggle('dark-theme', savedTheme === 'dark');
themeToggle.checked = savedTheme === 'dark';
notifyThemeChanged(themeToggle.checked);
themeToggle.addEventListener('change', () => {
    const isDark = themeToggle.checked;
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem('calendar-theme', isDark ? 'dark' : 'light');
    notifyThemeChanged(isDark);
});

for (const prefix of ['eventStart', 'eventEnd']) {
   const displayInput = document.getElementById(`${prefix}Date`);
   const nativeInput = document.getElementById(`${prefix}NativeDate`);
   const pickerButton = displayInput.parentElement.querySelector('.date-picker-button');

   pickerButton.addEventListener('click', () => {
       openNativeDatePicker(nativeInput);
   });
   displayInput.addEventListener('click', () => {
       openNativeDatePicker(nativeInput);
   });
   nativeInput.addEventListener('change', () => {
       if (!nativeInput.value) return;
       const [year, month, day] = nativeInput.value.split('-').map(Number);
       setDisplayDate(prefix, new Date(year, month - 1, day));
       if (document.getElementById('eventAllDay').checked && prefix === 'eventStart') {
           setDisplayDate('eventEnd', new Date(year, month - 1, day));
       }
   });
   displayInput.addEventListener('input', () => {
       displayInput.setCustomValidity('');
       const parsed = parseDisplayDate(displayInput.value);
       if (parsed) nativeInput.value = formatDateKey(parsed);
       if (document.getElementById('eventAllDay').checked && prefix === 'eventStart' && parsed) {
           setDisplayDate('eventEnd', parsed);
       }
   });
   displayInput.addEventListener('change', () => {
       const parsed = parseDisplayDate(displayInput.value);
       if (parsed) {
           setDisplayDate(prefix, parsed);
           if (document.getElementById('eventAllDay').checked && prefix === 'eventStart') {
               setDisplayDate('eventEnd', parsed);
           }
       }
   });
}

function openNativeDatePicker(input) {
    if (typeof input.showPicker === 'function') {
        try {
            input.showPicker();
            return;
        } catch (error) {
            console.warn('[JS] Не удалось открыть нативный календарь даты:', error);
        }
    }
    input.click();
}

document.addEventListener('keydown', e => {
   if (e.key === 'Escape' && document.getElementById('eventModal').classList.contains('active')) {
       closeModal();
   }
});

setInterval(updateCurrentTimeLine, 15000);
document.addEventListener('visibilitychange', updateCurrentTimeLine);
window.addEventListener('focus', updateCurrentTimeLine);

// === HELPERS ===
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Понедельник
    d.setDate(diff);
    d.setHours(0,0,0,0);
    return d;
}

function shiftMonth(date, offset) {
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
    const daysInTargetMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, daysInTargetMonth));
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
}

function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

// Закрытие модалки по клику вне
document.getElementById('eventModal').onclick = (e) => {
    if (e.target.id === 'eventModal') closeModal();
};

let timeSelection = null;
let suppressTimeGridDoubleClickUntil = 0;

document.getElementById('calendarBody').addEventListener('pointerdown', (e) => {
    const column = e.target.closest('.day-column');
    if (!column || e.button !== 0 || e.target.closest('.event-block')) return;

    const slot = getTimeSlotAt(column, e.clientY);
    timeSelection = {
        startSlot: slot,
        currentSlot: slot,
        startX: e.clientX,
        startY: e.clientY,
        moved: false
    };
    column.setPointerCapture(e.pointerId);
});

window.addEventListener('pointermove', (e) => {
    if (!timeSelection) return;
    if (Math.hypot(e.clientX - timeSelection.startX, e.clientY - timeSelection.startY) > 3) {
        timeSelection.moved = true;
    }
    if (!timeSelection.moved) return;

    const column = document.elementFromPoint(e.clientX, e.clientY)?.closest('.day-column')
        ?? document.querySelector(`.day-column[data-date="${dateKeyFromSlot(timeSelection.startSlot)}"]`);
    if (!column) return;

    timeSelection.currentSlot = getTimeSlotAt(column, e.clientY);
    renderTimeSelection();
});

window.addEventListener('pointerup', () => {
    if (!timeSelection) return;
    const selection = timeSelection;
    timeSelection = null;
    clearTimeSelection();
    if (!selection.moved) return;

    const firstSlot = Math.min(selection.startSlot, selection.currentSlot);
    const lastSlot = Math.max(selection.startSlot, selection.currentSlot) + 1;
    const start = dateFromSlot(firstSlot);
    const end = dateFromSlot(lastSlot);
    suppressTimeGridDoubleClickUntil = Date.now() + 500;
    window.openEventModal();
    setDateTimeFields('eventStart', start.toISOString());
    setDateTimeFields('eventEnd', end.toISOString());
});

window.addEventListener('pointercancel', () => {
    timeSelection = null;
    clearTimeSelection();
});

document.addEventListener('dblclick', (e) => {
    const column = e.target.closest('.day-column');
    if (!column || e.target.closest('.event-block') || Date.now() < suppressTimeGridDoubleClickUntil) return;
    e.preventDefault();

    const date = new Date(`${column.dataset.date}T00:00:00`);
    const minutesFromMidnight = Math.max(0, Math.min(1439, e.clientY - column.getBoundingClientRect().top));
    const startMinutes = Math.floor(minutesFromMidnight / 30) * 30;
    const start = new Date(date);
    start.setMinutes(startMinutes, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);

    window.openEventModal();
    setDateTimeFields('eventStart', start.toISOString());
    setDateTimeFields('eventEnd', end.toISOString());
});

function getTimeSlotAt(column, clientY) {
    const date = new Date(`${column.dataset.date}T00:00:00`);
    const y = Math.max(0, Math.min(1440, clientY - column.getBoundingClientRect().top));
    const minutes = Math.min(1425, Math.floor(y / 15) * 15);
    date.setMinutes(minutes, 0, 0);
    return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000) * 96 + minutes / 15;
}

function dateKeyFromSlot(slot) {
    const day = Math.floor(slot / 96);
    const date = new Date(day * 86400000);
    return formatDateKey(new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateFromSlot(slot) {
    const day = Math.floor(slot / 96);
    const quarterHour = slot % 96;
    const date = new Date(day * 86400000);
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
        Math.floor(quarterHour / 4), (quarterHour % 4) * 15);
}

function renderTimeSelection() {
    clearTimeSelection();
    if (!timeSelection) return;

    const firstSlot = Math.min(timeSelection.startSlot, timeSelection.currentSlot);
    const lastSlot = Math.max(timeSelection.startSlot, timeSelection.currentSlot) + 1;
    for (let slot = firstSlot; slot < lastSlot;) {
        const dateKey = dateKeyFromSlot(slot);
        const dayEnd = Math.min(lastSlot, (Math.floor(slot / 96) + 1) * 96);
        const column = document.querySelector(`.day-column[data-date="${dateKey}"]`);
        if (column) {
            const startMinutes = (slot % 96) * 15;
            const selection = document.createElement('div');
            selection.className = 'time-selection';
            selection.style.top = `${startMinutes}px`;
            selection.style.height = `${(dayEnd - slot) * 15}px`;
            column.appendChild(selection);
        }
        slot = dayEnd;
    }
}

function clearTimeSelection() {
    document.querySelectorAll('.time-selection').forEach(selection => selection.remove());
}

populateTimeOptions();
render();

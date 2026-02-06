 // Tab functionality
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons and contents
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked button and corresponding content
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });

        // Stopwatch functionality
        let stopwatchInterval;
        let stopwatchStartTime;
        let stopwatchElapsedTime = 0;
        let isStopwatchRunning = false;
        let lapCount = 0;
        let lastLapTime = 0;

        const stopwatchDisplay = document.getElementById('stopwatch-display');
        const startStopBtn = document.getElementById('start-stop');
        const lapBtn = document.getElementById('lap');
        const resetBtn = document.getElementById('reset');
        const lapList = document.getElementById('lap-list');
        const clearLapsBtn = document.getElementById('clear-laps');

        function formatTime(ms, showMs = true) {
            const date = new Date(ms);
            const hours = String(date.getUTCHours()).padStart(2, '0');
            const minutes = String(date.getUTCMinutes()).padStart(2, '0');
            const seconds = String(date.getUTCSeconds()).padStart(2, '0');
            const milliseconds = String(Math.floor(date.getUTCMilliseconds() / 10)).padStart(2, '0');
            return showMs ? `${hours}:${minutes}:${seconds}.${milliseconds}` : `${hours}:${minutes}:${seconds}`;
        }

        function updateStopwatch() {
            if (!isStopwatchRunning) return;
            
            const currentTime = performance.now();
            stopwatchElapsedTime = currentTime - stopwatchStartTime;
            stopwatchDisplay.textContent = formatTime(stopwatchElapsedTime);
        }
        
        function startStopwatch() {
            if (!isStopwatchRunning) {
                stopwatchStartTime = performance.now() - stopwatchElapsedTime;
                isStopwatchRunning = true;
                stopwatchInterval = setInterval(updateStopwatch, 50); // Update every 50ms for smooth display
                startStopBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
                startStopBtn.className = 'btn-warning';
                lapBtn.disabled = false;
                resetBtn.disabled = true;
            } else {
                isStopwatchRunning = false;
                clearInterval(stopwatchInterval);
                startStopBtn.innerHTML = '<i class="fas fa-play"></i> Start';
                startStopBtn.className = 'btn-success';
                lapBtn.disabled = true;
                resetBtn.disabled = false;
            }
        }

        function addLap() {
            const currentLapTime = stopwatchElapsedTime;
            const lapDuration = lastLapTime ? currentLapTime - lastLapTime : currentLapTime;
            lastLapTime = currentLapTime;
            lapCount++;

            // Remove 'no laps' message if it's the first lap
            const noLaps = document.querySelector('.no-laps');
            if (noLaps) noLaps.remove();

            const lapItem = document.createElement('div');
            lapItem.className = 'lap-item';
            lapItem.innerHTML = `
                <span>Lap ${lapCount}</span>
                <span>${formatTime(currentLapTime)}</span>
                <span>+${formatTime(lapDuration)}</span>
            `;
            
            lapList.insertBefore(lapItem, lapList.firstChild);
            clearLapsBtn.style.display = 'block';
        }

        function resetStopwatch() {
            isStopwatchRunning = false;
            clearInterval(stopwatchInterval);
            stopwatchElapsedTime = 0;
            lastLapTime = 0;
            stopwatchDisplay.textContent = '00:00.00';
            lapList.innerHTML = '<div class="no-laps">No laps recorded yet</div>';
            clearLapsBtn.style.display = 'none';
            lapCount = 0;
            startStopBtn.innerHTML = '<i class="fas fa-play"></i> Start';
            startStopBtn.className = 'btn-success';
            lapBtn.disabled = true;
            resetBtn.disabled = true;
        }

        function clearLaps() {
            lapList.innerHTML = '<div class="no-laps">No laps recorded yet</div>';
            clearLapsBtn.style.display = 'none';
            lastLapTime = 0;
            lapCount = 0;
        }

        // Clock functionality
        let currentTimezone = 'local';
        
        function updateClock() {
            const timezoneSelect = document.getElementById('timezone-select');
            const timezone = timezoneSelect ? timezoneSelect.value : currentTimezone;
            currentTimezone = timezone;
            
            let now;
            let timezoneName = 'Local Time';
            let timezoneOffset = '';
            
            if (timezone === 'local') {
                now = new Date();
            } else {
                try {
                    const options = { timeZone: timezone, timeZoneName: 'short' };
                    const dateStr = new Date().toLocaleString('en-US', options);
                    now = new Date(dateStr);
                    
                    // Get timezone name and offset
                    timezoneName = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'long' })
                        .formatToParts(now)
                        .find(part => part.type === 'timeZoneName').value;
                    
                    // Get timezone offset
                    const tzOffset = new Date().toLocaleString('en', { timeZone: timezone, timeZoneName: 'shortOffset' })
                        .split(' ').pop();
                    timezoneOffset = tzOffset;
                    
                    document.getElementById('timezone-display').textContent = `${timezoneName} (${timezoneOffset})`;
                } catch (e) {
                    console.error('Error with timezone:', e);
                    now = new Date();
                    document.getElementById('timezone-display').textContent = 'Local Time';
                }
            }
            
            let hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            
            // Convert to 12-hour format
            const displayHours = hours % 12 || 12;
            
            // Update digital clock
            document.getElementById('clock-display').textContent = 
                `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            // Update digital time with AM/PM
            document.querySelector('.digital-time').innerHTML = 
                `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} <span class="ampm">${ampm}</span>`;
            
            // Update analog clock
            const hourHand = document.querySelector('.hour-hand');
            const minuteHand = document.querySelector('.minute-hand');
            const secondHand = document.querySelector('.second-hand');
            
            const hourDegrees = (hours * 30) + (minutes * 0.5);
            const minuteDegrees = (minutes * 6) + (seconds * 0.1);
            const secondDegrees = seconds * 6;
            
            hourHand.style.transform = `translateX(-50%) rotate(${hourDegrees}deg)`;
            minuteHand.style.transform = `translateX(-50%) rotate(${minuteDegrees}deg)`;
            secondHand.style.transform = `translateX(-50%) rotate(${secondDegrees}deg)`;
            
            // Update date
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                timeZone: timezone === 'local' ? undefined : timezone
            };
            document.getElementById('date-display').textContent = now.toLocaleDateString('en-US', options);
        }
        
        // Alarm functionality
        let alarms = [];
        const alarmTimeInput = document.getElementById('alarm-time');
        const setAlarmBtn = document.getElementById('set-alarm');
        const alarmList = document.getElementById('alarm-list');

        function checkAlarms() {
            const now = new Date();
            const currentTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            
            alarms.forEach((alarm, index) => {
                if (alarm.timeInSeconds === currentTime && !alarm.triggered) {
                    alert(`Alarm! ${alarm.timeString}`);
                    alarms[index].triggered = true;
                    // You can add sound here: new Audio('alarm-sound.mp3').play();
                }
            });
        }

        function addAlarm() {
            const timeString = alarmTimeInput.value;
            if (!timeString) return;
            
            const [hours, minutes] = timeString.split(':').map(Number);
            const timeInSeconds = hours * 3600 + minutes * 60;
            
            const alarm = {
                id: Date.now(),
                timeString: timeString,
                timeInSeconds: timeInSeconds,
                triggered: false
            };
            
            alarms.push(alarm);
            updateAlarmList();
            alarmTimeInput.value = '';
        }

        function deleteAlarm(id) {
            alarms = alarms.filter(alarm => alarm.id !== id);
            updateAlarmList();
        }

        function formatTimeForDisplay(timeString) {
            const [hours, minutes] = timeString.split(':').map(Number);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            let displayHours = hours % 12;
            displayHours = displayHours ? displayHours : 12; // Convert 0 to 12
            return {
                time: `${String(displayHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
                ampm: ampm
            };
        }

        function updateAlarmList() {
            if (alarms.length === 0) {
                alarmList.innerHTML = '<div class="no-laps">No alarms set. Add one using the form above.</div>';
                return;
            }
            
            // Sort alarms by time
            alarms.sort((a, b) => a.timeInSeconds - b.timeInSeconds);
            
            alarmList.innerHTML = '';
            alarms.forEach(alarm => {
                const timeDisplay = formatTimeForDisplay(alarm.timeString);
                
                const alarmElement = document.createElement('div');
                alarmElement.className = 'alarm-item';
                alarmElement.innerHTML = `
                    <div class="alarm-time">
                        ${timeDisplay.time} <span class="alarm-ampm">${timeDisplay.ampm}</span>
                    </div>
                    <button onclick="deleteAlarm(${alarm.id})" class="delete-alarm" title="Delete alarm">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                alarmList.appendChild(alarmElement);
            });
        }

        // Event Listeners
        startStopBtn.addEventListener('click', startStopwatch);
        lapBtn.addEventListener('click', addLap);
        resetBtn.addEventListener('click', resetStopwatch);
        clearLapsBtn.addEventListener('click', clearLaps);
        setAlarmBtn.addEventListener('click', addAlarm);

        // Timezone change handler
        document.addEventListener('DOMContentLoaded', function() {
            const timezoneSelect = document.getElementById('timezone-select');
            if (timezoneSelect) {
                timezoneSelect.addEventListener('change', function() {
                    updateClock();
                });
            }
        });

        // Initialize
        updateClock();
        setInterval(updateClock, 1000);
        setInterval(checkAlarms, 1000);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Space to start/stop stopwatch
            if (e.code === 'Space' && document.getElementById('stopwatch').classList.contains('active')) {
                e.preventDefault();
                startStopwatch();
            }
            // L key for lap
            else if (e.code === 'KeyL' && isStopwatchRunning) {
                e.preventDefault();
                addLap();
            }
        });

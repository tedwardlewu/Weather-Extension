class WeatherExtension {
    constructor() {
        this.currentCity = null;
        this.pinnedCities = [];
        this.searchTimeout = null;
        this.API_BASE = 'https://weather-extension-1.onrender.com';
        this.tempChart = null;
        this.loadingProgress = 0;
        this.map = null;
        this.mapMarker = null;
        this.init();
    }

    init() {
        this.showWeatherData();
        this.loadSavedCity().catch(err => console.error('Init error:', err));
        this.bindEvents();
        this.bindPinButton();
        this.bindRefreshButton();
        this.hideLoading();
        this.loadSavedWeatherData();
    }

    bindRefreshButton() {
        const refreshBtn = document.getElementById('refreshButton');
        if (!refreshBtn) return;
        refreshBtn.addEventListener('click', () => {
            if (this.currentCity) {
                this.showLoadingProgress();
                this.fetchWeatherData();
            }
        });
    }

    showLoadingProgress() {
        const progressEl = document.getElementById('loadingProgress');
        const fillEl = document.getElementById('progressFill');
        const textEl = document.getElementById('progressText');
        
        if (!progressEl || !fillEl || !textEl) return;
        
        progressEl.classList.remove('hidden');
        this.loadingProgress = 0;
        
        const interval = setInterval(() => {
            this.loadingProgress += Math.random() * 15;
            if (this.loadingProgress >= 90) {
                this.loadingProgress = 90;
            }
            fillEl.style.width = `${this.loadingProgress}%`;
            textEl.textContent = `Loading... ${Math.round(this.loadingProgress)}%`;
        }, 200);
        
        this.loadingInterval = interval;
    }

    hideLoadingProgress() {
        const progressEl = document.getElementById('loadingProgress');
        const fillEl = document.getElementById('progressFill');
        const textEl = document.getElementById('progressText');
        
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
        }
        
        if (fillEl && textEl) {
            fillEl.style.width = '100%';
            textEl.textContent = 'Loading... 100%';
            
            setTimeout(() => {
                if (progressEl) progressEl.classList.add('hidden');
                if (fillEl) fillEl.style.width = '0%';
                if (textEl) textEl.textContent = 'Loading... 0%';
            }, 300);
        }
    }

    async loadSavedCity() {
        return new Promise(resolve => {
            chrome.storage.local.get(['selectedCity', 'pinnedCities'], (result) => {
                this.currentCity = result.selectedCity || (result.pinnedCities?.[0]?.name || 'Waterloo');
                const searchEl = document.getElementById('citySearch');
                if (searchEl) searchEl.value = this.currentCity;
                this.pinnedCities = Array.isArray(result.pinnedCities) ? result.pinnedCities.map(pin => typeof pin === 'string' ? { name: pin, localTime: '00:00' } : pin) : [];
                this.updatePinnedCities();
                this.showPlaceholderData();
                this.fetchWeatherData().catch(err => console.error('Initial fetch failed:', err));
                resolve();
            });
        });
    }

    showPlaceholderData() {
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };

        setText('locationName', 'Loading...');
        setText('currentDate', new Date().toISOString().split('T')[0]);
        setText('currentTemp', '--°C');
        setText('conditionText', 'Loading weather...');
        setText('feelsLike', '--°C');
        setText('humidity', '--%');
        setText('wind', '-- km/h');
        setText('pressure', '-- mb');
        setText('visibility', '-- km');
        setText('uv', '--');
        setText('totalPrecipitation', '-- mm');
        setText('sunrise', '--:--');
        setText('sunset', '--:--');

        this.updateBackground(new Date().getHours());
    }

    savePinnedCities() {
        chrome.storage.local.set({ pinnedCities: this.pinnedCities });
    }

    async togglePinCity(city) {
        const idx = this.pinnedCities.findIndex(pin => pin.name === city);
        if (idx > -1) {
            this.pinnedCities.splice(idx, 1);
            this.savePinnedCities();
            this.updatePinnedCities();
            this.updatePinButton();
            return;
        }
        try {
            const data = await this.fetchCity(city);
            this.pinnedCities.push({ 
                name: city, 
                localTime: data.location.localtime,
                timezone: data.location.tz_id 
            });
        } catch {
            this.pinnedCities.push({ 
                name: city, 
                localTime: '00:00',
                timezone: 'UTC' 
            });
        }
        this.savePinnedCities();
        this.updatePinnedCities();
        this.updatePinButton();
    }

    async fetchCity(city) {
        const res = await fetch(`${this.API_BASE}/weather?q=${encodeURIComponent(city)}&days=3`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }
        return res.json();
    }

    async fetchWeatherData() {
        this.hideError();
        this.showWeatherData();
        this.showLoadingProgress();

        try {
            const data = await this.fetchCity(this.currentCity);
            const hourlyDay1 = data.forecast?.forecastday[0]?.hour || [];
            const hourlyDay2 = data.forecast?.forecastday[1]?.hour || [];
            const allHourlyData = [...hourlyDay1, ...hourlyDay2];

            this.displayWeatherData(data, allHourlyData);
            
            chrome.storage.local.set({ lastWeatherData: { data: data, hourlyData: allHourlyData } });

            const hour = this.getHourFromLocalTime(data.location.localtime);
            this.updateBackground(hour);
            chrome.storage.local.set({ selectedCity: this.currentCity });
            this.pinnedCities = this.pinnedCities.map(pin => {
                if (pin.name === this.currentCity) {
                    pin.localTime = data.location.localtime;
                    pin.timezone = data.location.tz_id;
                }
                return pin;
            });
            this.updatePinnedCities();
            this.updatePinButton();
        } catch (err) {
            console.error('Weather fetch error:', err);
            this.showError(`Failed to fetch weather: ${err.message}`);
        } finally {
            this.hideLoading();
            this.hideLoadingProgress();
        }
    }

    loadSavedWeatherData() {
        chrome.storage.local.get(['lastWeatherData'], (result) => {
            if (result.lastWeatherData) {
                const data = result.lastWeatherData.data;
                const hourlyData = result.lastWeatherData.hourlyData;
                
                document.getElementById('currentTemp').textContent = `${Math.round(data.current.temp_c)}°C`;
                document.getElementById('conditionText').textContent = data.current.condition.text;
                document.getElementById('feelsLike').textContent = `${Math.round(data.current.feelslike_c)}°C`;
                document.getElementById('humidity').textContent = `${data.current.humidity}%`;
                document.getElementById('wind').textContent = `${data.current.wind_kph} km/h`;
                document.getElementById('pressure').textContent = `${data.current.pressure_mb} mb`;
                document.getElementById('visibility').textContent = `${data.current.vis_km} km`;
                document.getElementById('uv').textContent = data.current.uv;
                document.getElementById('weatherIcon').src = `https:${data.current.condition.icon}`;
                document.getElementById('locationName').textContent = `${data.location.name}, ${data.location.country}`;
                this.updateLocalTime(data.location.tz_id);
            }
        });
    }

    updateLocalTime(timezone) {
        try {
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            const formattedTime = formatter.format(now);
            let timeElement = document.getElementById('localTime');
            if (timeElement) {
                timeElement.textContent = formattedTime;
            }
            
            const dateFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            
            const formattedDate = dateFormatter.format(now);
            document.getElementById('currentDate').textContent = formattedDate;
            
        } catch (error) {
            console.error('Error updating local time:', error);
            const now = new Date();
            const formattedTime = now.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
            });
            let timeElement = document.getElementById('localTime');
            if (timeElement) {
                timeElement.textContent = formattedTime;
            }
        }
    }

    updatePinButton() {
        const btn = document.getElementById('pinButton');
        if (!btn) return;
        const pinned = this.pinnedCities.some(pin => pin.name === this.currentCity);
        btn.textContent = pinned ? '❌' : '📌';
        btn.classList.toggle('pinned', pinned);
        
        btn.classList.remove('pin-morning', 'pin-day', 'pin-afternoon', 'pin-evening', 'pin-night');
        
        if (pinned) {
            const hour = new Date().getHours();
            const timeClass = this.getTimePeriodClass(hour);
            btn.classList.add(timeClass.replace('pinned-', 'pin-'));
        }
    }

    getTimePeriodClass(hour) {
        if (hour >= 6 && hour < 12) return 'pinned-morning';
        if (hour >= 12 && hour < 15) return 'pinned-day';
        if (hour >= 15 && hour < 18) return 'pinned-afternoon';
        if (hour >= 18 && hour < 21) return 'pinned-evening';
        return 'pinned-night';
    }

    bindPinButton() {
        const btn = document.getElementById('pinButton');
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (this.currentCity) this.togglePinCity(this.currentCity);
        });
    }

    updatePinnedCities() {
        const list = document.getElementById('pinnedList');
        const container = document.getElementById('pinnedCities');
        if (!list || !container) return;
        list.innerHTML = '';
        if (this.pinnedCities.length === 0) {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');
        this.pinnedCities.forEach(pin => {
            const item = document.createElement('div');
            const hour = this.getHourFromLocalTime(pin.localTime);
            item.className = `pinned-item ${this.getTimePeriodClass(hour)}`;
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = pin.name;
            nameSpan.className = 'pinned-city-name';
            
            const unpinBtn = document.createElement('button');
            unpinBtn.textContent = '✕';
            unpinBtn.className = 'unpin-button';
            unpinBtn.addEventListener('click', e => {
                e.stopPropagation();
                this.togglePinCity(pin.name);
            });
            
            item.appendChild(nameSpan);
            item.appendChild(unpinBtn);
            
            item.addEventListener('click', e => {
                if (!e.target.classList.contains('unpin-button')) {
                    this.currentCity = pin.name;
                    const searchEl = document.getElementById('citySearch');
                    if (searchEl) searchEl.value = pin.name;
                    this.showPlaceholderData();
                    this.fetchWeatherData();
                    this.hideSearchResults();
                }
            });
            list.appendChild(item);
        });
    }

    getHourFromLocalTime(localTime) {
        try {
            return parseInt(localTime.split(' ')[1].split(':')[0]);
        } catch {
            return 12;
        }
    }

    bindEvents() {
        const citySearch = document.getElementById('citySearch');
        if (!citySearch) return;
        citySearch.addEventListener('input', e => {
            const query = e.target.value.trim();
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            if (query.length > 0) {
                document.querySelector('.search-loading')?.classList.remove('hidden');
                this.searchTimeout = setTimeout(() => {
                    this.smartSearchCities(query)
                        .finally(() => document.querySelector('.search-loading')?.classList.add('hidden'));
                }, 300);
            } else {
                this.hideSearchResults();
            }
        });
        citySearch.addEventListener('focus', () => {
            if (citySearch.value.trim().length > 0) {
                this.smartSearchCities(citySearch.value.trim());
            }
        });
        citySearch.addEventListener('keydown', e => this.handleSearchKeyDown(e));
        document.addEventListener('click', e => {
            if (!e.target.closest('.city-selector') && !e.target.closest('.search-results')) {
                this.hideSearchResults();
            }
        });
    }

    handleSearchKeyDown(e) {
        const results = document.getElementById('searchResults');
        if (!results || results.classList.contains('hidden')) return;
        const items = results.querySelectorAll('.search-result-item');
        if (items.length === 0) return;
        const active = results.querySelector('.active');
        let next;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!active) {
                next = items[0];
            } else {
                next = active.nextElementSibling || items[0];
            }
            active?.classList.remove('active');
            next?.classList.add('active');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!active) {
                next = items[items.length - 1];
            } else {
                next = active.previousElementSibling || items[items.length - 1];
            }
            active?.classList.remove('active');
            next?.classList.add('active');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (active) {
                this.currentCity = active.dataset.cityName;
                document.getElementById('citySearch').value = this.currentCity;
                this.hideSearchResults();
                this.showPlaceholderData();
                this.fetchWeatherData();
                document.getElementById('citySearch')?.blur();
            } else {
                this.currentCity = document.getElementById('citySearch')?.value.trim();
                if (this.currentCity) {
                    this.hideSearchResults();
                    this.showPlaceholderData();
                    this.fetchWeatherData();
                    document.getElementById('citySearch')?.blur();
                }
            }
        }
    }

    async smartSearchCities(query) {
        try {
            const API_KEY = 'da9393ec436a49ef8b332007251611';
            const response = await fetch(
                `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`
            );
            if (!response.ok) {
                throw new Error(`WeatherAPI HTTP ${response.status}: ${response.statusText}`);
            }

            const searchResults = await response.json();
            if (!Array.isArray(searchResults)) {
                throw new Error('WeatherAPI returned invalid data format');
            }
            const pinnedCityNames = this.pinnedCities.map(pin => pin.name.toLowerCase());
            const enhancedResults = searchResults.map(city => ({
                ...city,
                isPinned: pinnedCityNames.includes(city.name.toLowerCase())
            }));
            enhancedResults.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                return 0;
            });
            this.displaySearchResults(enhancedResults);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }
    
    displaySearchResults(cities) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        if (cities.length === 0) {
            const noResult = document.createElement('div');
            noResult.className = 'search-result-item';
            noResult.textContent = 'No cities found';
            noResult.style.cursor = 'default';
            resultsContainer.appendChild(noResult);
        } else {
            cities.forEach(city => {
                const item = document.createElement('div');
                item.className = 'search-result-item';

                if (city.isPinned) {
                    item.classList.add('pinned-result');
                }

                let displayText = city.name;
                if (city.region && city.country) {
                    displayText += `, ${city.region}, ${city.country}`;
                } else if (city.country) {
                    displayText += `, ${city.country}`;
                }
                const textSpan = document.createElement('span');
                textSpan.textContent = displayText;
                item.appendChild(textSpan);
                if (city.isPinned) {
                    const pinIndicator = document.createElement('span');
                    pinIndicator.textContent = ' 📌';
                    pinIndicator.className = 'pin-indicator';
                    pinIndicator.style.marginLeft = '8px';
                    pinIndicator.style.fontSize = '12px';
                    item.appendChild(pinIndicator);
                }
                item.dataset.cityName = city.name;
                item.addEventListener('click', () => {
                    this.currentCity = city.name;
                    const searchEl = document.getElementById('citySearch');
                    if (searchEl) searchEl.value = this.currentCity;
                    this.hideSearchResults();
                    this.showPlaceholderData();
                    this.fetchWeatherData();
                });
                resultsContainer.appendChild(item);
            });
        }
        resultsContainer.classList.remove('hidden');
    }

    hideSearchResults() {
        const resultsContainer = document.getElementById('searchResults');
        if (resultsContainer) {
            resultsContainer.classList.add('hidden');
            const active = resultsContainer.querySelector('.active');
            if (active) active.classList.remove('active');
        }
    }

    showLoading() {
        document.getElementById('loader')?.classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loader')?.classList.add('hidden');
    }

    showError(msg) {
        const el = document.getElementById('error');
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
        }
    }

    hideError() {
        document.getElementById('error')?.classList.add('hidden');
    }

    showWeatherData() {
        document.getElementById('weatherData')?.classList.remove('hidden');
    }

    hideWeatherData() {
        document.getElementById('weatherData')?.classList.add('hidden');
    }

    updateBackground(hour) {
        const body = document.body;
        body.classList.remove('background-morning', 'background-day', 'background-afternoon', 'background-evening', 'background-night');
        if (hour >= 6 && hour < 12) body.classList.add('background-morning');
        else if (hour >= 12 && hour < 15) body.classList.add('background-day');
        else if (hour >= 15 && hour < 18) body.classList.add('background-afternoon');
        else if (hour >= 18 && hour < 21) body.classList.add('background-evening');
        else body.classList.add('background-night');
    }

    displayWeatherData(data, hourlyData) {
        this.hideLoading();
        this.showWeatherData();
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const setIcon = (id, icon, alt) => {
            const el = document.getElementById(id);
            if (el) {
                el.src = `https:${icon}`;
                el.alt = alt;
            }
        };
        
        setText('locationName', `${data.location.name}, ${data.location.country}`);
        this.updateLocalTime(data.location.tz_id);
        setText('currentTemp', `${Math.round(data.current.temp_c)}°C`);
        setText('conditionText', data.current.condition.text);
        setIcon('weatherIcon', data.current.condition.icon, data.current.condition.text);
        setText('feelsLike', `${Math.round(data.current.feelslike_c)}°C`);
        setText('humidity', `${data.current.humidity}%`);
        setText('wind', `${data.current.wind_kph} km/h`);
        setText('pressure', `${data.current.pressure_mb} mb`);
        setText('visibility', `${data.current.vis_km} km`);
        setText('uv', data.current.uv);
        
        const astronomy = data.forecast?.forecastday[0]?.astro;
        if (astronomy) {
            setText('sunrise', astronomy.sunrise);
            setText('sunset', astronomy.sunset);
        }
        
        this.checkWeatherAlerts(data);
        this.displayPrecipitation(data.current, hourlyData, data.location.localtime);
        this.displayForecast(data.forecast.forecastday);
        this.displayHourlyForecast(hourlyData, data.location.localtime);
        this.displayTemperatureGraph(hourlyData, data.location.localtime);
        this.displayWeatherMap(data.location);
        
        const hour = this.getHourFromLocalTime(data.location.localtime);
        this.updateBackground(hour);
    }

    checkWeatherAlerts(data) {
        const warningElement = document.getElementById('weatherWarning');
        const severeConditions = [
            'thunder', 'storm', 'tornado', 'hurricane', 'cyclone', 
            'blizzard', 'snow', 'ice', 'freezing', 'fog', 'hail'
        ];
        
        const currentCondition = data.current.condition.text.toLowerCase();
        const windSpeed = data.current.wind_kph;
        const visibility = data.current.vis_km;
        const uvIndex = data.current.uv;
        
        let hasWarning = false;
        
        if (windSpeed > 50 || visibility < 2 || uvIndex > 8) {
            hasWarning = true;
        }
        
        severeConditions.forEach(condition => {
            if (currentCondition.includes(condition)) {
                hasWarning = true;
            }
        });
        
        if (data.alerts && data.alerts.alert && data.alerts.alert.length > 0) {
            hasWarning = true;
        }
        
        if (hasWarning) {
            warningElement.classList.remove('hidden');
        } else {
            warningElement.classList.add('hidden');
        }
    }

    displayPrecipitation(current, hourlyData, localTime) {
        const container = document.getElementById('precipitation');
        const totalEl = document.getElementById('totalPrecipitation');
        if (!container || !totalEl) return;
        const totalPrecip = Math.round(hourlyData.reduce((sum, h) => sum + (h.precip_mm ?? 0), 0) * 10) / 10;
        totalEl.textContent = `${totalPrecip} mm`;
        const currentTimeMs = new Date(localTime.replace(/-/g, '/')).getTime();
        const nextHours = hourlyData
            .filter(h => new Date(h.time.replace(/-/g, '/')).getTime() >= currentTimeMs)
            .slice(0, 5)
            .map(h => ({
                time: h.time,
                chance: h.chance_of_rain ?? h.chance_of_snow ?? 0,
                precip: h.precip_mm ?? 0
            }));

        let html = `<div class="precipitation-next">`;
        nextHours.forEach(h => {
            const hourNum = parseInt(h.time.split(' ')[1].split(':')[0]);
            const display = `${hourNum % 12 === 0 ? 12 : hourNum % 12}${hourNum >= 12 ? 'PM' : 'AM'}`;
            html += `<div class="precip-hour">
                <div class="precip-hour-time">${display}</div>
                <div class="precip-hour-bar-container">
                    <div class="precip-hour-bar">
                        <div class="precip-hour-bar-fill" style="width:${Math.min(h.chance, 100)}%"></div>
                    </div>
                </div>
                <div class="precip-hour-info">
                    <div class="precip-hour-chance">${h.chance}%</div>
                    <div class="precip-hour-amount">${h.precip}mm</div>
                </div>
            </div>`;
        });
        html += `</div>`;
        container.innerHTML = html;
    }

    displayHourlyForecast(hourlyData, localTime) {
        const container = document.getElementById('hourlyForecast');
        if (!container) return;
        container.innerHTML = '';
        const currentTimeMs = new Date(localTime.replace(/-/g, '/')).getTime();
        hourlyData.filter(h => new Date(h.time.replace(/-/g, '/')).getTime() >= currentTimeMs).slice(0, 5)
            .forEach((h, i) => {
                const hourNum = parseInt(h.time.split(' ')[1].split(':')[0]);
                const display = i === 0 ? 'Now' : `${hourNum % 12 === 0 ? 12 : hourNum % 12}${hourNum >= 12 ? 'PM' : 'AM'}`;
                
                let conditionText = h.condition.text
                    .replace('Partly cloudy', 'Partly Cloudy')
                    .replace('Light rain shower', 'Rain Shower')
                    .replace('Moderate rain', 'Rain')
                    .replace('Heavy rain', 'Heavy Rain')
                    .replace('Patchy rain', 'Rain')
                    .replace('Light drizzle', 'Drizzle')
                    .replace('Thundery outbreaks', 'Storm')
                    .replace('Patchy moderate snow', 'Moderate Snow')
                    .replace('Moderate snow', 'Moderate Snow')
                    .replace('Patchy heavy snow', 'Heavy Snow')
                    .replace('Patchy light snow', 'Light Snow')
                    .replace('Light freezing rain', 'Freezing Rain')
                    .replace('Light snow', 'Light Snow')
                    .replace('Thunderstorm', 'Storm');
                    
                
                const div = document.createElement('div');
                div.className = 'hourly-item';
                div.innerHTML = `
                    <div class="hourly-time">${display}</div>
                    <img src="https:${h.condition.icon}" class="hourly-icon" alt="${h.condition.text}">
                    <div class="hourly-temp">${Math.round(h.temp_c)}°</div>
                    <div class="hourly-condition" title="${h.condition.text}">${conditionText}</div>
                `;
                container.appendChild(div);
            });
    }

    displayTemperatureGraph(hourlyData, localTime) {
        const container = document.getElementById('temperatureGraph');
        if (!container) return;
        
        const currentTimeMs = new Date(localTime.replace(/-/g, '/')).getTime();
        const next12Hours = hourlyData
            .filter(h => new Date(h.time.replace(/-/g, '/')).getTime() >= currentTimeMs)
            .slice(0, 12);
        
        if (next12Hours.length === 0) {
            container.innerHTML = '<div style="color: rgba(255,255,255,0.7); text-align: center; padding: 60px 0;">No temperature data available</div>';
            return;
        }
        
        container.innerHTML = '<canvas id="tempChart"></canvas>';
        
        const labels = next12Hours.map((h, i) => {
            const hourNum = parseInt(h.time.split(' ')[1].split(':')[0]);
            return i === 0 ? 'Now' : `${hourNum % 12 === 0 ? 12 : hourNum % 12}${hourNum >= 12 ? 'PM' : 'AM'}`;
        });
        
        const temperatures = next12Hours.map(h => Math.round(h.temp_c));
        const precipChances = next12Hours.map(h => h.chance_of_rain ?? h.chance_of_snow ?? 0);
        
        const minTemp = Math.min(...temperatures);
        const maxTemp = Math.max(...temperatures);
        
        const ctx = document.getElementById('tempChart').getContext('2d');
        
        const gradientStroke = ctx.createLinearGradient(0, 0, 0, 200);
        gradientStroke.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradientStroke.addColorStop(1, 'rgba(59, 130, 246, 0.9)');
        
        const gradientFill = ctx.createLinearGradient(0, 0, 0, 200);
        gradientFill.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        gradientFill.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
        
        if (this.tempChart) {
            this.tempChart.destroy();
        }
        
        this.tempChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Temperature',
                        data: temperatures,
                        borderColor: gradientStroke,
                        backgroundColor: gradientFill,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(255, 255, 255, 1)',
                        pointBorderColor: 'rgba(59, 130, 246, 1)',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Precipitation',
                        data: precipChances,
                        backgroundColor: function(context) {
                            const chart = context.chart;
                            const {ctx, chartArea} = chart;
                            if (!chartArea) {
                                return null;
                            }
                            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.05)');
                            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.4)');
                            return gradient;
                        },
                        borderColor: 'transparent',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        yAxisID: 'y1',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return `Temp: ${context.parsed.y}°C`;
                                } else {
                                    return `Precip: ${context.parsed.y}%`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return value + '°';
                            }
                        },
                        min: minTemp - 2,
                        max: maxTemp + 2
                    },
                    y1: {
                        type: 'linear',
                        display: false,
                        position: 'right',
                        min: 0,
                        max: 100,
                        grid: {
                            drawOnChartArea: false,
                        }
                    }
                }
            },
            plugins: [{
                id: 'precipitationOverlay',
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    const chartArea = chart.chartArea;
                    const meta = chart.getDatasetMeta(1);
                    
                    precipChances.forEach((chance, i) => {
                        if (chance > 30) {
                            const x = meta.data[i].x;
                            const nextX = i < meta.data.length - 1 ? meta.data[i + 1].x : chartArea.right;
                            const width = nextX - x;
                            
                            ctx.save();
                            ctx.globalAlpha = 0.15;
                            ctx.fillStyle = chance > 50 ? '#3b82f6' : '#60a5fa';
                            ctx.fillRect(x - width / 2, chartArea.top, width, chartArea.bottom - chartArea.top);
                            
                            const dropletCount = Math.floor(chance / 20);
                            for (let j = 0; j < dropletCount; j++) {
                                const dropX = x - width / 2 + Math.random() * width;
                                const dropY = chartArea.top + Math.random() * (chartArea.bottom - chartArea.top);
                                
                                ctx.beginPath();
                                ctx.arc(dropX, dropY, 2, 0, Math.PI * 2);
                                ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
                                ctx.fill();
                            }
                            
                            ctx.restore();
                        }
                    });
                }
            }]
        });
    }

    displayWeatherMap(location) {
        const mapContainer = document.getElementById('weatherMap');
        if (!mapContainer) return;
        
        const lat = location.lat;
        const lon = location.lon;
        
        if (typeof L === 'undefined') {
            console.error('Leaflet library not loaded');
            mapContainer.innerHTML = '<div style="color: white; text-align: center; padding: 100px 20px;">Map library not loaded</div>';
            return;
        }
        
        if (this.map) {
            this.map.remove();
            this.map = null;
            this.mapMarker = null;
        }
        
        mapContainer.innerHTML = '';
        
        setTimeout(() => {
            try {
                this.map = L.map(mapContainer).setView([lat, lon], 10);
                
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(this.map);
                
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
                    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
                });
                
                this.mapMarker = L.marker([lat, lon]).addTo(this.map);
                this.mapMarker.bindPopup(`<b>${location.name}</b><br>${location.country}`).openPopup();
                
                setTimeout(() => {
                    if (this.map) {
                        this.map.invalidateSize();
                    }
                }, 100);
                
            } catch (error) {
                console.error('Error initializing map:', error);
                mapContainer.innerHTML = '<div style="color: white; text-align: center; padding: 100px 20px;">Error loading map</div>';
            }
        }, 0);
    }

    displayForecast(days) {
        const container = document.getElementById('forecastDays');
        if (!container || !days) return;
        container.innerHTML = '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let startIndex = 0;
        for (let i = 0; i < days.length; i++) {
            const forecastDate = new Date(days[i].date + 'T00:00:00');
            forecastDate.setHours(0, 0, 0, 0);
            
            if (forecastDate.getTime() === today.getTime()) {
                startIndex = i;
                break;
            }
        }
        
        const displayDays = days.slice(startIndex, startIndex + 3);
        
        displayDays.forEach((day, index) => {
            const forecastDate = new Date(day.date + 'T00:00:00');
            const dayName = index === 0 ? 'Today' : forecastDate.toLocaleDateString('en-US', { weekday: 'long' });
            
            const div = document.createElement('div');
            div.className = 'forecast-day';
            div.innerHTML = `
                <div class="forecast-day-header">
                    <div class="forecast-day-left">
                        <div class="day">${dayName}</div>
                        <img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}">
                    </div>
                    <div class="forecast-day-right">
                        <div class="forecast-temp">${Math.round(day.day.maxtemp_c)}° / ${Math.round(day.day.mintemp_c)}°</div>
                        <div class="condition">${day.day.condition.text}</div>
                    </div>
                </div>
                <div class="forecast-day-details collapsed">
                    <div class="forecast-detail-item">
                        <span class="forecast-detail-label"><span class="forecast-detail-icon">💧</span> Precip %</span>
                        <span class="forecast-detail-value">${day.day.daily_chance_of_rain || 0}%</span>
                    </div>
                    <div class="forecast-detail-item">
                        <span class="forecast-detail-label"><span class="forecast-detail-icon">💨</span> Wind</span>
                        <span class="forecast-detail-value">${Math.round(day.day.maxwind_kph)} km/h</span>
                    </div>
                    <div class="forecast-detail-item">
                        <span class="forecast-detail-label"><span class="forecast-detail-icon">💦</span> Precip</span>
                        <span class="forecast-detail-value">${Math.round(day.day.totalprecip_mm * 10) / 10} mm</span>
                    </div>
                    <div class="forecast-detail-item">
                        <span class="forecast-detail-label"><span class="forecast-detail-icon">💧</span> Humidity</span>
                        <span class="forecast-detail-value">${day.day.avghumidity}%</span>
                    </div>
                    <div class="forecast-detail-item">
                        <span class="forecast-detail-label"><span class="forecast-detail-icon">☀️</span> UV</span>
                        <span class="forecast-detail-value">${day.day.uv || 0}</span>
                    </div>
                    <div class="forecast-detail-item">
                        <span class="forecast-detail-label"><span class="forecast-detail-icon">👁️</span> Visibility</span>
                        <span class="forecast-detail-value">${day.day.avgvis_km} km</span>
                    </div>
                    ${day.astro ? `
                    <div class="forecast-detail-item">
                        <span class="forecast-detail-label"><span class="forecast-detail-icon">🌅</span> Sunrise</span>
                        <span class="forecast-detail-value">${day.astro.sunrise}</span>
                    </div>
                    <div class="forecast-detail-item">
                        <span class="forecast-detail-label"><span class="forecast-detail-icon">🌇</span> Sunset</span>
                        <span class="forecast-detail-value">${day.astro.sunset}</span>
                    </div>
                    ` : ''}
                </div>
            `;
            
            const header = div.querySelector('.forecast-day-header');
            const details = div.querySelector('.forecast-day-details');
            
            header.addEventListener('click', () => {
                div.classList.toggle('expanded');
                details.classList.toggle('collapsed');
            });
            
            container.appendChild(div);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new WeatherExtension();
});

class WeatherExtension {
  constructor() {
    this.currentCity = null;
    this.pinnedCities = [];
    this.searchTimeout = null;
    this.API_BASE = 'https://weather-extension-1.onrender.com';
    this.init();
  }

  init() {
    this.loadSavedCity().catch(err => console.error('Init error:', err));
    this.bindEvents();
    this.bindPinButton();
  }

  async loadSavedCity() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['selectedCity', 'pinnedCities'], (result) => {
        let cityToLoad = 'Waterloo';
        const pinArray = result.pinnedCities || [];

        if (result.selectedCity) cityToLoad = result.selectedCity;
        else if (pinArray.length > 0) cityToLoad = pinArray[pinArray.length - 1].name;

        this.currentCity = cityToLoad;
        const searchEl = document.getElementById('citySearch');
        if (searchEl) searchEl.value = this.currentCity;

        if (pinArray.length > 0) {
          if (typeof pinArray[0] === 'string') {
            this.pinnedCities = pinArray.map(city => ({ name: city, localTime: '00:00' }));
            this.savePinnedCities();
          } else this.pinnedCities = pinArray;
        } else this.pinnedCities = [];

        this.updatePinnedCities();
        this.fetchWeatherData().catch(err => console.error('Initial fetch failed:', err));
        resolve();
      });
    });
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
      this.pinnedCities.push({ name: city, localTime: data.location.localtime });
    } catch {
      this.pinnedCities.push({ name: city, localTime: '00:00' });
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
    this.showLoading();
    this.hideError();
    this.hideWeatherData();

    try {
      const data = await this.fetchCity(this.currentCity);

      const hourlyDay1 = data.forecast?.forecastday[0]?.hour || [];
      const hourlyDay2 = data.forecast?.forecastday[1]?.hour || [];
      const allHourlyData = [...hourlyDay1, ...hourlyDay2];

      this.displayWeatherData(data, allHourlyData);

      const hour = this.getHourFromLocalTime(data.location.localtime);
      this.updateBackground(hour);

      chrome.storage.local.set({ selectedCity: this.currentCity });
      this.pinnedCities = this.pinnedCities.map(pin => {
        if (pin.name === this.currentCity) pin.localTime = data.location.localtime;
        return pin;
      });

      this.updatePinnedCities();
      this.updatePinButton();
    } catch (err) {
      console.error('Weather fetch error:', err);
      this.showError(`Failed to fetch weather: ${err.message}`);
    } finally {
      this.hideLoading();
    }
  }

  updatePinButton() {
    const btn = document.getElementById('pinButton');
    if (!btn) return;
    const pinned = this.pinnedCities.some(pin => pin.name === this.currentCity);
    btn.textContent = pinned ? '❌' : '📌';
    btn.classList.toggle('pinned', pinned);
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
      item.className = `pinned-item ${this.getTimePeriodClassFromHour(this.getHourFromLocalTime(pin.localTime))}`;

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

  getTimePeriodClassFromHour(hour) {
    if (hour >= 6 && hour < 12) return 'pinned-morning';
    if (hour >= 12 && hour < 15) return 'pinned-day';
    if (hour >= 15 && hour < 18) return 'pinned-afternoon';
    if (hour >= 18 && hour < 21) return 'pinned-evening';
    return 'pinned-night';
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
        this.fetchWeatherData();
        document.getElementById('citySearch')?.blur();
      } else {
        this.currentCity = document.getElementById('citySearch')?.value.trim();
        if (this.currentCity) {
          this.hideSearchResults();
          this.fetchWeatherData();
          document.getElementById('citySearch')?.blur();
        }
      }
    }
  }

  async smartSearchCities(query) {
  try {
    // Try direct WeatherAPI call (this may work despite CORS in Chrome extensions)
    console.log('Calling WeatherAPI directly...');
    
    // Using your API key directly
    const API_KEY = 'da9393ec436a49ef8b332007251611';
    const response = await fetch(
      `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error(`WeatherAPI HTTP ${response.status}: ${response.statusText}`);
    }
    
    const searchResults = await response.json();
    console.log('Direct API results:', searchResults);

    if (!Array.isArray(searchResults)) {
      throw new Error('WeatherAPI returned invalid data format');
    }

    // Get pinned city names for highlighting
    const pinnedCityNames = this.pinnedCities.map(pin => pin.name.toLowerCase());

    const enhancedResults = searchResults.map(city => ({
      ...city,
      isPinned: pinnedCityNames.includes(city.name.toLowerCase())
    }));

    // Sort: pinned cities first, then others
    enhancedResults.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    this.displaySearchResults(enhancedResults);
    
  } catch (error) {
    console.error('Direct API call failed:', error);
    
    // Fallback to mock data
    this.useMockSearchData(query);
  }
}

useMockSearchData(query) {
  // Comprehensive mock data for testing
  const mockCities = [
    { name: 'London', country: 'United Kingdom', region: 'City of London, Greater London' },
    { name: 'London', country: 'Canada', region: 'Ontario' },
    { name: 'London', country: 'United States', region: 'Kentucky' },
    { name: 'Paris', country: 'France', region: 'Ile-de-France' },
    { name: 'Paris', country: 'United States', region: 'Texas' },
    { name: 'Tokyo', country: 'Japan', region: 'Tokyo' },
    { name: 'New York', country: 'United States', region: 'New York' },
    { name: 'Sydney', country: 'Australia', region: 'New South Wales' },
    { name: 'Toronto', country: 'Canada', region: 'Ontario' },
    { name: 'Vancouver', country: 'Canada', region: 'British Columbia' },
    { name: 'Waterloo', country: 'Canada', region: 'Ontario' },
    { name: 'Waterloo', country: 'Belgium', region: 'Wallonia' },
    { name: 'Berlin', country: 'Germany', region: 'Berlin' },
    { name: 'Madrid', country: 'Spain', region: 'Madrid' },
    { name: 'Rome', country: 'Italy', region: 'Lazio' },
    { name: 'Moscow', country: 'Russia', region: 'Moscow' },
    { name: 'Beijing', country: 'China', region: 'Beijing' },
    { name: 'Delhi', country: 'India', region: 'Delhi' },
    { name: 'Dubai', country: 'United Arab Emirates', region: 'Dubai' },
    { name: 'Singapore', country: 'Singapore', region: 'Singapore' }
  ];

  // Filter based on query
  const filteredResults = mockCities.filter(city => 
    city.name.toLowerCase().includes(query.toLowerCase()) ||
    city.country.toLowerCase().includes(query.toLowerCase()) ||
    city.region.toLowerCase().includes(query.toLowerCase())
  );

  const pinnedCityNames = this.pinnedCities.map(pin => pin.name.toLowerCase());

  const enhancedResults = filteredResults.map(city => ({
    ...city,
    isPinned: pinnedCityNames.includes(city.name.toLowerCase())
  }));

  enhancedResults.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.name.localeCompare(b.name);
  });

  console.log('Using mock data for:', query, enhancedResults);
  this.displaySearchResults(enhancedResults);
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
  } 
  
  else {
    cities.forEach(city => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      
      if (city.isPinned) {
        item.classList.add('pinned-result');
      }
      
      let displayText = city.name;
      if (city.region && city.country) {
        displayText += `, ${city.region}, ${city.country}`;
      } 
      
      else if (city.country) {
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

  showLoading() { document.getElementById('loader')?.classList.remove('hidden'); }
  hideLoading() { document.getElementById('loader')?.classList.add('hidden'); }
  showError(msg) { const el = document.getElementById('errorMessage'); if (el) { el.textContent = msg; el.classList.remove('hidden'); } }
  hideError() { document.getElementById('errorMessage')?.classList.add('hidden'); }
  showWeatherData() { document.getElementById('weatherData')?.classList.remove('hidden'); }
  hideWeatherData() { document.getElementById('weatherData')?.classList.add('hidden'); }

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

    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const setIcon = (id, icon, alt) => { const el = document.getElementById(id); if (el) { el.src = `https:${icon}`; el.alt = alt; } };

    setText('locationName', `${data.location.name}, ${data.location.country}`);
    setText('currentDate', data.location.localtime.split(' ')[0]);
    setText('currentTemp', `${Math.round(data.current.temp_c)}°C`);
    setText('conditionText', data.current.condition.text);
    setIcon('weatherIcon', data.current.condition.icon, data.current.condition.text);
    setText('feelsLike', `${Math.round(data.current.feelslike_c)}°C`);
    setText('humidity', `${data.current.humidity}%`);
    setText('wind', `${data.current.wind_kph} km/h`);
    setText('pressure', `${data.current.pressure_mb} mb`);
    setText('visibility', `${data.current.vis_km} km`);
    setText('uv', data.current.uv);

    this.displayPrecipitation(data.current, hourlyData, data.location.localtime);
    this.displayForecast(data.forecast.forecastday);
    this.displayHourlyForecast(hourlyData, data.location.localtime);
  }

  displayPrecipitation(current, hourlyData, localTime) {
    const container = document.getElementById('precipitation');
    const totalEl = document.getElementById('totalPrecipitation');
    if (!container || !totalEl) return;

    const totalPrecip = Math.round(hourlyData.reduce((sum, h) => sum + (h.precip_mm ?? 0), 0) * 10) / 10;
    totalEl.textContent = `${totalPrecip} mm`;

    const currentPrecip = current.precip_mm ?? 0;
    const currentChance = current.chance_of_rain ?? current.chance_of_snow ?? 0;

    const currentTimeMs = new Date(localTime.replace(/-/g, '/')).getTime();
    const nextHours = hourlyData
      .filter(h => new Date(h.time.replace(/-/g, '/')).getTime() >= currentTimeMs)
      .slice(0, 5)
      .map(h => ({ time: h.time, chance: h.chance_of_rain ?? h.chance_of_snow ?? 0, precip: h.precip_mm ?? 0 }));

    let html = `<div class="precipitation-current">
      <div class="precip-label">Precipitation</div>
      <div class="precip-bar-container">
        <div class="precip-bar"><div class="precip-bar-fill" style="width: ${Math.min(currentChance, 100)}%"></div></div>
        <div class="precip-value">${currentPrecip}mm</div>
      </div>
      <div class="precip-chance">${currentChance}% chance</div>
    </div>`;

    if (nextHours.length > 0) {
      html += `<div class="precipitation-next">`;
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
    }

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
        const div = document.createElement('div');
        div.className = 'hourly-item';
        div.innerHTML = `<div class="hourly-time">${display}</div>
          <img src="https:${h.condition.icon}" class="hourly-icon" alt="${h.condition.text}">
          <div class="hourly-temp">${Math.round(h.temp_c)}°</div>`;
        container.appendChild(div);
      });
  }

  displayForecast(days) {
    const container = document.getElementById('forecastDays');
    if (!container || !days) return;
    container.innerHTML = '';
    days.forEach(day => {
      const date = new Date(day.date);
      const div = document.createElement('div');
      div.className = 'forecast-day';
      div.innerHTML = `<div class="day">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}">
        <div class="forecast-temp">${Math.round(day.day.maxtemp_c)}° / ${Math.round(day.day.mintemp_c)}°</div>
        <div class="condition">${day.day.condition.text}</div>`;
      container.appendChild(div);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new WeatherExtension();
});
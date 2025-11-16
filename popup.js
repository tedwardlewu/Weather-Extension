const API_KEY = 'da9393ec436a49ef8b332007251611';
const BASE_URL = 'https://api.weatherapi.com/v1';

class WeatherExtension {
  constructor() {
    this.currentCity = null;
    this.pinnedCities = [];
    this.searchTimeout = null;
    this.init();
  }

  init() {
    this.loadSavedCity();
    this.bindEvents();
  }

  loadSavedCity() {
    chrome.storage.local.get(['selectedCity', 'pinnedCities'], (result) => {
      let cityToLoad = null;
      let pinArray = result.pinnedCities || [];

      if (result.selectedCity) cityToLoad = result.selectedCity;
      else if (pinArray.length > 0) cityToLoad = pinArray[pinArray.length - 1].name;
      else cityToLoad = 'Waterloo';

      this.currentCity = cityToLoad;
      const searchEl = document.getElementById('citySearch');
      if (searchEl) searchEl.value = this.currentCity;

      if (pinArray.length > 0) {
        if (typeof pinArray[0] === 'string') {
          this.pinnedCities = pinArray.map(city => ({ name: city, localTime: '00:00' }));
          this.savePinnedCities();
        } else {
          this.pinnedCities = pinArray;
        }
      } else {
        this.pinnedCities = [];
      }

      this.updateC();
      this.fetchWeatherData();
    });
  }

  savePinnedCities() {
    chrome.storage.local.set({ pinnedCities: this.pinnedCities });
  }

  async togglePinCity(city) {
    const existingPinIndex = this.pinnedCities.findIndex(pin => pin.name === city);
    if (existingPinIndex > -1) {
      this.pinnedCities.splice(existingPinIndex, 1);
      this.savePinnedCities();
      this.updateC();
      this.updatePinButton();
      return;
    }

    const pinButton = document.getElementById('pinButton');
    if (pinButton) pinButton.textContent = '...';

    try {
      const weatherData = await this.fetchCity(city);
      const pinnedCity = { name: city, localTime: weatherData.location.localtime };
      this.pinnedCities.push(pinnedCity);
    } catch (error) {
      const pinnedCity = { name: city, localTime: '00:00' };
      this.pinnedCities.push(pinnedCity);
    }

    this.savePinnedCities();
    this.updateC();
    this.updatePinButton();
  }

  async fetchCity(city) {
    const res = await fetch(`${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(city)}&days=1&aqi=no&alerts=no`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP error ${res.status}`);
    }
    return res.json();
  }

  updatePinButton() {
    const pinButton = document.getElementById('pinButton');
    if (!pinButton) return;
    const isPinned = this.pinnedCities.some(pin => pin.name === this.currentCity);
    pinButton.textContent = isPinned ? '❌' : '📌';
    pinButton.classList.toggle('pinned', isPinned);
  }

  updateC() {
    const pinnedList = document.getElementById('pinnedList');
    const pinnedContainer = document.getElementById('pinnedCities');
    if (!pinnedList || !pinnedContainer) return;

    if (this.pinnedCities.length > 0) {
      pinnedContainer.classList.remove('hidden');
      pinnedList.innerHTML = '';
      this.pinnedCities.forEach((pinnedCity) => {
        const item = document.createElement('div');
        item.className = 'pinned-item';
        const timeClass = this.getTimePeriodClassFromHour(this.getHourFromLocalTime(pinnedCity.localTime));
        item.classList.add(timeClass);

        const cityName = document.createElement('span');
        cityName.className = 'pinned-city-name';
        cityName.textContent = pinnedCity.name;

        const unpinButton = document.createElement('button');
        unpinButton.className = 'unpin-button';
        unpinButton.textContent = '✕';
        unpinButton.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); this.togglePinCity(pinnedCity.name); });

        item.appendChild(cityName);
        item.appendChild(unpinButton);
        item.addEventListener('click', (e) => {
          if (!e.target.classList.contains('unpin-button')) {
            this.currentCity = pinnedCity.name;
            const searchEl = document.getElementById('citySearch');
            if (searchEl) searchEl.value = pinnedCity.name;
            this.fetchWeatherData();
            this.hideSearchResults();
          }
        });

        pinnedList.appendChild(item);
      });
    } else {
      pinnedContainer.classList.add('hidden');
    }
  }

  getHourFromLocalTime(localTime) {
    // API returns "YYYY-MM-DD HH:MM"
    try {
      return parseInt(localTime.split(' ')[1].split(':')[0]);
    } catch {
      return 12; // default noon if parsing fails
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
    const searchLoading = document.querySelector('.search-loading');
    if (citySearch) {
      citySearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        if (query.length > 2) {
          if (searchLoading) searchLoading.classList.remove('hidden');
          this.searchTimeout = setTimeout(() => { this.searchCities(query).finally(() => { if (searchLoading) searchLoading.classList.add('hidden'); }); }, 300);
        } else {
          this.hideSearchResults();
          if (searchLoading) searchLoading.classList.add('hidden');
        }
      });

      citySearch.addEventListener('focus', () => { if (this.pinnedCities.length > 0) document.getElementById('pinnedCities').classList.remove('hidden'); });

      citySearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = e.target.value.trim();
          if (query) { this.currentCity = query; this.hideSearchResults(); this.fetchWeatherData(); citySearch.blur(); }
        }
      });
    }

    const pinButton = document.getElementById('pinButton');
    if (pinButton) pinButton.addEventListener('click', () => this.togglePinCity(this.currentCity));

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.city-selector') && !e.target.closest('.pinned-cities')) {
        this.hideSearchResults();
        if (this.pinnedCities.length === 0) document.getElementById('pinnedCities').classList.add('hidden');
      }
    });
  }

  async searchCities(query) {
    try {
      const res = await fetch(`${BASE_URL}/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      this.displaySearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      this.hideSearchResults();
    }
  }

  displaySearchResults(cities) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';
    if (!cities || cities.length === 0) {
      const noResult = document.createElement('div');
      noResult.className = 'search-result-item';
      noResult.textContent = 'No cities found';
      noResult.style.color = '#64748b';
      noResult.style.cursor = 'default';
      resultsContainer.appendChild(noResult);
    } else {
      cities.forEach(city => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.textContent = `${city.name}, ${city.country}`;
        resultItem.addEventListener('click', () => {
          this.currentCity = `${city.name}, ${city.country}`;
          const searchEl = document.getElementById('citySearch');
          if (searchEl) searchEl.value = this.currentCity;
          this.hideSearchResults();
          this.fetchWeatherData();
        });
        resultsContainer.appendChild(resultItem);
      });
    }
    resultsContainer.classList.remove('hidden');
  }

  hideSearchResults() { const el = document.getElementById('searchResults'); if (el) el.classList.add('hidden'); }

  async fetchWeatherData() {
    this.showLoading();
    this.hideError();
    this.hideWeatherData();

    try {
      const res = await fetch(`${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(this.currentCity)}&days=3&aqi=no&alerts=no`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      
      // FIX: Combine hourly data from day 1 and day 2 to ensure we have future hours
      const hourlyDay1 = (data.forecast && data.forecast.forecastday && data.forecast.forecastday[0] && data.forecast.forecastday[0].hour) || [];
      const hourlyDay2 = (data.forecast && data.forecast.forecastday && data.forecast.forecastday[1] && data.forecast.forecastday[1].hour) || [];
      const allHourlyData = [...hourlyDay1, ...hourlyDay2];

      this.displayWeatherData(data, allHourlyData);

      // use API time directly
      const cityHour = this.getHourFromLocalTime(data.location.localtime);
      this.updateBackground(cityHour);

      chrome.storage.local.set({ selectedCity: this.currentCity });
      this.pinnedCities = this.pinnedCities.map(pin => { if (pin.name === this.currentCity) pin.localTime = data.location.localtime; return pin; });
      this.updateC();
      this.updatePinButton();
    } catch (error) {
      console.error('Weather fetch error:', error);
      this.showError(`Failed to fetch weather data: ${error.message}`);
      this.hideLoading();
    }
  }

  displayWeatherData(data, allHourlyData) { // Added allHourlyData as a parameter
    this.hideLoading();
    this.showWeatherData();

    const locName = document.getElementById('locationName');
    if (locName) locName.textContent = `${data.location.name}, ${data.location.country}`;

    const currentDate = document.getElementById('currentDate');
    if (currentDate) currentDate.textContent = data.location.localtime.split(' ')[0];

    const currentTemp = document.getElementById('currentTemp');
    if (currentTemp) currentTemp.textContent = `${Math.round(data.current.temp_c)}°C`;

    const conditionText = document.getElementById('conditionText');
    if (conditionText) conditionText.textContent = data.current.condition.text;

    const weatherIcon = document.getElementById('weatherIcon');
    if (weatherIcon) { weatherIcon.src = `https:${data.current.condition.icon}`; weatherIcon.alt = data.current.condition.text; }

    const feelsLike = document.getElementById('feelsLike');
    if (feelsLike) feelsLike.textContent = `${Math.round(data.current.feelslike_c)}°C`;

    const humidity = document.getElementById('humidity');
    if (humidity) humidity.textContent = `${data.current.humidity}%`;

    const wind = document.getElementById('wind');
    if (wind) wind.textContent = `${data.current.wind_kph} km/h`;

    const pressure = document.getElementById('pressure');
    if (pressure) pressure.textContent = `${data.current.pressure_mb} mb`;

    const visibility = document.getElementById('visibility');
    if (visibility) visibility.textContent = `${data.current.vis_km} km`;

    const uv = document.getElementById('uv');
    if (uv) uv.textContent = data.current.uv;

    this.displayPrecipitation(data.current, allHourlyData, data.location.localtime);
    this.displayForecast(data.forecast.forecastday);
    this.displayHourlyForecast(allHourlyData, data.location.localtime);
  }

  displayPrecipitation(currentData, allHourlyData, localTime) {
    const pContainer = document.getElementById('precipitation');
    const totalPrecipContainer = document.getElementById('totalPrecipitation');
    if (!pContainer || !totalPrecipContainer) return;

    // Sum for the next 24 hours (first 24 entries in combined data)
    const totalPrecip = this.calculateSum(allHourlyData.slice(0, 24)); 
    totalPrecipContainer.textContent = `${totalPrecip} mm`;

    const currentPrecip = currentData.precip_mm ?? 0;
    const currentChance = currentData.chance_of_rain ?? currentData.chance_of_snow ?? 0;

    let nextPrecipitation = [];
    if (allHourlyData.length > 0) {
      // FIX: Use Date timestamp for accurate future hour comparison
      const currentTimeMs = new Date(localTime.replace(/-/g, '/')).getTime(); 

      nextPrecipitation = allHourlyData
        .filter(h => {
          const hourTimeMs = new Date(h.time.replace(/-/g, '/')).getTime();
          // Filter to include the current hour and all future hours
          return hourTimeMs >= currentTimeMs;
        })
        .slice(0, 5)
        .map(hour => ({
          time: hour.time,
          chance: hour.chance_of_rain ?? hour.chance_of_snow ?? 0,
          precip: hour.precip_mm ?? 0
        }));
    }

    let precipitationHTML = `<div class="precipitation-current"><div class="precip-label">Precipitation</div><div class="precip-bar-container"><div class="precip-bar"><div class="precip-bar-fill" style="width: ${Math.min(currentChance, 100)}%"></div></div><div class="precip-value">${currentPrecip}mm</div></div><div class="precip-chance">${currentChance}% chance</div></div>`;

    if (nextPrecipitation.length > 0) {
      precipitationHTML += `<div class="precipitation-next">`;
      nextPrecipitation.forEach(hour => {
        const hourNum = parseInt(hour.time.split(' ')[1].split(':')[0]);
        const hourDisplay = `${hourNum % 12 === 0 ? 12 : hourNum % 12}${hourNum >= 12 ? 'PM' : 'AM'}`;

        precipitationHTML += `<div class="precip-hour"><div class="precip-hour-time">${hourDisplay}</div><div class="precip-hour-bar-container"><div class="precip-hour-bar"><div class="precip-hour-bar-fill" style="width: ${Math.min(hour.chance, 100)}%"></div></div></div><div class="precip-hour-info"><div class="precip-hour-chance">${hour.chance}%</div><div class="precip-hour-amount">${hour.precip}mm</div></div></div>`;
      });
      precipitationHTML += `</div>`;
    }

    pContainer.innerHTML = precipitationHTML;
  }

  calculateSum(hourlyData) {
    if (!hourlyData || hourlyData.length === 0) return 0;
    let total = 0;
    hourlyData.forEach(hour => { total += hour.precip_mm ?? 0; });
    return Math.round(total * 10) / 10;
  }

  displayHourlyForecast(allHourlyData, localTime) {
    const container = document.getElementById('hourlyForecast');
    if (!container) return;
    container.innerHTML = '';

    // FIX: Use Date timestamp for accurate future hour comparison
    const currentTimeMs = new Date(localTime.replace(/-/g, '/')).getTime();

    const nextHours = allHourlyData
      .filter(h => {
        const hourTimeMs = new Date(h.time.replace(/-/g, '/')).getTime();
        // Filter to include the current hour and all future hours
        return hourTimeMs >= currentTimeMs;
      })
      .slice(0, 5);

    nextHours.forEach((hour, index) => {
      const hourNum = parseInt(hour.time.split(' ')[1].split(':')[0]);
      const display = index === 0 ? 'Now' : `${hourNum % 12 === 0 ? 12 : hourNum % 12}${hourNum >= 12 ? 'PM' : 'AM'}`;

      const item = document.createElement('div');
      item.className = 'hourly-item';
      item.innerHTML = `
        <div class="hourly-time">${display}</div>
        <img src="https:${hour.condition.icon}" class="hourly-icon" alt="${hour.condition.text}">
        <div class="hourly-temp">${Math.round(hour.temp_c)}°</div>
      `;
      container.appendChild(item);
    });
  }

  displayForecast(forecastDays) {
    const forecastContainer = document.getElementById('forecastDays');
    if (!forecastContainer) return;
    forecastContainer.innerHTML = '';
    if (!forecastDays || !forecastDays.forEach) return;
    forecastDays.forEach(day => {
      const date = new Date(day.date);
      const forecastDay = document.createElement('div');
      forecastDay.className = 'forecast-day';
      forecastDay.innerHTML = `<div class="day">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div><img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}"><div class="forecast-temp">${Math.round(day.day.maxtemp_c)}° / ${Math.round(day.day.mintemp_c)}°</div><div class="condition">${day.day.condition.text}</div>`;
      forecastContainer.appendChild(forecastDay);
    });
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

  showLoading() { const el = document.getElementById('loading'); if (el) el.classList.remove('hidden'); }
  hideLoading() { const el = document.getElementById('loading'); if (el) el.classList.add('hidden'); }
  showWeatherData() { const el = document.getElementById('weatherData'); if (el) el.classList.remove('hidden'); }
  hideWeatherData() { const el = document.getElementById('weatherData'); if (el) el.classList.add('hidden'); }
  showError(msg) { const e = document.getElementById('error'); if (e) { e.textContent = msg; e.classList.remove('hidden'); } }
  hideError() { const e = document.getElementById('error'); if (e) e.classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => new WeatherExtension());
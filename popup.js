const API_KEY = '52dcbd0a6754456ebaf83447250710';
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
      let pinnedCitiesArray = result.pinnedCities || [];

      if (result.selectedCity) {
        cityToLoad = result.selectedCity;
      } else if (pinnedCitiesArray.length > 0) {
        cityToLoad = pinnedCitiesArray[pinnedCitiesArray.length - 1].name;
      } else {
        cityToLoad = 'Waterloo'; // Changed from 'London'
      }
      
      this.currentCity = cityToLoad;
      document.getElementById('citySearch').value = this.currentCity;

      if (pinnedCitiesArray.length > 0) {
        if (typeof pinnedCitiesArray[0] === 'string') {
          this.pinnedCities = pinnedCitiesArray.map(city => ({
            name: city,
            localTime: new Date().toISOString()
          }));
          this.savePinnedCities();
        } else {
          this.pinnedCities = pinnedCitiesArray;
        }
      } else {
        this.pinnedCities = [];
      }
      
      this.updatePinnedCities();
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
      this.updatePinnedCities();
      this.updatePinButton();
    } else {
      const pinButton = document.getElementById('pinButton');
      pinButton.textContent = '...';
      
      try {
        const weatherData = await this.fetchWeatherDataForCity(city);
        const pinnedCity = {
          name: city,
          localTime: weatherData.location.localtime
        };
        this.pinnedCities.push(pinnedCity);
        this.savePinnedCities();
        this.updatePinnedCities();
        this.updatePinButton();
      } catch (error) {
        console.error('Error fetching weather for pin:', error);
        const pinnedCity = {
          name: city,
          localTime: new Date().toISOString()
        };
        this.pinnedCities.push(pinnedCity);
        this.savePinnedCities();
        this.updatePinnedCities();
        this.updatePinButton();
      }
    }
  }

  async fetchWeatherDataForCity(city) {
    const response = await fetch(
      `${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(city)}&days=1&aqi=no&alerts=no`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  updatePinButton() {
    const pinButton = document.getElementById('pinButton');
    if (pinButton) {
      const isPinned = this.pinnedCities.some(pin => pin.name === this.currentCity);
      pinButton.textContent = isPinned ? '❌' : '📌';
      pinButton.classList.toggle('pinned', isPinned);
    }
  }

  updatePinnedCities() {
    const pinnedList = document.getElementById('pinnedList');
    const pinnedContainer = document.getElementById('pinnedCities');
    
    if (this.pinnedCities.length > 0) {
      pinnedContainer.classList.remove('hidden');
      pinnedList.innerHTML = '';
      
      this.pinnedCities.forEach((pinnedCity) => {
        const item = document.createElement('div');
        item.className = 'pinned-item';
        
        const timeClass = this.getTimePeriodClass(pinnedCity.localTime);
        item.classList.add(timeClass);
        
        const cityName = document.createElement('span');
        cityName.className = 'pinned-city-name';
        cityName.textContent = pinnedCity.name;
        
        const unpinButton = document.createElement('button');
        unpinButton.className = 'unpin-button';
        unpinButton.textContent = '✕';
        unpinButton.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.togglePinCity(pinnedCity.name);
        });
        
        item.appendChild(cityName);
        item.appendChild(unpinButton);
        
        item.addEventListener('click', (e) => {
          if (!e.target.classList.contains('unpin-button')) {
            this.currentCity = pinnedCity.name;
            document.getElementById('citySearch').value = pinnedCity.name;
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

  getTimePeriodClass(localTime) {
    try {
      const hour = new Date(localTime).getHours();
      
      if (hour >= 6 && hour < 12) {
        return 'pinned-morning';
      } else if (hour >= 12 && hour < 15) {
        return 'pinned-day';
      } else if (hour >= 15 && hour < 18) {
        return 'pinned-afternoon';
      } else if (hour >= 18 && hour < 21) {
        return 'pinned-evening';
      } else {
        return 'pinned-night';
      }
    } catch (error) {
      console.error('Error parsing localTime:', localTime, error);
      return 'pinned-day';
    }
  }

  bindEvents() {
    const citySearch = document.getElementById('citySearch');
    const searchLoading = document.querySelector('.search-loading');
    
    citySearch.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      if (this.searchTimeout) {
        clearTimeout(this.searchTimeout);
      }
      
      if (query.length > 2) {
        searchLoading.classList.remove('hidden');
        this.searchTimeout = setTimeout(() => {
          this.searchCities(query).finally(() => {
            searchLoading.classList.add('hidden');
          });
        }, 300);
      } else {
        this.hideSearchResults();
        searchLoading.classList.add('hidden');
      }
    });
    
    citySearch.addEventListener('focus', () => {
      if (this.pinnedCities.length > 0) {
        document.getElementById('pinnedCities').classList.remove('hidden');
      }
    });
    
    citySearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (query) {
          this.currentCity = query;
          this.hideSearchResults();
          this.fetchWeatherData();
          citySearch.blur();
        }
      }
    });
    
    const pinButton = document.getElementById('pinButton');
    if (pinButton) {
      pinButton.addEventListener('click', () => {
        this.togglePinCity(this.currentCity);
      });
    }
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.city-selector') && 
          !e.target.closest('.pinned-cities')) {
        this.hideSearchResults();
        
        if (this.pinnedCities.length === 0) {
          document.getElementById('pinnedCities').classList.add('hidden');
        }
      }
    });
  }

  async searchCities(query) {
    try {
      const response = await fetch(
        `${BASE_URL}/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.displaySearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      this.hideSearchResults();
    }
  }

  displaySearchResults(cities) {
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = '';
    
    if (cities.length === 0) {
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
          document.getElementById('citySearch').value = this.currentCity;
          this.hideSearchResults();
          this.fetchWeatherData();
        });
        resultsContainer.appendChild(resultItem);
      });
    }
    
    resultsContainer.classList.remove('hidden');
  }

  hideSearchResults() {
    document.getElementById('searchResults').classList.add('hidden');
  }

  async fetchWeatherData() {
    this.showLoading();
    this.hideError();
    this.hideWeatherData();

    try {
      const response = await fetch(
        `${BASE_URL}/forecast.json?key=${API_KEY}&q=${encodeURIComponent(this.currentCity)}&days=3&aqi=no&alerts=no`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.displayWeatherData(data);
      this.updateBackground(data.location.localtime);
      
      chrome.storage.local.set({ selectedCity: this.currentCity });
      
      this.pinnedCities = this.pinnedCities.map(pin => {
        if (pin.name === this.currentCity) pin.localTime = data.location.localtime;
        return pin;
      });
      this.updatePinnedCities();
      this.updatePinButton();
    } catch (error) {
      console.error('Weather fetch error:', error);
      this.showError(`Failed to fetch weather data: ${error.message}`);
    }
  }

  displayWeatherData(data) {
    this.hideLoading();
    this.showWeatherData();
    
    document.getElementById('locationName').textContent = 
      `${data.location.name}, ${data.location.country}`;

    document.getElementById('currentDate').textContent = 
      new Date(data.location.localtime).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

    document.getElementById('currentTemp').textContent = 
      `${Math.round(data.current.temp_c)}°C`;

    document.getElementById('conditionText').textContent = 
      data.current.condition.text;

    const weatherIcon = document.getElementById('weatherIcon');
    weatherIcon.src = `https:${data.current.condition.icon}`;
    weatherIcon.alt = data.current.condition.text;

    document.getElementById('feelsLike').textContent = 
      `${Math.round(data.current.feelslike_c)}°C`;

    document.getElementById('humidity').textContent = 
      `${data.current.humidity}%`;

    document.getElementById('wind').textContent = 
      `${data.current.wind_kph} km/h`;

    document.getElementById('pressure').textContent = 
      `${data.current.pressure_mb} mb`;

    document.getElementById('visibility').textContent = 
      `${data.current.vis_km} km`;

    document.getElementById('uv').textContent = 
      data.current.uv;

    this.displayPrecipitation(data.current, data.forecast.forecastday[0].hour);

    this.displayForecast(data.forecast.forecastday);
    
    const todayHourly = data.forecast.forecastday[0].hour;
    this.displayHourlyForecast(todayHourly, data.location.localtime);
  }

 displayPrecipitation(currentData, hourlyData) {
  const precipitationContainer = document.getElementById('precipitation');
  if (!precipitationContainer) return;

  const currentPrecip = currentData.precip_mm ?? 0;
  const currentChance = currentData.chance_of_rain ?? currentData.chance_of_snow ?? 0;

  let nextPrecipitation = [];
  if (hourlyData && hourlyData.length > 0) {
    const now = new Date();
    nextPrecipitation = hourlyData
      .filter(hour => new Date(hour.time) > now)
      .slice(0, 5)
      .map(hour => ({
        time: new Date(hour.time),
        chance: hour.chance_of_rain ?? hour.chance_of_snow ?? 0,
        precip: hour.precip_mm ?? 0
      }));
  }

  let precipitationHTML = `
    <div class="precipitation-current">
      <div class="precip-label">Precipitation</div>
      <div class="precip-bar-container">
        <div class="precip-bar">
          <div class="precip-bar-fill" style="width: ${Math.min(currentChance, 100)}%"></div>
        </div>
        <div class="precip-value">${currentPrecip}mm</div>
      </div>
      <div class="precip-chance">${currentChance}% chance</div>
    </div>
  `;

  if (nextPrecipitation.length > 0) {
    precipitationHTML += `<div class="precipitation-next">`;
    nextPrecipitation.forEach(hour => {
      const timeDisplay = hour.time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true
      }).replace(' AM', 'AM').replace(' PM', 'PM');

      precipitationHTML += `
        <div class="precip-hour">
          <div class="precip-hour-time">${timeDisplay}</div>
          <div class="precip-hour-bar-container">
            <div class="precip-hour-bar">
              <div class="precip-hour-bar-fill" style="width: ${Math.min(hour.chance, 100)}%"></div>
            </div>
          </div>
          <div class="precip-hour-info">
            <div class="precip-hour-chance">${hour.chance}%</div>
            <div class="precip-hour-amount">${hour.precip}mm</div>
          </div>
        </div>
      `;
    });
    precipitationHTML += `</div>`;
  }

  precipitationContainer.innerHTML = precipitationHTML;
}


  displayHourlyForecast(hourlyData, localTime) {
    const hourlyContainer = document.getElementById('hourlyForecast');
    if (!hourlyContainer) {
      console.error('Hourly container not found!');
      return;
    }

    hourlyContainer.innerHTML = '';
    
    const now = new Date(localTime);
    const currentHour = now.getHours();

    const currentHourIndex = hourlyData.findIndex(hour => {
      const hourTime = new Date(hour.time);
      return hourTime.getHours() === currentHour;
    });

    if (currentHourIndex === -1) {
      hourlyContainer.innerHTML = '<div class="no-hourly-data">No hourly data available</div>';
      return;
    }

    const next5Hours = hourlyData.slice(currentHourIndex, currentHourIndex + 5);

    if (next5Hours.length === 0) {
      hourlyContainer.innerHTML = '<div class="no-hourly-data">No hourly data available</div>';
      return;
    }

    next5Hours.forEach((hour, index) => {
      const hourTime = new Date(hour.time);
      const hourItem = document.createElement('div');
      hourItem.className = 'hourly-item';
      
      let timeDisplay;
      if (index === 0) {
        timeDisplay = 'Now';
      } else {
        timeDisplay = hourTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          hour12: true
        }).replace(' AM', 'AM').replace(' PM', 'PM');
      }
      
      hourItem.innerHTML = `
        <div class="hourly-time">${timeDisplay}</div>
        <img src="https:${hour.condition.icon}" alt="${hour.condition.text}" class="hourly-icon">
        <div class="hourly-temp">${Math.round(hour.temp_c)}°</div>
      `;
      
      hourlyContainer.appendChild(hourItem);
    });
  }

  displayForecast(forecastDays) {
    const forecastContainer = document.getElementById('forecastDays');
    forecastContainer.innerHTML = '';

    forecastDays.forEach(day => {
      const date = new Date(day.date);
      const forecastDay = document.createElement('div');
      forecastDay.className = 'forecast-day';
      
      forecastDay.innerHTML = `
        <div class="day">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
        <img src="https:${day.day.condition.icon}" alt="${day.day.condition.text}">
        <div class="forecast-temp">${Math.round(day.day.maxtemp_c)}° / ${Math.round(day.day.mintemp_c)}°</div>
        <div class="condition">${day.day.condition.text}</div>
      `;
      
      forecastContainer.appendChild(forecastDay);
    });
  }

  updateBackground(localTime) {
    const hour = new Date(localTime).getHours();
    const body = document.body;
    
    body.classList.remove('background-morning', 'background-day', 'background-afternoon', 'background-evening', 'background-night');
    
    if (hour >= 6 && hour < 12) {
      body.classList.add('background-morning');
    } else if (hour >= 12 && hour < 15) {
      body.classList.add('background-day');
    } else if (hour >= 15 && hour < 18) {
      body.classList.add('background-afternoon');
    } else if (hour >= 18 && hour < 21) {
      body.classList.add('background-evening');
    } else {
      body.classList.add('background-night');
    }
  }

  showLoading() { document.getElementById('loading').classList.remove('hidden'); }
  hideLoading() { document.getElementById('loading').classList.add('hidden'); }
  showWeatherData() { document.getElementById('weatherData').classList.remove('hidden'); }
  hideWeatherData() { document.getElementById('weatherData').classList.add('hidden'); }
  showError(msg) { const e = document.getElementById('error'); e.textContent = msg; e.classList.remove('hidden'); }
  hideError() { document.getElementById('error').classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => new WeatherExtension());
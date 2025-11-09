const API_KEY = '52dcbd0a6754456ebaf83447250710';
const BASE_URL = 'https://api.weatherapi.com/v1';

class WeatherExtension {
  constructor() {
    this.currentCity = 'London';
    this.pinnedCities = []; 
    this.searchTimeout = null;
    this.init();
  }

  init() {
    this.loadSavedCity();
    this.loadPinnedCities();
    this.bindEvents();
    this.fetchWeatherData();
  }

  loadSavedCity() {
    chrome.storage.local.get(['selectedCity', 'pinnedCities'], (result) => {
      if (result.selectedCity) {
        this.currentCity = result.selectedCity;
        document.getElementById('citySearch').value = this.currentCity;
      }
      if (result.pinnedCities) {
        if (result.pinnedCities.length > 0) {
          if (typeof result.pinnedCities[0] === 'string') {
            this.pinnedCities = result.pinnedCities.map(city => ({
              name: city,
              localTime: new Date().toISOString()
            }));
            this.savePinnedCities();
          } else {
            this.pinnedCities = result.pinnedCities;
          }
        } else {
          this.pinnedCities = [];
        }
        this.updatePinnedCities();
      }
    });
  }

  loadPinnedCities() {
    chrome.storage.local.get(['pinnedCities'], (result) => {
      if (result.pinnedCities) {
        this.pinnedCities = result.pinnedCities;
        this.updatePinnedCities();
      }
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
      const originalText = pinButton.textContent;
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
      pinButton.textContent = isPinned ? '📍' : '📌';
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
      console.log('API Response:', data);
      this.displayWeatherData(data);
      this.updateBackground(data.location.localtime);
      
      chrome.storage.local.set({ selectedCity: this.currentCity });
      
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

    this.displayForecast(data.forecast.forecastday);
    
    // Add hourly forecast - get today's hourly data and pass local time
    const todayHourly = data.forecast.forecastday[0].hour;
    this.displayHourlyForecast(todayHourly, data.location.localtime);
  }

  displayHourlyForecast(hourlyData, localTime) {
    const hourlyContainer = document.getElementById('hourlyForecast');
    if (!hourlyContainer) {
      console.error('Hourly container not found!');
      return;
    }

    console.log('Displaying hourly forecast with data:', hourlyData);
    console.log('Local time:', localTime);
    
    // Clear previous content
    hourlyContainer.innerHTML = '';
    
    // Get current time based on the city's local time
    const now = new Date(localTime);
    const currentHour = now.getHours();
    
    console.log('Current hour in city:', currentHour);

    // Find the current hour in the hourly data
    const currentHourIndex = hourlyData.findIndex(hour => {
      const hourTime = new Date(hour.time);
      return hourTime.getHours() === currentHour;
    });

    if (currentHourIndex === -1) {
      console.log('Current hour not found in hourly data');
      hourlyContainer.innerHTML = '<div class="no-hourly-data">No hourly data available</div>';
      return;
    }

    // Get the next 5 hours: current hour + next 4 hours
    const next5Hours = hourlyData.slice(currentHourIndex, currentHourIndex + 5);

    console.log('Next 5 hours:', next5Hours);

    if (next5Hours.length === 0) {
      console.log('No hours found');
      hourlyContainer.innerHTML = '<div class="no-hourly-data">No hourly data available</div>';
      return;
    }

    next5Hours.forEach((hour, index) => {
      const hourTime = new Date(hour.time);
      const hourItem = document.createElement('div');
      hourItem.className = 'hourly-item';
      
      // Format time label to show actual time (e.g., "2 PM", "3 PM")
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

    console.log('Hourly forecast displayed with', next5Hours.length, 'items');
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

  showLoading() {
    document.getElementById('loading').classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loading').classList.add('hidden');
  }

  showWeatherData() {
    document.getElementById('weatherData').classList.remove('hidden');
  }

  hideWeatherData() {
    document.getElementById('weatherData').classList.add('hidden');
  }

  showError(message) {
    this.hideLoading();
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
  }

  hideError() {
    document.getElementById('error').classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new WeatherExtension();
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});
const API_KEY = '52dcbd0a6754456ebaf83447250710';
const BASE_URL = 'https://api.weatherapi.com/v1';

class WeatherExtension {
  constructor() {
    this.currentCity = 'London';
    this.recentSearches = [];
    this.pinnedCities = []; // Store objects with name and localTime
    this.searchTimeout = null;
    this.init();
  }

  init() {
    this.loadSavedCity();
    this.loadRecentSearches();
    this.loadPinnedCities();
    this.bindEvents();
    this.fetchWeatherData();
  }

  loadSavedCity() {
    chrome.storage.local.get(['selectedCity', 'recentSearches', 'pinnedCities'], (result) => {
      if (result.selectedCity) {
        this.currentCity = result.selectedCity;
        document.getElementById('citySearch').value = this.currentCity;
      }
      if (result.recentSearches) {
        this.recentSearches = result.recentSearches;
        this.updateRecentSearches();
      }
      if (result.pinnedCities) {
        // Handle both string and object formats
        if (result.pinnedCities.length > 0) {
          if (typeof result.pinnedCities[0] === 'string') {
            // Convert string format to object format
            this.pinnedCities = result.pinnedCities.map(city => ({
              name: city,
              localTime: new Date().toISOString() // Default time
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

  loadRecentSearches() {
    chrome.storage.local.get(['recentSearches'], (result) => {
      if (result.recentSearches) {
        this.recentSearches = result.recentSearches;
        this.updateRecentSearches();
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

  saveRecentSearches() {
    chrome.storage.local.set({ recentSearches: this.recentSearches });
  }

  savePinnedCities() {
    chrome.storage.local.set({ pinnedCities: this.pinnedCities });
  }

  addToRecentSearches(city) {
    this.recentSearches = this.recentSearches.filter(item => item !== city);
    this.recentSearches.unshift(city);
    
    if (this.recentSearches.length > 5) {
      this.recentSearches = this.recentSearches.slice(0, 5);
    }
    
    this.saveRecentSearches();
    this.updateRecentSearches();
  }

  async togglePinCity(city) {
    const existingPinIndex = this.pinnedCities.findIndex(pin => pin.name === city);
    
    if (existingPinIndex > -1) {
      // Unpin the city
      this.pinnedCities.splice(existingPinIndex, 1);
      this.savePinnedCities();
      this.updatePinnedCities();
      this.updatePinButton();
    } else {
      // Pin the city - get current time data
      const pinButton = document.getElementById('pinButton');
      const originalText = pinButton.textContent;
      pinButton.textContent = '...';
      
      try {
        // Fetch weather data to get proper local time
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
        // Fallback with current time
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

  updateRecentSearches() {
    const recentList = document.getElementById('recentList');
    const recentContainer = document.getElementById('recentSearches');
    
    if (this.recentSearches.length > 0) {
      recentContainer.classList.remove('hidden');
      recentList.innerHTML = '';
      
      this.recentSearches.forEach(city => {
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.textContent = city;
        item.addEventListener('click', () => {
          this.currentCity = city;
          document.getElementById('citySearch').value = city;
          this.fetchWeatherData();
          this.hideSearchResults();
          document.getElementById('recentSearches').classList.add('hidden');
        });
        recentList.appendChild(item);
      });
    } else {
      recentContainer.classList.add('hidden');
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
        
        // Add time-based color class
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
        
        // Make the entire item clickable (except the unpin button)
        item.addEventListener('click', (e) => {
          if (!e.target.classList.contains('unpin-button')) {
            this.currentCity = pinnedCity.name;
            document.getElementById('citySearch').value = pinnedCity.name;
            this.fetchWeatherData();
            this.hideSearchResults();
            document.getElementById('recentSearches').classList.add('hidden');
            // DON'T hide pinned cities when clicking on them!
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
      if (this.recentSearches.length > 0) {
        document.getElementById('recentSearches').classList.remove('hidden');
      }
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
          document.getElementById('recentSearches').classList.add('hidden');
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
          !e.target.closest('.recent-searches') && 
          !e.target.closest('.pinned-cities')) {
        this.hideSearchResults();
        document.getElementById('recentSearches').classList.add('hidden');
        // Only hide pinned cities if clicking outside AND they're empty
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
          document.getElementById('recentSearches').classList.add('hidden');
          // Don't hide pinned cities when selecting from search
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
      
      this.addToRecentSearches(this.currentCity);
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
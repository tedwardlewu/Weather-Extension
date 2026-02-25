console.log('[MAP] Script loaded');
let map = null;
let marker = null;
let searchTimeout = null;
const API_KEY = 'da9393ec436a49ef8b332007251611'; //pls no steal :(

function waitForContainer(callback) {
  const container = document.getElementById('map');
  if (!container) {
    console.error('[MAP] Map container not found!');
    return;
  }
  

  const checkDimensions = () => {
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    console.log('[MAP] Container dimensions:', width, 'x', height);
    
    if (width > 0 && height > 0) {
      console.log('[MAP] Container ready with dimensions');
      callback();
    } else {
      console.log('[MAP] Container not ready, retrying...');
      setTimeout(checkDimensions, 50);
    }
  };
  
  checkDimensions();
}


async function searchCities(query) {
  if (!query || query.length < 2) return [];
  
  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) {
      throw new Error(`WeatherAPI HTTP ${response.status}`);
    }
    
    const results = await response.json();
    
    if (!Array.isArray(results)) {
      return [];
    }
    
    return results.map(city => ({
      name: city.name,
      region: city.region,
      country: city.country,
      lat: city.lat,
      lon: city.lon,
      displayName: `${city.name}, ${city.region ? city.region + ', ' : ''}${city.country}`
    }));
  } catch (error) {
    console.error('[MAP] Search error:', error);
    return [];
  }
}


function displaySearchResults(results) {
  const container = document.getElementById('mapSearchResults');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (results.length === 0) {
    container.classList.remove('active');
    return;
  }
  
  results.forEach(result => {
    const item = document.createElement('div');
    item.className = 'map-search-result-item';
    item.textContent = result.displayName;
    item.addEventListener('click', () => {
      if (map && marker) {
        map.setView([result.lat, result.lon], 12, { animate: true });
        marker.setLatLng([result.lat, result.lon]);
        marker.setPopupContent(`
          <div style="text-align: center;">
            <b>${result.name}</b><br>
            ${result.region ? result.region + ', ' : ''}${result.country}
          </div>
        `).openPopup();
      }
      container.classList.remove('active');
      document.getElementById('mapSearch').value = '';
    });
    container.appendChild(item);
  });
  
  container.classList.add('active');
}


function initMap(lat, lon, cityName, country) {
  console.log('[MAP] initMap called with:', lat, lon, cityName, country);
  
  
  if (map && marker) {
    console.log('[MAP] Updating existing map position');
    map.setView([lat, lon], map.getZoom(), { animate: true });
    marker.setLatLng([lat, lon]);
    marker.setPopupContent(`
      <div style="text-align: center;">
        <b>${cityName}</b><br>
        ${country}
      </div>
    `).openPopup();
    return;
  }

  if (typeof L === 'undefined') {
    console.error('[MAP] Leaflet library not loaded!');
    document.getElementById('map').innerHTML = '<div style="color: white; text-align: center; padding: 60px 20px;">Map library not loaded</div>';
    return;
  }


  waitForContainer(() => {
    console.log('[MAP] Creating map...');
    
 
    map = L.map('map', {
      center: [lat, lon],
      zoom: 12,
      zoomControl: false,
      scrollWheelZoom: true,
      trackResize: true,
      preferCanvas: true, 
      zoomAnimation: true,
      fadeAnimation: true,
      markerZoomAnimation: true
    });

    console.log('[MAP] Adding tile layer...');
    

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      updateWhenIdle: false,
      updateWhenZooming: false, 
      keepBuffer: 2 
    }).addTo(map);

    console.log('[MAP] Adding marker...');
    
 
    marker = L.marker([lat, lon]).addTo(map);
    marker.bindPopup(`
      <div style="text-align: center;">
        <b>${cityName}</b><br>
        ${country}
      </div>
    `).openPopup();


    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    
    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        map.zoomIn();
      });
    }
    
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        map.zoomOut();
      });
    }


    const searchInput = document.getElementById('mapSearch');
    const searchResults = document.getElementById('mapSearchResults');
    
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (searchTimeout) clearTimeout(searchTimeout);
        
        if (query.length < 2) {
          searchResults.classList.remove('active');
          return;
        }
        
        searchTimeout = setTimeout(async () => {
          const results = await searchCities(query);
          displaySearchResults(results);
        }, 300);
      });
      
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.map-search-container')) {
          searchResults.classList.remove('active');
        }
      });
    }

    setTimeout(() => {
      if (map) {
        console.log('[MAP] Forcing size recalculation');
        map.invalidateSize({ pan: false });
        map.setView([lat, lon], 12);
      }
    }, 100);
    
    setTimeout(() => {
      if (map) {
        console.log('[MAP] Second size recalculation');
        map.invalidateSize({ pan: false });
      }
    }, 300);
    
    console.log('[MAP] Map initialized successfully');
  });
}

window.addEventListener('message', (event) => {
  console.log('[MAP] Received message:', event.data);
  if (event.data && event.data.type === 'UPDATE_MAP') {
    const { lat, lon, cityName, country } = event.data;
    initMap(lat, lon, cityName, country);
  }
});

console.log('[MAP] Waiting for location data from parent...');
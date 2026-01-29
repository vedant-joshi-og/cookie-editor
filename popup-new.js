let currentCookies = [];
let selectedCookie = null;
let currentDomain = '';

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentSiteCookies();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('openFullPage').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  document.getElementById('updateCookie').addEventListener('click', updateCookie);
  document.getElementById('resetCookie').addEventListener('click', resetCookie);
  document.getElementById('closeEditor').addEventListener('click', () => {
    document.getElementById('cookieEditor').style.display = 'none';
  });
}

async function loadCurrentSiteCookies() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    currentDomain = url.hostname;
    
    document.getElementById('currentSite').textContent = `${currentDomain}`;
    
    const cookies = await chrome.cookies.getAll({ domain: currentDomain });
    currentCookies = cookies;
    
    document.getElementById('loading').style.display = 'none';
    
    if (cookies.length === 0) {
      document.getElementById('noCookies').style.display = 'block';
    } else {
      document.getElementById('mainContent').style.display = 'block';
      displayCookieList(cookies);
    }
  } catch (error) {
    showMessage('Error loading cookies: ' + error.message, 'error');
    document.getElementById('loading').style.display = 'none';
  }
}

function displayCookieList(cookies) {
  const listContainer = document.getElementById('cookieList');
  listContainer.innerHTML = '';
  
  cookies.forEach(cookie => {
    const cookieItem = document.createElement('div');
    cookieItem.className = 'cookie-item';
    cookieItem.innerHTML = `
      <div class="cookie-name">${cookie.name}</div>
    `;
    
    cookieItem.addEventListener('click', () => {
      document.querySelectorAll('.cookie-item').forEach(item => {
        item.classList.remove('active');
      });
      
      cookieItem.classList.add('active');
      
      editCookie(cookie.name);
    });
    
    listContainer.appendChild(cookieItem);
  });
}

function editCookie(cookieName) {
  const cookie = currentCookies.find(c => c.name === cookieName);
  if (!cookie) return;
  
  selectedCookie = cookie;
  
  document.getElementById('cookieName').value = cookie.name;
  document.getElementById('storeId').value = cookie.storeId || '';
  document.getElementById('partitionKey').value = cookie.partitionKey || '';
  document.getElementById('cookieValue').value = cookie.value;
  
  document.getElementById('cookieEditor').style.display = 'block';
  document.getElementById('cookieValue').focus();
}

async function updateCookie() {
  if (!selectedCookie) return;
  
  try {
    const newValue = document.getElementById('cookieValue').value;
    
    if (newValue.includes('\n') || newValue.includes('\r')) {
      throw new Error('Cookie value cannot contain line breaks');
    }
    
    const cleanDomain = selectedCookie.domain.startsWith('.')
      ? selectedCookie.domain.substring(1)
      : selectedCookie.domain;
    
    const url = `http${selectedCookie.secure ? 's' : ''}://${cleanDomain}${selectedCookie.path}`;
    
    await chrome.cookies.remove({
      url: url,
      name: selectedCookie.name
    });
    
    const cookieDetails = {
      url: url,
      name: selectedCookie.name,
      value: newValue,
      domain: selectedCookie.domain,
      path: selectedCookie.path,
      secure: selectedCookie.secure,
      expirationDate: selectedCookie.expirationDate
    };
    
    if (selectedCookie.partitionKey) {
      cookieDetails.partitionKey = selectedCookie.partitionKey;
    }
    
    await chrome.cookies.set(cookieDetails);
    
    showMessage('Cookie updated successfully!', 'success');
    await loadCurrentSiteCookies();
  } catch (error) {
    showMessage(`Error updating cookie: ${error.message}`, 'error');
  }
}

function resetCookie() {
  if (!selectedCookie) return;
  
  document.getElementById('cookieValue').value = selectedCookie.value;
  showMessage('Cookie value reset', 'success');
}

function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.className = `message ${type}`;
  messageDiv.textContent = text;
  messageDiv.style.display = 'block';
  
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
}
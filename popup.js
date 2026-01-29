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
}

async function loadCurrentSiteCookies() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    currentDomain = url.hostname;
    
    document.getElementById('currentSite').textContent = `Cookies for: ${currentDomain}`;
    
    const cookies = await chrome.cookies.getAll({ domain: currentDomain });
    currentCookies = cookies;
    
    document.getElementById('loading').style.display = 'none';
    
    if (cookies.length === 0) {
      document.getElementById('noCookies').style.display = 'block';
    } else {
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
      <div class="cookie-details">
        <div><strong>Domain:</strong> ${cookie.domain}</div>
        <div><strong>Path:</strong> ${cookie.path}</div>
        <div><strong>Secure:</strong> ${cookie.secure ? 'Yes' : 'No'}</div>
        <div><strong>HttpOnly:</strong> ${cookie.httpOnly ? 'Yes' : 'No'}</div>
      </div>
      <div class="cookie-actions">
        <button class="btn btn-primary btn-edit" data-cookie-name="${cookie.name}">Edit</button>
        <button class="btn btn-danger btn-delete" data-cookie-name="${cookie.name}">Delete</button>
      </div>
    `;
    
    listContainer.appendChild(cookieItem);
  });
  
  // Add event listeners for edit and delete buttons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cookieName = e.target.dataset.cookieName;
      editCookie(cookieName);
    });
  });
  
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const cookieName = e.target.dataset.cookieName;
      deleteCookie(cookieName);
    });
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
    
    await chrome.cookies.set({
      url: `http${selectedCookie.secure ? 's' : ''}://${selectedCookie.domain}${selectedCookie.path}`,
      name: selectedCookie.name,
      value: newValue,
      domain: selectedCookie.domain,
      path: selectedCookie.path,
      secure: selectedCookie.secure,
      httpOnly: selectedCookie.httpOnly,
      expirationDate: selectedCookie.expirationDate
    });
    
    showMessage('Cookie updated successfully!', 'success');
    await loadCurrentSiteCookies();
    document.getElementById('cookieEditor').style.display = 'none';
  } catch (error) {
    showMessage('Error updating cookie: ' + error.message, 'error');
  }
}

function resetCookie() {
  if (!selectedCookie) return;
  
  document.getElementById('cookieValue').value = selectedCookie.value;
  showMessage('Cookie value reset', 'success');
}

async function deleteCookie(cookieName) {
  const cookie = currentCookies.find(c => c.name === cookieName);
  if (!cookie) return;
  
  try {
    await chrome.cookies.remove({
      url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
      name: cookie.name
    });
    
    showMessage('Cookie deleted successfully!', 'success');
    await loadCurrentSiteCookies();
    document.getElementById('cookieEditor').style.display = 'none';
  } catch (error) {
    showMessage('Error deleting cookie: ' + error.message, 'error');
  }
}

function showMessage(text, type) {
  const messageDiv = document.getElementById('message');
  messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
  messageDiv.textContent = text;
  messageDiv.style.display = 'block';
  
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
}
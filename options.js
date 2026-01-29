let allCookies = [];
let filteredCookies = [];
let currentEditCookie = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadAllCookies();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('refreshCookies').addEventListener('click', loadAllCookies);
  document.getElementById('clearAllCookies').addEventListener('click', clearAllCookies);
  document.getElementById('applyFilter').addEventListener('click', applyFilter);
  document.getElementById('clearFilter').addEventListener('click', clearFilter);
  document.getElementById('siteFilter').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applyFilter();
  });
  
  // Modal event listeners
  document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
  document.getElementById('saveEdit').addEventListener('click', saveEditedCookie);
  
  // Close modal when clicking outside
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') closeEditModal();
  });
}

async function loadAllCookies() {
  try {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('cookieContainer').style.display = 'none';
    document.getElementById('noCookies').style.display = 'none';
    
    const cookies = await chrome.cookies.getAll({});
    allCookies = cookies;
    filteredCookies = cookies;
    
    document.getElementById('loading').style.display = 'none';
    
    if (cookies.length === 0) {
      document.getElementById('noCookies').style.display = 'block';
    } else {
      updateCookieStats();
      displayCookies(cookies);
      document.getElementById('cookieContainer').style.display = 'block';
    }
  } catch (error) {
    showMessage('Error loading cookies: ' + error.message, 'error');
    document.getElementById('loading').style.display = 'none';
  }
}

function updateCookieStats() {
  const totalCookies = allCookies.length;
  const displayedCookies = filteredCookies.length;
  const uniqueDomains = new Set(filteredCookies.map(c => c.domain)).size;
  
  document.getElementById('cookieStats').textContent = 
    `Showing ${displayedCookies} of ${totalCookies} cookies from ${uniqueDomains} domains`;
}

function displayCookies(cookies) {
  const container = document.getElementById('cookieList');
  container.innerHTML = '';
  
  // Group cookies by domain
  const cookiesByDomain = {};
  cookies.forEach(cookie => {
    const domain = cookie.domain;
    if (!cookiesByDomain[domain]) {
      cookiesByDomain[domain] = [];
    }
    cookiesByDomain[domain].push(cookie);
  });
  
  // Sort domains alphabetically
  const sortedDomains = Object.keys(cookiesByDomain).sort();
  
  sortedDomains.forEach(domain => {
    const domainSection = document.createElement('div');
    domainSection.className = 'card';
    
    const domainHeader = document.createElement('div');
    domainHeader.className = 'card-header';
    domainHeader.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span>${domain} (${cookiesByDomain[domain].length} cookies)</span>
        <button class="btn btn-danger btn-sm" onclick="deleteDomainCookies('${domain}')">Delete All</button>
      </div>
    `;
    
    const domainContent = document.createElement('div');
    domainContent.className = 'card-content';
    
    cookiesByDomain[domain].forEach(cookie => {
      const cookieItem = document.createElement('div');
      cookieItem.className = 'cookie-item';
      cookieItem.style.marginBottom = '12px';
      
      const expiresText = cookie.expirationDate ? 
        new Date(cookie.expirationDate * 1000).toLocaleString() : 'Session';
      
      cookieItem.innerHTML = `
        <div class="cookie-name">${cookie.name}</div>
        <div class="cookie-details">
          <div><strong>Store ID:</strong> ${cookie.storeId || 'N/A'}</div>
          <div><strong>Partition Key:</strong> ${cookie.partitionKey || 'N/A'}</div>
          <div><strong>Value:</strong> ${cookie.value.length > 50 ? cookie.value.substring(0, 50) + '...' : cookie.value}</div>
          <div><strong>Expires:</strong> ${expiresText}</div>
          <div><strong>Same Site:</strong> ${cookie.sameSite || 'unspecified'}</div>
          <div><strong>Secure:</strong> ${cookie.secure ? 'Yes' : 'No'}</div>
          <div><strong>HttpOnly:</strong> ${cookie.httpOnly ? 'Yes' : 'No'}</div>
          <div><strong>Path:</strong> ${cookie.path}</div>
        </div>
        <div class="cookie-actions">
          <button class="btn btn-primary" onclick="editCookie('${cookie.name}', '${cookie.domain}', '${cookie.path}')">Update</button>
          <button class="btn btn-danger" onclick="deleteCookie('${cookie.name}', '${cookie.domain}', '${cookie.path}')">Delete</button>
        </div>
      `;
      
      domainContent.appendChild(cookieItem);
    });
    
    domainSection.appendChild(domainHeader);
    domainSection.appendChild(domainContent);
    container.appendChild(domainSection);
  });
}

function applyFilter() {
  const filterValue = document.getElementById('siteFilter').value.toLowerCase().trim();
  
  if (!filterValue) {
    filteredCookies = allCookies;
  } else {
    filteredCookies = allCookies.filter(cookie => 
      cookie.domain.toLowerCase().includes(filterValue)
    );
  }
  
  updateCookieStats();
  displayCookies(filteredCookies);
}

function clearFilter() {
  document.getElementById('siteFilter').value = '';
  filteredCookies = allCookies;
  updateCookieStats();
  displayCookies(filteredCookies);
}

function editCookie(name, domain, path) {
  const cookie = allCookies.find(c => c.name === name && c.domain === domain && c.path === path);
  if (!cookie) return;
  
  currentEditCookie = cookie;
  
  document.getElementById('editName').value = cookie.name;
  document.getElementById('editStoreId').value = cookie.storeId || '';
  document.getElementById('editPartitionKey').value = cookie.partitionKey || '';
  document.getElementById('editValue').value = cookie.value;
  document.getElementById('editSameSite').value = cookie.sameSite || 'unspecified';
  
  if (cookie.expirationDate) {
    const date = new Date(cookie.expirationDate * 1000);
    document.getElementById('editExpires').value = date.toISOString().slice(0, 16);
  } else {
    document.getElementById('editExpires').value = '';
  }
  
  document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  currentEditCookie = null;
}

async function saveEditedCookie() {
  if (!currentEditCookie) return;
  
  try {
    const newValue = document.getElementById('editValue').value;
    const newSameSite = document.getElementById('editSameSite').value;
    const expiresInput = document.getElementById('editExpires').value;
    
    let expirationDate = undefined;
    if (expiresInput) {
      expirationDate = Math.floor(new Date(expiresInput).getTime() / 1000);
    } else if (currentEditCookie.expirationDate) {
      expirationDate = currentEditCookie.expirationDate;
    }
    
    await chrome.cookies.set({
      url: `http${currentEditCookie.secure ? 's' : ''}://${currentEditCookie.domain}${currentEditCookie.path}`,
      name: currentEditCookie.name,
      value: newValue,
      domain: currentEditCookie.domain,
      path: currentEditCookie.path,
      secure: currentEditCookie.secure,
      httpOnly: currentEditCookie.httpOnly,
      sameSite: newSameSite === 'unspecified' ? undefined : newSameSite,
      expirationDate: expirationDate
    });
    
    showMessage('Cookie updated successfully!', 'success');
    closeEditModal();
    await loadAllCookies();
  } catch (error) {
    showMessage('Error updating cookie: ' + error.message, 'error');
  }
}

async function deleteCookie(name, domain, path) {
  const cookie = allCookies.find(c => c.name === name && c.domain === domain && c.path === path);
  if (!cookie) return;
  
  if (!confirm(`Delete cookie "${name}" from ${domain}?`)) return;
  
  try {
    await chrome.cookies.remove({
      url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
      name: cookie.name
    });
    
    showMessage('Cookie deleted successfully!', 'success');
    await loadAllCookies();
  } catch (error) {
    showMessage('Error deleting cookie: ' + error.message, 'error');
  }
}

async function deleteDomainCookies(domain) {
  if (!confirm(`Delete all cookies from ${domain}?`)) return;
  
  try {
    const domainCookies = allCookies.filter(c => c.domain === domain);
    
    for (const cookie of domainCookies) {
      await chrome.cookies.remove({
        url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
        name: cookie.name
      });
    }
    
    showMessage(`Deleted ${domainCookies.length} cookies from ${domain}`, 'success');
    await loadAllCookies();
  } catch (error) {
    showMessage('Error deleting cookies: ' + error.message, 'error');
  }
}

async function clearAllCookies() {
  if (!confirm('Delete ALL cookies from your browser? This action cannot be undone.')) return;
  
  try {
    for (const cookie of allCookies) {
      await chrome.cookies.remove({
        url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
        name: cookie.name
      });
    }
    
    showMessage('All cookies deleted successfully!', 'success');
    await loadAllCookies();
  } catch (error) {
    showMessage('Error clearing cookies: ' + error.message, 'error');
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
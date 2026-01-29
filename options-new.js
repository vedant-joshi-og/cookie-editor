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
  
  document.getElementById('saveEdit').addEventListener('click', saveEditedCookie);
  document.getElementById('deleteEdit').addEventListener('click', deleteCurrentCookie);
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
      showNoSelection();
    }
  } catch (error) {
    showToast('Error loading cookies: ' + error.message, 'error');
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
  
  const cookiesByDomain = {};
  cookies.forEach(cookie => {
    const domain = cookie.domain;
    if (!cookiesByDomain[domain]) {
      cookiesByDomain[domain] = [];
    }
    cookiesByDomain[domain].push(cookie);
  });
  
  const sortedDomains = Object.keys(cookiesByDomain).sort();
  
  sortedDomains.forEach(domain => {
    const domainSection = document.createElement('div');
    domainSection.className = 'domain-section';
    
    const domainHeader = document.createElement('div');
    domainHeader.className = 'domain-header collapsed';
    domainHeader.innerHTML = `
      <span>${domain} (${cookiesByDomain[domain].length})</span>
      <div>
        <span class="collapse-icon">▼</span>
        <button class="btn btn-danger delete-domain-btn" data-domain="${domain}" style="margin-left: 12px;">Delete All</button>
      </div>
    `;
    
    const domainContent = document.createElement('div');
    domainContent.className = 'domain-content collapsed';
    
    cookiesByDomain[domain].forEach(cookie => {
      const cookieItem = document.createElement('div');
      cookieItem.className = 'cookie-item';
      
      const expiresText = cookie.expirationDate ? 
        new Date(cookie.expirationDate * 1000).toLocaleDateString() : 'Session';
      
      cookieItem.innerHTML = `
        <div class="cookie-name">${cookie.name}</div>
        <div class="cookie-details">
          <div><strong>Path:</strong> ${cookie.path}</div>
          <div><strong>Expires:</strong> ${expiresText}</div>
          <div><strong>Secure:</strong> ${cookie.secure ? 'Yes' : 'No'}</div>
          <div><strong>SameSite:</strong> ${cookie.sameSite || 'None'}</div>
        </div>
      `;
      
      cookieItem.addEventListener('click', () => {
        document.querySelectorAll('.cookie-item').forEach(item => {
          item.classList.remove('active');
        });
        cookieItem.classList.add('active');
        editCookie(cookie);
      });
      
      domainContent.appendChild(cookieItem);
    });
    
    domainHeader.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-domain-btn')) {
        const domain = e.target.dataset.domain;
        deleteDomainCookies(domain);
        return;
      }
      if (e.target.tagName === 'BUTTON') return;
      
      domainHeader.classList.toggle('collapsed');
      domainContent.classList.toggle('collapsed');
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
  showNoSelection();
}

function clearFilter() {
  document.getElementById('siteFilter').value = '';
  filteredCookies = allCookies;
  updateCookieStats();
  displayCookies(filteredCookies);
  showNoSelection();
}

function editCookie(cookie) {
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
  
  document.getElementById('cookieEditor').style.display = 'block';
  document.getElementById('noSelection').style.display = 'none';
}

function showNoSelection() {
  document.getElementById('cookieEditor').style.display = 'none';
  document.getElementById('noSelection').style.display = 'flex';
  currentEditCookie = null;
}

async function saveEditedCookie() {
  if (!currentEditCookie) return;
  
  try {
    const newValue = document.getElementById('editValue').value;
    const newSameSite = document.getElementById('editSameSite').value;
    const expiresInput = document.getElementById('editExpires').value;
    
    if (newValue.includes('\n') || newValue.includes('\r')) {
      throw new Error('Cookie value cannot contain line breaks');
    }
    
    if (newSameSite === 'no_restriction' && !currentEditCookie.secure) {
      throw new Error('SameSite=None requires Secure=true');
    }
    
    let expirationDate = undefined;
    if (expiresInput) {
      expirationDate = Math.floor(new Date(expiresInput).getTime() / 1000);
    } else if (currentEditCookie.expirationDate) {
      expirationDate = currentEditCookie.expirationDate;
    }
    
    const cleanDomain = currentEditCookie.domain.startsWith('.')
      ? currentEditCookie.domain.substring(1)
      : currentEditCookie.domain;
    
    const url = `http${currentEditCookie.secure ? 's' : ''}://${cleanDomain}${currentEditCookie.path}`;
    
    await chrome.cookies.remove({
      url: url,
      name: currentEditCookie.name
    });
    
    const cookieDetails = {
      url: url,
      name: currentEditCookie.name,
      value: newValue,
      domain: currentEditCookie.domain,
      path: currentEditCookie.path,
      secure: currentEditCookie.secure,
      sameSite: newSameSite === 'unspecified' ? undefined : newSameSite,
      expirationDate: expirationDate
    };
    
    if (currentEditCookie.partitionKey) {
      cookieDetails.partitionKey = currentEditCookie.partitionKey;
    }
    
    await chrome.cookies.set(cookieDetails);
    
    showToast('Cookie updated successfully!', 'success');
    await loadAllCookies();
  } catch (error) {
    showToast(`Error updating cookie: ${error.message}`, 'error');
  }
}

async function deleteCurrentCookie() {
  if (!currentEditCookie) return;
  
  if (!confirm(`Delete cookie "${currentEditCookie.name}" from ${currentEditCookie.domain}?`)) return;
  
  try {
    const cleanDomain = currentEditCookie.domain.startsWith('.')
      ? currentEditCookie.domain.substring(1)
      : currentEditCookie.domain;
    
    await chrome.cookies.remove({
      url: `http${currentEditCookie.secure ? 's' : ''}://${cleanDomain}${currentEditCookie.path}`,
      name: currentEditCookie.name
    });
    
    showToast('Cookie deleted successfully!', 'success');
    await loadAllCookies();
  } catch (error) {
    showToast(`Error deleting cookie: ${error.message}`, 'error');
  }
}

async function deleteDomainCookies(domain) {
  if (!confirm(`Delete all cookies from ${domain}?`)) return;
  
  try {
    const domainCookies = allCookies.filter(c => c.domain === domain);
    
    for (const cookie of domainCookies) {
      const cleanDomain = cookie.domain.startsWith('.')
        ? cookie.domain.substring(1)
        : cookie.domain;
      
      await chrome.cookies.remove({
        url: `http${cookie.secure ? 's' : ''}://${cleanDomain}${cookie.path}`,
        name: cookie.name
      });
    }
    
    showToast(`Deleted ${domainCookies.length} cookies from ${domain}`, 'success');
    await loadAllCookies();
  } catch (error) {
    showToast(`Error deleting cookies: ${error.message}`, 'error');
  }
}

async function clearAllCookies() {
  if (!confirm('Delete ALL cookies from your browser? This action cannot be undone.')) return;
  
  try {
    for (const cookie of allCookies) {
      const cleanDomain = cookie.domain.startsWith('.')
        ? cookie.domain.substring(1)
        : cookie.domain;
      
      await chrome.cookies.remove({
        url: `http${cookie.secure ? 's' : ''}://${cleanDomain}${cookie.path}`,
        name: cookie.name
      });
    }
    
    showToast('All cookies deleted successfully!', 'success');
    await loadAllCookies();
  } catch (error) {
    showToast(`Error clearing cookies: ${error.message}`, 'error');
  }
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

function showToast(text, type) {
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = text;
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 100);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
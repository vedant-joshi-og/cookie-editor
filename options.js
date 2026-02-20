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
  document.getElementById('siteFilter').addEventListener('input', applyFilter);
  
  // Filter toggles
  document.getElementById('filterSecure').addEventListener('change', applyFilter);
  document.getElementById('filterHttpOnly').addEventListener('change', applyFilter);
  document.getElementById('filterSession').addEventListener('change', applyFilter);
  document.getElementById('filterExpired').addEventListener('change', applyFilter);
  
  // Import/Export
  document.getElementById('exportJSON').addEventListener('click', exportToJSON);
  document.getElementById('exportNetscape').addEventListener('click', exportToNetscape);
  document.getElementById('importCookies').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', importCookies);
  
  document.getElementById('saveEdit').addEventListener('click', saveEditedCookie);
  document.getElementById('deleteEdit').addEventListener('click', deleteCurrentCookie);
}

async function loadGitHubStars() {
  try {
    const response = await fetch(
      "https://api.github.com/repos/vedant-joshi-og/cookie-editor"
    );
    
    const data = await response.json();
    
    document.getElementById("githubStars").textContent =
      data.stargazers_count.toLocaleString();
      
  } catch (error) {
    document.getElementById("githubStars").textContent = "—";
  }
}

loadGitHubStars();

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
  const filterSecure = document.getElementById('filterSecure').checked;
  const filterHttpOnly = document.getElementById('filterHttpOnly').checked;
  const filterSession = document.getElementById('filterSession').checked;
  const filterExpired = document.getElementById('filterExpired').checked;
  
  filteredCookies = allCookies.filter(cookie => {
    // Text search (name, domain, or value)
    const matchesText = !filterValue || 
      cookie.name.toLowerCase().includes(filterValue) ||
      cookie.domain.toLowerCase().includes(filterValue) ||
      cookie.value.toLowerCase().includes(filterValue);
    
    // Secure filter
    const matchesSecure = !filterSecure || cookie.secure;
    
    // HttpOnly filter
    const matchesHttpOnly = !filterHttpOnly || cookie.httpOnly;
    
    // Session filter (no expiration date)
    const matchesSession = !filterSession || !cookie.expirationDate;
    
    // Expired filter
    const matchesExpired = !filterExpired || 
      (cookie.expirationDate && cookie.expirationDate * 1000 < Date.now());
    
    return matchesText && matchesSecure && matchesHttpOnly && matchesSession && matchesExpired;
  });
  
  updateCookieStats();
  displayCookies(filteredCookies);
  showNoSelection();
}

function clearFilter() {
  document.getElementById('siteFilter').value = '';
  document.getElementById('filterSecure').checked = false;
  document.getElementById('filterHttpOnly').checked = false;
  document.getElementById('filterSession').checked = false;
  document.getElementById('filterExpired').checked = false;
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

// Export to JSON
function exportToJSON() {
  const data = JSON.stringify(filteredCookies, null, 2);
  downloadFile(data, 'cookies.json', 'application/json');
  showToast(`Exported ${filteredCookies.length} cookies to JSON`, 'success');
}

// Export to Netscape format
function exportToNetscape() {
  let netscapeFormat = '# Netscape HTTP Cookie File\n';
  netscapeFormat += '# This is a generated file! Do not edit.\n\n';
  
  filteredCookies.forEach(cookie => {
    const domain = cookie.domain;
    const flag = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = cookie.path;
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiration = cookie.expirationDate || '0';
    const name = cookie.name;
    const value = cookie.value;
    
    netscapeFormat += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
  });
  
  downloadFile(netscapeFormat, 'cookies.txt', 'text/plain');
  showToast(`Exported ${filteredCookies.length} cookies to Netscape format`, 'success');
}

// Import cookies
async function importCookies(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    let cookies = [];
    
    if (file.name.endsWith('.json')) {
      cookies = JSON.parse(text);
      if (!Array.isArray(cookies)) {
        throw new Error('Invalid JSON format: expected an array of cookies');
      }
    } else {
      cookies = parseNetscapeFormat(text);
    }
    
    // Validate and import cookies
    let imported = 0;
    let failed = 0;
    
    for (const cookie of cookies) {
      try {
        if (!cookie.name || !cookie.domain) {
          throw new Error('Missing required fields: name or domain');
        }
        
        const cleanDomain = cookie.domain.startsWith('.')
          ? cookie.domain.substring(1)
          : cookie.domain;
        
        const cookieDetails = {
          url: `http${cookie.secure ? 's' : ''}://${cleanDomain}${cookie.path || '/'}`,
          name: cookie.name,
          value: cookie.value || '',
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure || false,
          expirationDate: cookie.expirationDate
        };
        
        if (cookie.sameSite) {
          cookieDetails.sameSite = cookie.sameSite;
        }
        
        if (cookie.partitionKey) {
          cookieDetails.partitionKey = cookie.partitionKey;
        }
        
        await chrome.cookies.set(cookieDetails);
        imported++;
      } catch (err) {
        failed++;
        console.error(`Failed to import cookie ${cookie.name}:`, err);
      }
    }
    
    showToast(`Imported ${imported} cookies${failed > 0 ? `, ${failed} failed` : ''}`, 'success');
    await loadAllCookies();
  } catch (error) {
    showToast(`Import failed: ${error.message}`, 'error');
  }
  
  event.target.value = '';
}

// Parse Netscape format
function parseNetscapeFormat(text) {
  const cookies = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) continue;
    
    const parts = line.split('\t');
    if (parts.length < 7) continue;
    
    cookies.push({
      domain: parts[0],
      path: parts[2],
      secure: parts[3] === 'TRUE',
      expirationDate: parts[4] === '0' ? undefined : parseInt(parts[4]),
      name: parts[5],
      value: parts[6]
    });
  }
  
  return cookies;
}

// Download helper
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
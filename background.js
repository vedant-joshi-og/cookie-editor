// Background service worker for Cookie Editor extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Cookie Editor extension installed');
});

// Handle cookie changes and updates
chrome.cookies.onChanged.addListener((changeInfo) => {
  // Log cookie changes for debugging
  console.log('Cookie changed:', changeInfo);
});

// Context menu for quick access (optional)
chrome.contextMenus.create({
  id: 'openCookieEditor',
  title: 'Open Cookie Editor',
  contexts: ['page']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openCookieEditor') {
    chrome.runtime.openOptionsPage();
  }
});
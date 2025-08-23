// Global variables
let currentPage = 'dashboard';
let localDbIds = [];
let userMetadata = {};
let ageVerified = false;
let isInitialized = false;

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
  // Show dashboard immediately on startup
  navigateToPage('dashboard');
  setupNavigation();
  setupEventListeners();
  initializePopup();
});

// Initialize popup functionality
function initializePopup() {
  // Always load initial data first
  loadInitialData().then(() => {
    // Then check if gradio app is found and user is verified
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'gradio?' }, function (response) {
        if (chrome.runtime.lastError) {
          console.log("Error communicating with content script");
        }

        if (response && response.gradio) {
          checkUserVerification();
        } else {
          showUnsupportedSite();
        }
      });
    });
  });
}

// Load initial data before showing any interface
async function loadInitialData() {
  try {
    const [ageVerifiedData, userMetadataData, localDbIdsData] = await Promise.all([
      getFromStorage("age_verified"),
      getFromStorage("user_metadata"),
      getFromStorage("local_db_ids")
    ]);

    ageVerified = ageVerifiedData || false;
    userMetadata = userMetadataData || {};
    localDbIds = localDbIdsData || [];

    isInitialized = true;
  } catch (error) {
    console.error("Error loading initial data:", error);
  }
}

// Setup navigation functionality
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  console.log('Setting up navigation, found buttons:', navButtons.length);

  if (navButtons.length === 0) {
    console.error('No navigation buttons found!');
    return;
  }

  navButtons.forEach(button => {
    const targetPage = button.dataset.page;
    console.log('Button data-page:', targetPage);

    if (!targetPage) {
      console.error('Button missing data-page attribute:', button);
      return;
    }

    // Add click event listener directly to the button
    button.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Navigation clicked:', targetPage);
      navigateToPage(targetPage);
    });
  });
}

// Navigate to specific page
function navigateToPage(page) {
  console.log('Navigating to page:', page);

  // Update navigation buttons
  const navButtons = document.querySelectorAll('.nav-btn');
  console.log('Found nav buttons:', navButtons.length);

  navButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.page === page) {
      btn.classList.add('active');
      console.log('Set active nav button:', page);
    }
  });

  // Show/hide pages with better error handling
  const pageSections = document.querySelectorAll('.page-section');
  console.log('Found page sections:', pageSections.length);

  let targetPageFound = false;
  pageSections.forEach(section => {
    section.classList.remove('active');
    if (section.id === `${page}-page`) {
      section.classList.add('active');
      console.log('Set active page:', page);
      targetPageFound = true;
    }
  });

  if (!targetPageFound) {
    console.error('Could not find page section for:', page);
    // Fallback: show dashboard if target page not found
    const dashboardPage = document.getElementById('dashboard-page');
    if (dashboardPage) {
      dashboardPage.classList.add('active');
      console.log('Falling back to dashboard');
    }
  }

  currentPage = page;

  // Load page-specific content with error handling
  try {
    switch (page) {
      case 'dashboard':
        loadDashboardData();
        break;
      case 'conversations':
        loadConversations();
        break;
      case 'settings':
        loadSettingsData();
        break;
      case 'help':
        // Help page is static - no additional loading needed
        console.log('Help page loaded');
        break;
      default:
        console.warn('Unknown page:', page);
    }
  } catch (error) {
    console.error('Error loading page content:', error);
  }
}

// Check user verification status
function checkUserVerification() {
  if (!ageVerified) {
    showVerificationPrompt();
  } else {
    // Dashboard is already visible, just load the data
    loadDashboardData();
  }
}

// Show verification prompt
function showVerificationPrompt() {
  document.getElementById('conditions').classList.remove('hidden');
  // Don't hide main interface - keep dashboard visible
}

// Show unsupported site message
function showUnsupportedSite() {
  document.getElementById('unsupported-message').classList.remove('hidden');
  // Don't hide main interface - keep dashboard visible
}

// Show main interface
function showMainInterface() {
  // Ensure the dashboard is visible and loaded
  document.getElementById('dashboard-page').classList.add('active');
  // Load dashboard data immediately when showing main interface
  loadDashboardData();
}

// Hide main interface
function hideMainInterface() {
  document.querySelectorAll('.page-section').forEach(section => {
    if (!section.id.includes('conditions') && !section.id.includes('unsupported')) {
      section.classList.remove('active');
    }
  });
}

// Get site name from URL
function getSiteName() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        const hostname = url.hostname;

        if (hostname.includes('huggingface.co')) {
          resolve('HuggingFace');
        } else if (hostname.includes('openai.com')) {
          resolve('OpenAI');
        } else if (hostname.includes('claude.ai')) {
          resolve('Claude');
        } else if (hostname.includes('gemini.google.com')) {
          resolve('Gemini');
        } else if (hostname.includes('grok.com')) {
          resolve('Grok');
        } else if (hostname.includes('mistral.ai')) {
          resolve('Mistral');
        } else if (hostname.includes('poe.com')) {
          resolve('Poe');
        } else if (hostname.includes('perplexity.ai')) {
          resolve('Perplexity');
        } else {
          resolve('Unknown');
        }
      } else {
        resolve('Unknown');
      }
    });
  });
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Get all data in parallel
    const [messagesCounter, shouldShareData, siteName] = await Promise.all([
      getFromStorage("messages_counter_from_storage"),
      getFromStorage("shouldShare"),
      getSiteName()
    ]);

    // Update conversations/messages shared counter
    const conversationsShared = messagesCounter || 0;
    document.getElementById('conversations-shared').textContent = conversationsShared;

    // Update pending conversations count
    const pendingCount = localDbIds.length;
    document.getElementById('pending-conversations').textContent = pendingCount;

    // Update current site
    document.getElementById('current-site').textContent = siteName;

    // Update user status
    const userStatus = ageVerified ? 'Verified' : 'Unverified';
    document.getElementById('user-status').textContent = userStatus;

    // Update sharing status
    const shouldShare = shouldShareData ? shouldShareData.shouldShare : true;
    const statusIndicator = document.getElementById('sharing-status');
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    if (shouldShare && ageVerified) {
      statusIndicator.classList.remove('inactive');
      statusText.textContent = 'Sharing Active';
    } else {
      statusIndicator.classList.add('inactive');
      statusText.textContent = shouldShare ? 'Sharing Disabled (Unverified)' : 'Sharing Disabled';
    }

    // Update progress card
    updateProgressCard(pendingCount);

  } catch (error) {
    console.error("Error loading dashboard data:", error);
    // Set default values in case of error
    document.getElementById('conversations-shared').textContent = '0';
    document.getElementById('pending-conversations').textContent = '0';
    document.getElementById('current-site').textContent = 'Unknown';
    document.getElementById('user-status').textContent = 'Error';
  }
}

// Update progress card based on pending conversations
function updateProgressCard(pendingCount) {
  const progressCard = document.getElementById('progress-card');
  const progressText = document.getElementById('progress-text');
  const progressPercentage = document.getElementById('progress-percentage');
  const progressFill = document.getElementById('progress-fill');

  if (pendingCount > 0) {
    progressCard.style.display = 'block';
    progressText.textContent = `${pendingCount} conversation${pendingCount !== 1 ? 's' : ''} ready to share`;

    // Calculate progress percentage (assuming 10 conversations is 100%)
    const maxConversations = 10;
    const percentage = Math.min(100, (pendingCount / maxConversations) * 100);
    progressPercentage.textContent = `${Math.round(percentage)}%`;
    progressFill.style.width = `${percentage}%`;
  } else {
    progressCard.style.display = 'none';
  }
}

// Load conversations for the conversations page
function loadConversations() {
  const conversationsList = document.getElementById('conversations-list');
  const totalConversationsSpan = document.getElementById('total-conversations');

  // Show loading state
  conversationsList.innerHTML = '<div class="loading-state">Loading conversations...</div>';

  getFromStorage("local_db_ids").then(ids => {
    localDbIds = ids || [];
    totalConversationsSpan.textContent = localDbIds.length;

    if (localDbIds.length === 0) {
      conversationsList.innerHTML = `
        <div class="card">
          <p class="text-center">No conversations found. Start chatting to see your conversations here!</p>
        </div>
      `;
      return;
    }

    // Clear loading state
    conversationsList.innerHTML = '';

    // Load conversations with better error handling
    const conversationPromises = localDbIds.map((conversationId) =>
      getFromStorage(conversationId).then(conversation => ({
        id: conversationId,
        data: conversation
      }))
    );

    Promise.allSettled(conversationPromises).then(results => {
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.data) {
          createConversationItem(result.value.id, result.value.data, conversationsList);
        }
      });

      // If no conversations were loaded successfully
      if (conversationsList.children.length === 0) {
        conversationsList.innerHTML = `
          <div class="card">
            <p class="text-center">No valid conversations found.</p>
          </div>
        `;
      }
    });
  });
}

// Create conversation item element with improved styling
function createConversationItem(conversationId, conversation, container) {
  const conversationDiv = document.createElement('div');
  conversationDiv.className = 'conversation-item';
  conversationDiv.dataset.conversationId = conversationId;

  // Create preview text
  let preview = 'No content available';
  if (conversation.user_msgs && conversation.user_msgs.length > 0) {
    preview = conversation.user_msgs[0].substring(0, 120) + '...';
  }

  // Get date
  let dateString = 'Unknown date';
  if (conversation.timestamp) {
    try {
      const date = new Date(conversation.timestamp);
      dateString = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      dateString = 'Invalid date';
    }
  }

  // Get message counts
  const userMsgCount = conversation.user_msgs ? conversation.user_msgs.length : 0;
  const botMsgCount = conversation.bot_msgs ? conversation.bot_msgs.length : 0;

  conversationDiv.innerHTML = `
    <div class="conversation-header">
      <div class="conversation-title">Conversation ${conversationId.substring(0, 8)}</div>
      <div class="conversation-date">${dateString}</div>
    </div>
    <div class="conversation-preview">${preview}</div>
    <div class="conversation-footer">
      <div class="conversation-badges">
        <span class="badge pending">Pending</span>
        <span class="badge">${userMsgCount} messages</span>
        <span class="badge">${botMsgCount} responses</span>
      </div>
      <div class="conversation-actions">
        <button class="view-btn" onclick="viewConversation('${conversationId}')">👁️ View</button>
        <button class="remove-btn" onclick="removeConversation('${conversationId}')">❌ Remove</button>
      </div>
    </div>
  `;

  container.appendChild(conversationDiv);
}

// View conversation details with improved formatting
function viewConversation(conversationId) {
  getFromStorage(conversationId).then(conversation => {
    if (conversation) {
      let fullText = `Conversation ID: ${conversationId}\n`;
      fullText += `Timestamp: ${conversation.timestamp}\n`;
      fullText += `URL: ${conversation.page_url || 'Unknown'}\n\n`;

      const maxMessages = Math.max(
        conversation.user_msgs ? conversation.user_msgs.length : 0,
        conversation.bot_msgs ? conversation.bot_msgs.length : 0
      );

      for (let i = 0; i < maxMessages; i++) {
        if (conversation.user_msgs && conversation.user_msgs[i]) {
          fullText += `👤 User: ${conversation.user_msgs[i]}\n\n`;
        }
        if (conversation.bot_msgs && conversation.bot_msgs[i]) {
          fullText += `🤖 AI: ${conversation.bot_msgs[i]}\n\n`;
        }
      }

      // Create a modal-like display instead of alert
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        max-width: 90%;
        max-height: 80%;
        overflow-y: auto;
        padding: 20px;
        border-radius: 8px;
        white-space: pre-wrap;
        font-family: monospace;
        font-size: 12px;
      `;
      content.textContent = fullText;

      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #ff6b35;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
      `;
      closeBtn.onclick = () => document.body.removeChild(modal);

      content.appendChild(closeBtn);
      modal.appendChild(content);
      document.body.appendChild(modal);
    }
  });
}
// Remove conversation with better error handling
function removeConversation(conversationId) {
  if (confirm('Are you sure you want to remove this conversation?')) {
    chrome.storage.local.remove([conversationId], () => {
      if (chrome.runtime.lastError) {
        showToast('Error removing conversation', 'error');
        console.error(chrome.runtime.lastError);
      } else {
        // Remove from local array
        localDbIds = localDbIds.filter(id => id !== conversationId);
        saveToStorage('local_db_ids', localDbIds);

        // Remove the conversation element from UI
        const conversationElement = document.querySelector(
          `[data-conversation-id="${conversationId}"]`
        );
        if (conversationElement) {
          conversationElement.remove();
        }

        // Update conversation count
        document.getElementById('total-conversations').textContent = localDbIds.length;

        // Update dashboard if currently viewing it
        if (currentPage === 'dashboard') {
          loadDashboardData();
        }

        // If no conversations left, show empty state
        if (localDbIds.length === 0) {
          const conversationsList = document.getElementById('conversations-list');
          conversationsList.innerHTML = `
            <div class="card">
              <p class="text-center">No conversations found. Start chatting to see one here.</p>
            </div>
          `;
        }
      }
    });
  }
}

// ✅ Put loadSettingsData OUTSIDE the above function
function loadSettingsData() {
  getFromStorage("user_metadata").then(metadata => {
    userMetadata = metadata || {};

    const ageInput = document.getElementById("user-age");
    const locationInput = document.getElementById("user-location");
    const genderSelect = document.getElementById("user-gender");
    const customGenderWrapper = document.getElementById("custom-gender-wrapper");
    const customGenderInput = document.getElementById("custom-gender");

    if (ageInput) ageInput.value = userMetadata.age || "";
    if (locationInput) locationInput.value = userMetadata.location || "";
    if (genderSelect) genderSelect.value = userMetadata.gender || "";

    if (genderSelect && userMetadata.gender === "Specify your own") {
      if (customGenderWrapper) customGenderWrapper.classList.remove("hidden");
      if (customGenderInput) customGenderInput.value = userMetadata.customGender || "";
    } else {
      if (customGenderWrapper) customGenderWrapper.classList.add("hidden");
    }
  });

  const form = document.getElementById("user-info-form");
  if (form && !form.dataset.listenerAttached) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const age = document.getElementById("user-age")?.value || "";
      const location = document.getElementById("user-location")?.value || "";
      const gender = document.getElementById("user-gender")?.value || "";
      const customGender = document.getElementById("custom-gender")?.value || "";

      userMetadata = { age, location, gender };
      if (gender === "Specify your own") {
        userMetadata.customGender = customGender;
      }

      saveToStorage("user_metadata", userMetadata);
      showToast("User information saved", "success");
    });
    form.dataset.listenerAttached = "true";
  }
}

// Setup event listeners for buttons and interactions
function setupEventListeners() {
  // Terms of use button
  const termsButton = document.getElementById('terms-of-use-button');
  if (termsButton) {
    termsButton.addEventListener('click', () => {
      ageVerified = true;
      saveToStorage('age_verified', true);
      document.getElementById('conditions').classList.add('hidden');
      showMainInterface();
      showToast('Age verification completed', 'success');
    });
  }

  // Quick action buttons
  const publishQuickBtn = document.getElementById('publish-quick-btn');
  const downloadQuickBtn = document.getElementById('download-quick-btn');
  const clearDataBtn = document.getElementById('clear-data-btn');
  const copyUserIdBtn = document.getElementById('copy-user-id-btn');

  if (publishQuickBtn) {
    publishQuickBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'publish' });
      showToast('Publishing pending conversations', 'success');
    });
  }

  if (downloadQuickBtn) {
    downloadQuickBtn.addEventListener('click', () => {
      showToast('Download feature coming soon', 'info');
    });
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all local data?')) {
        chrome.storage.local.clear(() => {
          localDbIds = [];
          ageVerified = false;
          userMetadata = {};
          showToast('All data cleared', 'success');
          loadDashboardData();
        });
      }
    });
  }

  if (copyUserIdBtn) {
    copyUserIdBtn.addEventListener('click', () => {
      getFromStorage('user_id').then(userId => {
        if (userId) {
          navigator.clipboard.writeText(userId);
          showToast('User ID copied to clipboard', 'success');
        } else {
          showToast('No user ID found', 'error');
        }
      });
    });
  }

  // Conversation page buttons
  const downloadCsvBtn = document.getElementById('download-csv-btn');
  const publishAllBtn = document.getElementById('publish-all-btn');

  if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', () => {
      showToast('CSV download feature coming soon', 'info');
    });
  }

  if (publishAllBtn) {
    publishAllBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'publish' });
      showToast('Publishing all conversations', 'success');
    });
  }

  // Settings page buttons
  const exportDataBtn = document.getElementById('export-data-btn');
  const clearLocalBtn = document.getElementById('clear-local-btn');

  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', () => {
      showToast('Export feature coming soon', 'info');
    });
  }

  if (clearLocalBtn) {
    clearLocalBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear local storage?')) {
        chrome.storage.local.clear(() => {
          showToast('Local storage cleared', 'success');
        });
      }
    });
  }

  // FAQ toggle functionality
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const answer = question.nextElementSibling;
      question.classList.toggle('active');
      answer.classList.toggle('hidden');
    });
  });

  // Gender selection change handler
  const genderSelect = document.getElementById('user-gender');
  const customGenderWrapper = document.getElementById('custom-gender-wrapper');

  if (genderSelect && customGenderWrapper) {
    genderSelect.addEventListener('change', () => {
      if (genderSelect.value === 'Specify your own') {
        customGenderWrapper.classList.remove('hidden');
      } else {
        customGenderWrapper.classList.add('hidden');
      }
    });
  }
}

// Show toast notification
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Storage utility functions
function saveToStorage(field, value) {
  const dataToSave = {};
  dataToSave[field] = value;

  chrome.storage.local.set(dataToSave, function () {
    if (chrome.runtime.lastError) {
      console.error('Error saving to storage:', chrome.runtime.lastError);
    }
  });
}

function getFromStorage(field) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([field], function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[field] || null);
      }
    });
  });
}

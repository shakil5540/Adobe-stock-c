// Backend API Client with automatic failover
class BackendClient {
    constructor() {
        this.primaryBackend = window.CONFIG.PRIMARY_BACKEND;
        this.backupBackend = window.CONFIG.BACKUP_BACKEND;
        this.currentBackend = this.primaryBackend;
        this.updateStatus('connecting');
    }

    updateStatus(status) {
        const statusEl = document.getElementById('backendStatus');
        const statusDot = statusEl.querySelector('.status-dot');
        const statusText = statusEl.querySelector('.status-text');

        if (status === 'connected') {
            statusDot.style.background = '#10b981';
            statusText.textContent = 'Connected';
        } else if (status === 'connecting') {
            statusDot.style.background = '#f59e0b';
            statusText.textContent = 'Connecting...';
        } else {
            statusDot.style.background = '#ef4444';
            statusText.textContent = 'Disconnected';
        }
    }

    async makeRequest(endpoint, options = {}) {
        const backends = [this.currentBackend, this.currentBackend === this.primaryBackend ? this.backupBackend : this.primaryBackend];

        for (const backend of backends) {
            try {
                console.log(`🔗 Requesting: ${backend}${endpoint}`);
                const response = await fetch(`${backend}${endpoint}`, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                if (this.currentBackend !== backend) {
                    console.log(`✅ Switched to: ${backend}`);
                    this.currentBackend = backend;
                }

                this.updateStatus('connected');
                return data;
            } catch (error) {
                console.error(`❌ Failed: ${backend} - ${error.message}`);
                if (backend === backends[backends.length - 1]) {
                    this.updateStatus('error');
                    throw error;
                }
            }
        }
    }

    async search(query, options = {}) {
        const { limit = 20, offset = 0, contentType = 'any', order = 'relevance' } = options;
        const params = new URLSearchParams({
            q: query,
            limit: limit.toString(),
            offset: offset.toString(),
            order,
            contentType
        });

        return await this.makeRequest(`/api/search?${params}`);
    }

    async healthCheck() {
        try {
            return await this.makeRequest('/api/health');
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

// Application State
const state = {
    currentQuery: '',
    currentPage: 1,
    resultsPerPage: 20,
    totalResults: 0,
    contentType: 'any',
    sortOrder: 'relevance'
};

// Initialize
const apiClient = new BackendClient();

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const contentTypeSelect = document.getElementById('contentType');
const sortOrderSelect = document.getElementById('sortOrder');
const loadingState = document.getElementById('loadingState');
const resultsSection = document.getElementById('resultsSection');
const resultsGrid = document.getElementById('resultsGrid');
const resultsTitle = document.getElementById('resultsTitle');
const resultsCount = document.getElementById('resultsCount');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const pagination = document.getElementById('pagination');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfo = document.getElementById('pageInfo');
const retryBtn = document.getElementById('retryBtn');

// Event Listeners
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});
contentTypeSelect.addEventListener('change', () => {
    state.contentType = contentTypeSelect.value;
    if (state.currentQuery) performSearch();
});
sortOrderSelect.addEventListener('change', () => {
    state.sortOrder = sortOrderSelect.value;
    if (state.currentQuery) performSearch();
});
prevBtn.addEventListener('click', () => changePage(-1));
nextBtn.addEventListener('click', () => changePage(1));
retryBtn.addEventListener('click', performSearch);

// Functions
async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        searchInput.focus();
        return;
    }

    state.currentQuery = query;
    state.currentPage = 1;

    showLoading();

    try {
        const offset = (state.currentPage - 1) * state.resultsPerPage;
        const results = await apiClient.search(query, {
            limit: state.resultsPerPage,
            offset,
            contentType: state.contentType,
            order: state.sortOrder
        });

        displayResults(results);
    } catch (error) {
        showError(error.message);
    }
}

function displayResults(data) {
    hideAllStates();
    resultsSection.style.display = 'block';

    const results = data.results || [];
    state.totalResults = data.total || results.length;

    resultsTitle.textContent = `Results for "${state.currentQuery}"`;
    resultsCount.textContent = `Found ${state.totalResults.toLocaleString()} images`;

    if (results.length === 0) {
        resultsGrid.innerHTML = '<p class="no-results">No results found. Try a different search term.</p>';
        pagination.style.display = 'none';
        return;
    }

    resultsGrid.innerHTML = results.map(item => `
        <div class="result-card">
            <div class="result-image">
                <img src="${item.thumbnail || item.thumbnail_url || 'https://via.placeholder.com/400x300?text=Image'}" 
                     alt="${item.title || 'Image'}"
                     loading="lazy">
                <div class="result-overlay">
                    <button class="view-btn" onclick="window.open('https://stock.adobe.com/${item.id}', '_blank')">
                        View Details
                    </button>
                </div>
            </div>
            <div class="result-info">
                <h4 class="result-title">${item.title || 'Untitled'}</h4>
                <p class="result-creator">by ${item.creator_name || 'Unknown'}</p>
                ${item.nb_downloads ? `<span class="result-downloads">↓ ${item.nb_downloads.toLocaleString()}</span>` : ''}
            </div>
        </div>
    `).join('');

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(state.totalResults / state.resultsPerPage);

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    prevBtn.disabled = state.currentPage === 1;
    nextBtn.disabled = state.currentPage >= totalPages;
}

async function changePage(direction) {
    state.currentPage += direction;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await performSearch();
}

function showLoading() {
    hideAllStates();
    loadingState.style.display = 'flex';
}

function showError(message) {
    hideAllStates();
    errorState.style.display = 'flex';
    errorMessage.textContent = message || 'An error occurred while searching. Please try again.';
}

function hideAllStates() {
    loadingState.style.display = 'none';
    resultsSection.style.display = 'none';
    errorState.style.display = 'none';
}

// Check backend health on load
apiClient.healthCheck().then(health => {
    console.log('Backend health:', health);
}).catch(err => {
    console.error('Backend health check failed:', err);
});

// Global variables
let uploadedFiles = [];

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const filesList = document.getElementById('filesList');
const mergeBtn = document.getElementById('mergeBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const fileCount = document.getElementById('fileCount');
const toastContainer = document.getElementById('toastContainer');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateUI();
});

// Setup event listeners
function setupEventListeners() {
    // File input change
    fileInput.addEventListener('change', handleFileSelection);
    
    // Drag and drop
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Prevent default drag behaviors on document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// Handle file selection
function handleFileSelection(event) {
    const files = Array.from(event.target.files);
    uploadFiles(files);
    // Reset input
    event.target.value = '';
}

// Handle drag over
function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('drag-over');
}

// Handle drag leave
function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('drag-over');
}

// Handle drop
function handleDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const files = Array.from(event.dataTransfer.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== files.length) {
        showToast('Only PDF files are allowed', 'warning');
    }
    
    if (pdfFiles.length > 0) {
        uploadFiles(pdfFiles);
    }
}

// Upload files to server
async function uploadFiles(files) {
    if (files.length === 0) return;
    
    showLoading(true);
    
    const formData = new FormData();
    files.forEach(file => {
        formData.append('files', file);
    });
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            uploadedFiles = data.files;
            updateUI();
            showToast(data.message, 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Error uploading files: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Remove file
async function removeFile(storedName) {
    try {
        const response = await fetch('/remove_file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ stored_name: storedName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            uploadedFiles = data.files;
            updateUI();
            showToast('File removed', 'success');
        } else {
            showToast('Error removing file', 'error');
        }
    } catch (error) {
        showToast('Error removing file: ' + error.message, 'error');
    }
}

// Clear all files
async function clearAllFiles() {
    if (uploadedFiles.length === 0) return;
    
    if (!confirm('Are you sure you want to clear all files?')) return;
    
    try {
        const response = await fetch('/clear', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            uploadedFiles = [];
            updateUI();
            showToast(data.message, 'success');
        } else {
            showToast('Error clearing files', 'error');
        }
    } catch (error) {
        showToast('Error clearing files: ' + error.message, 'error');
    }
}

// Merge PDFs
async function mergePDFs() {
    if (uploadedFiles.length < 2) {
        showToast('Please upload at least 2 PDF files', 'warning');
        return;
    }
    
    showLoading(true, 'Merging your PDFs...');
    
    try {
        const response = await fetch('/merge', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            
            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = data.download_url;
            downloadLink.download = 'merged_document.pdf';
            downloadLink.style.display = 'none';
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // Clear files after successful merge
            setTimeout(() => {
                clearAllFiles();
            }, 1000);
        } else {
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Error merging PDFs: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Update UI
function updateUI() {
    updateFilesList();
    updateFileCount();
    updateMergeButton();
    updateClearButton();
}

// Update files list
function updateFilesList() {
    if (uploadedFiles.length === 0) {
        filesList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No files selected yet</p>
                <small>Upload PDF files to get started</small>
            </div>
        `;
        return;
    }
    
    filesList.innerHTML = uploadedFiles.map(file => `
        <div class="file-item">
            <div class="file-info">
                <div class="file-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <div class="file-details">
                    <div class="file-name" title="${file.original_name}">
                        ${truncateFilename(file.original_name, 50)}
                    </div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="file-actions">
                <button class="remove-file-btn" onclick="removeFile('${file.stored_name}')" title="Remove file">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Update file count
function updateFileCount() {
    fileCount.textContent = uploadedFiles.length;
}

// Update merge button
function updateMergeButton() {
    const canMerge = uploadedFiles.length >= 2;
    mergeBtn.disabled = !canMerge;
    
    if (canMerge) {
        mergeBtn.innerHTML = `
            <i class="fas fa-magic"></i>
            <span>Merge ${uploadedFiles.length} PDFs</span>
            <div class="btn-shine"></div>
        `;
    } else {
        mergeBtn.innerHTML = `
            <i class="fas fa-magic"></i>
            <span>Merge PDFs</span>
            <div class="btn-shine"></div>
        `;
    }
}

// Update clear button
function updateClearButton() {
    clearAllBtn.style.display = uploadedFiles.length > 0 ? 'flex' : 'none';
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove toast after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }
    }, 5000);
    
    // Add click to dismiss
    toast.addEventListener('click', () => {
        if (toast.parentNode) {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }
    });
}

// Show/hide loading overlay
function showLoading(show, message = 'Processing your PDFs...') {
    if (show) {
        loadingOverlay.querySelector('.loading-content p').textContent = message;
        loadingOverlay.classList.add('show');
    } else {
        loadingOverlay.classList.remove('show');
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function truncateFilename(filename, maxLength) {
    if (filename.length <= maxLength) return filename;
    
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    const truncatedName = nameWithoutExt.substring(0, maxLength - extension.length - 4) + '...';
    
    return truncatedName + '.' + extension;
}

// Add slideOut animation to CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
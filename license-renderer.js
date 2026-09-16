const trialButton = document.getElementById('trial-button');
const licenseForm = document.getElementById('license-form');
const licenseKey = document.getElementById('license-key');
const message = document.getElementById('message');

// Fetch status on load to display Hardware ID
window.licenseAPI.getStatus().then((status) => {
  const hwidEl = document.getElementById('hwid-display');
  if (hwidEl && status.hardwareId) {
    hwidEl.textContent = status.hardwareId;
  }
});

function showMessage(text, isError = false) {
  message.textContent = text;
  message.className = `message ${isError ? 'error' : 'success'}`;
}

function continueToApplication(status) {
  if (!status.active) {
    showMessage('Activation could not be completed. Please try again.', true);
    return;
  }
  showMessage('Activated. Opening ScholarBase...');
  setTimeout(() => window.close(), 650);
}

trialButton.addEventListener('click', async () => {
  trialButton.disabled = true;
  trialButton.textContent = 'Activating...';
  continueToApplication(await window.licenseAPI.activateTrial());
});

licenseForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!licenseKey.value.trim()) {
    showMessage('Enter a license key to continue.', true);
    return;
  }
  continueToApplication(await window.licenseAPI.activateLicense(licenseKey.value));
});

document.getElementById('quit-button').addEventListener('click', () => window.licenseAPI.quit());

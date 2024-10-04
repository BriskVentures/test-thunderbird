// Load stored options
async function loadOptions() {
  const result = await browser.storage.local.get(["apiLimit", "currentSkip"]);
  document.getElementById("apiLimit").value =
    result.apiLimit !== undefined ? result.apiLimit : 3;
  document.getElementById("currentSkip").value =
    result.currentSkip !== undefined ? result.currentSkip : 0;
}

// Save options
async function saveOptions() {
  const apiLimit = parseInt(document.getElementById("apiLimit").value, 10);
  const currentSkip = parseInt(
    document.getElementById("currentSkip").value,
    10
  );

  await browser.storage.local.set({
    apiLimit: apiLimit,
    currentSkip: currentSkip,
  });

  // Update status message
  const statusMessage = document.getElementById("statusMessage");
  statusMessage.textContent = "Options saved successfully!";
  setTimeout(() => (statusMessage.textContent = ""), 3000);
}

// Event listener for the Save button
document.getElementById("saveButton").addEventListener("click", saveOptions);

// Load the options when the page is loaded
document.addEventListener("DOMContentLoaded", loadOptions);

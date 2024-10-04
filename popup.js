// Function to display a notification message in the popup
function displayMessage(type, text) {
  const notificationsDiv = document.getElementById("notifications");

  // Create a new div element for the message
  const messageDiv = document.createElement("div");

  // Add appropriate classes based on the message type for styling
  messageDiv.classList.add("message", type);

  // Set the text content of the message
  messageDiv.textContent = text;

  // Append the message to the notifications container
  notificationsDiv.appendChild(messageDiv);
}

// Function to clear all notifications (optional)
function clearNotifications() {
  const notificationsDiv = document.getElementById("notifications");
  notificationsDiv.innerHTML = "";
}

// Listen for messages from the background script
browser.runtime.onMessage.addListener((message) => {
  if (message.type && message.text) {
    displayMessage(message.type, message.text);
  }
});

// Handle "Fetch Tasks Now" button click
document.addEventListener("DOMContentLoaded", () => {
  const fetchButton = document.getElementById("refreshButton");

  fetchButton.addEventListener("click", async () => {
    try {
      // Disable the button to prevent multiple concurrent fetches
      fetchButton.disabled = true;

      // Optionally, clear previous notifications
      // clearNotifications();

      // Display an informational message indicating the fetch has started
      displayMessage("info", "Fetching tasks...");

      // Send a message to the background script to initiate task fetching
      await browser.runtime.sendMessage({ action: "fetchTasks" });

      // Note: Success and error notifications are handled by the background script
    } catch (error) {
      console.error("Error sending fetchTasks message:", error);
      displayMessage("error", "Failed to initiate task fetching.");
    } finally {
      // Re-enable the button after the operation completes
      fetchButton.disabled = false;
    }
  });
});

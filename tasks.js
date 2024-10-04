const DEFAULT_API_LIMIT = 3; // Number of tasks to fetch per request
const DEFAULT_API_SKIP = 0; // Starting skip value

// Function to get the current skip and limit values from storage
async function getFetchParameters() {
  const result = await browser.storage.local.get(["currentSkip", "apiLimit"]);
  return {
    skip:
      result.currentSkip !== undefined ? result.currentSkip : DEFAULT_API_SKIP,
    limit: result.apiLimit !== undefined ? result.apiLimit : DEFAULT_API_LIMIT,
  };
}

// Function to set the new skip value in storage
async function setCurrentSkip(newSkip) {
  await browser.storage.local.set({ currentSkip: newSkip });
}

// Function to set the API limit (optional, if you implement settings)
async function setApiLimit(newLimit) {
  await browser.storage.local.set({ apiLimit: newLimit });
}

// Function to generate the API URL based on the current skip and limit
async function getAPIUrl() {
  const { skip, limit } = await getFetchParameters();
  return `https://dummyjson.com/todos?limit=${limit}&skip=${skip}`;
}

// Function to increment the skip value
async function incrementSkip() {
  const { skip, limit } = await getFetchParameters();
  const newSkip = skip + limit;
  await setCurrentSkip(newSkip);
}

// Function to send a notification message to the sidebar and create a browser notification as a fallback
async function sendNotification(type, text) {
  try {
    if (browser.runtime) {
      await browser.runtime.sendMessage({ type, text });
    }
  } catch (error) {
    console.warn(
      "No receiver for notification messages. Creating a browser notification instead.",
      error
    );
  }
}

// Fetch data from the API
async function fetchTodos() {
  try {
    const apiUrl = await getAPIUrl();
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    const data = await response.json();
    console.log(`Fetched ${data.todos.length} tasks from the API.`);
    return data.todos;
  } catch (error) {
    console.error("Error fetching todos:", error);
    sendNotification("error", `Error fetching tasks: ${error.message}`);
    return [];
  }
}

// Define HTML template as a string with placeholders
const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>Task</title>
    <style>
        body { font-family: Arial, sans-serif; }
        .task-title { font-size: 1.5em; color: #333; }
        .task-details { margin-top: 10px; }
        .completed { color: green; }
        .pending { color: red; }
    </style>
</head>
<body>
    <h1 class="task-title">{{TASK_TITLE}}</h1>
    <div class="task-details">
        <p><strong>User ID:</strong> {{USER_ID}}</p>
        <p><strong>Status:</strong> <span class="{{STATUS_CLASS}}">{{STATUS_TEXT}}</span></p>
        <p><strong>Details:</strong> {{TASK_DETAILS}}</p>
    </div>
</body>
</html>
`;

// Function to apply template to task
function applyTemplate(template, task) {
  return template
    .replace("{{TASK_TITLE}}", task.todo)
    .replace("{{USER_ID}}", task.userId)
    .replace("{{STATUS_CLASS}}", task.completed ? "completed" : "pending")
    .replace("{{STATUS_TEXT}}", task.completed ? "Completed" : "Pending")
    .replace("{{TASK_DETAILS}}", `Task ID: ${task.id}`);
}

// Helper function to format a raw email message in RFC 822 format with HTML content
function formatRawMessage(subject, htmlBody, fromEmail, toEmail) {
  return `From: ${fromEmail}
To: ${toEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

${htmlBody}`;
}

// Helper function to convert string to File object
function stringToFile(str, filename, mimeType) {
  const blob = new Blob([str], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
}

// Check if a folder with the given name exists under the specified parent
async function folderExists(parentFolderId, folderName) {
  const subFolders = await browser.folders.getSubFolders(parentFolderId);
  return subFolders.find((folder) => folder.name === folderName);
}

// Create a folder if it doesn't exist
async function createFolder(parentFolderId, folderName) {
  const existingFolder = await folderExists(parentFolderId, folderName);
  if (existingFolder) {
    console.log(`Folder "${folderName}" already exists.`);
    return existingFolder;
  } else {
    const newFolder = await browser.folders.create(parentFolderId, folderName);
    console.log(`Created folder: ${newFolder.name}`);
    sendNotification("info", `Created folder: ${newFolder.name}`);
    return newFolder;
  }
}

// Function to check if a message with the given subject already exists in the specified folder
async function messageExists(folderId, subject) {
  const queryInfo = {
    folderId: folderId,
    subject: subject,
  };
  const messageList = await browser.messages.query(queryInfo);
  return messageList.messages.length > 0;
}

// Create and move tasks
async function createAndMoveTasks() {
  try {
    const accounts = await browser.accounts.list();
    if (accounts.length === 0) {
      console.error("No email accounts found.");
      sendNotification("error", "No email accounts found.");
      return;
    }

    const account = accounts[0]; // Selecting the first account for simplicity
    const rootFolder = account.rootFolder;

    // Retrieve the email address of the first identity of the account
    const identities = account.identities;
    if (identities.length === 0) {
      console.error("No identities found for the selected account.");
      sendNotification(
        "error",
        "No identities found for the selected account."
      );
      return;
    }
    const fromEmail = identities[0].email;
    const toEmail = fromEmail; // You can change this as needed

    // Step 1: Create a Local "Tasks" Folder
    const localAccount = accounts.find((acc) => acc.type === "none"); // Typically, "none" is Local Folders
    if (!localAccount) {
      console.error("Local folders account not found.");
      sendNotification("error", "Local folders account not found.");
      return;
    }
    const localRootFolder = localAccount.rootFolder;

    const localTasksFolder = await createFolder(localRootFolder.id, "Tasks");
    if (!localTasksFolder) {
      console.error("Failed to create or retrieve Local 'Tasks' folder.");
      sendNotification(
        "error",
        "Failed to create or retrieve Local 'Tasks' folder."
      );
      return;
    }
    console.log(`Local Tasks Folder ID: ${localTasksFolder.id}`);

    // Step 2: Create or Verify IMAP "Tasks" Folder
    const imapTasksFolder = await createFolder(rootFolder.id, "Tasks");
    if (!imapTasksFolder) {
      console.error("Failed to create or retrieve IMAP 'Tasks' folder.");
      sendNotification(
        "error",
        "Failed to create or retrieve IMAP 'Tasks' folder."
      );
      return;
    }
    console.log(`IMAP Tasks Folder ID: ${imapTasksFolder.id}`);

    // Step 3: Import Messages into the Local "Tasks" Folder
    const todos = await fetchTodos();
    if (todos.length === 0) {
      console.log("No tasks fetched from the API.");
      sendNotification("info", "No tasks fetched from the API.");
      return;
    }

    for (const todo of todos) {
      const subject = todo.completed
        ? `[DONE] ${todo.todo}`
        : `[TODO] ${todo.todo}`;

      // Check if the message already exists in the IMAP "Tasks" folder
      const exists = await messageExists(imapTasksFolder.id, subject);
      if (exists) {
        console.log(
          `Message with subject "${subject}" already exists in IMAP "Tasks" folder. Skipping.`
        );
        sendNotification("info", `Skipped existing task: ${subject}`);
        continue;
      }

      // Apply template to task
      const htmlBody = applyTemplate(htmlTemplate, todo);
      const filename = `task-${todo.id}.eml`;
      const rawMessage = formatRawMessage(
        subject,
        htmlBody,
        fromEmail,
        toEmail
      );
      const file = stringToFile(rawMessage, filename, "message/rfc822");

      // Import into Local "Tasks" Folder
      const messageHeader = await browser.messages.import(
        file,
        localTasksFolder.id,
        { read: true }
      );
      if (!messageHeader || !messageHeader.id) {
        console.error(
          `Failed to import message for task ID ${todo.id}:`,
          rawMessage
        );
        sendNotification("error", `Failed to import task: ${subject}`);
        continue;
      }
      console.log(
        `Imported message into Local "Tasks" folder: ${messageHeader.subject}`
      );
      sendNotification("success", `Imported task: ${messageHeader.subject}`);

      try {
        await browser.messages.move([messageHeader.id], imapTasksFolder.id);
        console.log(
          `Moved message to IMAP "Tasks" folder: ${messageHeader.subject}`
        );
        sendNotification(
          "success",
          `Moved task to IMAP "Tasks" folder: ${messageHeader.subject}`
        );
      } catch (error) {
        console.error(
          `Failed to move message to IMAP "Tasks" folder: ${messageHeader.subject}`,
          error
        );
        sendNotification(
          "error",
          `Failed to move task to IMAP "Tasks" folder: ${messageHeader.subject}`
        );
      }
    }

    console.log("All tasks have been processed.");
    sendNotification(
      "success",
      "All tasks have been successfully imported and moved."
    );

    // Increment the skip value after successful fetch
    await incrementSkip();
  } catch (error) {
    console.error(
      "Error creating 'Tasks' folder or inserting messages:",
      error
    );
    sendNotification("error", `An error occurred: ${error.message}`);
  }
}

// Initialize the skip value on installation
browser.runtime.onInstalled.addListener(async () => {
  const { skip, limit } = await getFetchParameters();
  if (skip === DEFAULT_API_SKIP) {
    console.log("Initializing skip value to 0.");
    await setCurrentSkip(DEFAULT_API_SKIP);
  }
  if (limit === DEFAULT_API_LIMIT) {
    console.log("Initializing API limit to 3.");
    await setApiLimit(DEFAULT_API_LIMIT);
  }
});

// Listen for messages from the sidebar or popup
browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "fetchTasks") {
    console.log("Manual task fetch initiated.");
    await createAndMoveTasks();
  }
});

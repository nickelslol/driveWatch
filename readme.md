# Google Drive Folder Monitoring with Notifications

This guide will help you set up a Google Apps Script to monitor updates in your Google Drive folders and send notifications to Discord, Slack, and Telegram. The script checks for file updates at regular intervals and notifies your preferred channels when changes are detected.


## Prerequisites

Before you begin, ensure you have the following:

- A Google account with access to Google Drive.
- **Folder ID** of the Google Drive folder you want to monitor.
- Webhook URLs for Discord or Slack.
- Telegram bot token and chat ID for Telegram notifications.

## Setup Instructions

### 1. Create a New Google Apps Script Project

1. Go to [Google Apps Script](https://script.google.com/) and sign in with your Google account.
2. Click on **New project**.

### 2. Add the Script Code

1. In the script editor, delete any existing code in the `main.js` file (or rename `Code.gs` to `main.js` if it exists).
2. Copy and paste the provided script into the editor.

## Security Note
It is crucial to keep your webhook URLs (Discord, Slack) and your Telegram Bot Token private. These are sensitive credentials. Do not share them publicly or commit them to public repositories.

### 3. Configure the Script

1. **Set the Root Folder ID:**
   - Replace `”FOLDER_TO_MONITOR_ID”` in `ROOT_FOLDER_ID` with the ID of the Google Drive folder you want to monitor.
   - To find the folder ID, navigate to the folder in Google Drive and copy the string after `folders/` in the URL.

   ```javascript
   DRIVE: {
     ROOT_FOLDER_ID: "FOLDER_TO_MONITOR_ID" // IMPORTANT: Replace with your actual Google Drive Folder ID
   },
   ```
   Make sure to replace `"FOLDER_TO_MONITOR_ID"` with the actual ID of the Google Drive folder you wish to monitor. Failure to do so will result in an error, and the script will not run.
   
### 4. Configure Notifications

Configure the notification settings for Discord, Slack, and Telegram by updating the `NOTIFICATIONS` section in the script’s `CONFIG` object. This will enable the script to send updates to your preferred channels when changes are detected in the monitored Google Drive folder.

1. **Configure Notifications:**
   - **Discord:**
     - Set `ENABLED` to `true` to enable Discord notifications.
     - Replace `”DISCORD_WEBHOOK”` with your Discord webhook URL.
   - **Slack:**
     - Set `ENABLED` to `true` to enable Slack notifications.
     - Replace `”SLACK_WEBHOOK”` with your Slack webhook URL.
   - **Telegram:**
     - Set `ENABLED` to `true` to enable Telegram notifications.
     - Replace `”1234567890:ABC-EXAMPLE-TOKEN”` with your Telegram bot token.
     - Replace `”123456789”` with your Telegram chat or group ID.

   ```javascript
   NOTIFICATIONS: {
     DISCORD: {
       ENABLED: false, // Set to true to enable Discord notifications
       WEBHOOK_URL: "DISCORD_WEBHOOK" // IMPORTANT: Replace with your actual Discord webhook URL
     },
     SLACK: {
       ENABLED: false, // Set to true to enable Slack notifications
       WEBHOOK_URL: "SLACK_WEBHOOK" // IMPORTANT: Replace with your actual Slack webhook URL
     },
     TELEGRAM: {
       ENABLED: false, // Set to true to enable Telegram notifications
       BOT_TOKEN: "TELEGRAM_BOT_TOKEN", // IMPORTANT: Replace with your actual Telegram bot token
       CHAT_ID: "TELEGRAM_CHAT_ID" // IMPORTANT: Replace with your actual Telegram chat/group ID
     }
   }
   ```
   Ensure you replace placeholder values like `"DISCORD_WEBHOOK"`, `"SLACK_WEBHOOK"`, `"TELEGRAM_BOT_TOKEN"`, and `"TELEGRAM_CHAT_ID"` with your actual service credentials. The script will skip sending notifications to platforms where the webhook/token is still set to its placeholder value.
  
### 5. Create Time-Driven Triggers

To automate the script to run at regular intervals (e.g., every 5 minutes), you need to set up a time-driven trigger using the provided `createTimeDrivenTrigger` function. This trigger ensures that the `checkFolderFilesUpdates` function executes automatically without manual intervention.

#### Step-by-Step Instructions

1. **Open the Script Editor:**
   
   - Navigate to your [Google Apps Script](https://script.google.com/) project where you’ve added the monitoring script.


2. **Run the `createTimeDrivenTrigger` Function Manually:**
   
   - In the script editor, locate the dropdown menu at the top that lists your functions.
   - Select `createTimeDrivenTrigger` from the dropdown.
   - Click the **Run** ▶️ button to execute the function.
   
   
   - **Authorization Prompt:**
     - The first time you run this function, you’ll be prompted to authorize the script to manage your triggers.
     - Click **Review Permissions**.
     - Choose your Google account.
     - Click **Allow** to grant the necessary permissions.
   
   - **Execution Confirmation:**
     - After running, check the **Logs** by navigating to **View** > **Logs** in the script editor to confirm that the trigger was created successfully.
     - You should see a log entry like:
       
       ```
       New trigger created to run every 5 minutes.
       ```
   (Note: You can adjust the `TRIGGER_FREQUENCY_MINUTES` constant at the top of `main.js` to change how often the script checks for updates (default is 5 minutes).)

3. **Verify the Trigger is Set Up Correctly:**
   
   - In the script editor, click on the **Triggers** (clock) icon on the left sidebar.
     
   
   - You should see a trigger listed that runs the `checkFolderFilesUpdates` function at your specified interval (e.g., every 5 minutes).
     
   
   - **If No Trigger is Visible:**
     - Ensure that you ran the `createTimeDrivenTrigger` function without errors.
     - Check the **Logs** for any error messages and address them accordingly.

  
- **Permissions:**
  - The script requires permissions to access Google Drive, send HTTP requests (for webhooks), and manage triggers. Ensure you have granted all necessary permissions during authorization.

## Advanced Usage

### Clearing Folder Cache
The script caches the list of folder IDs for the monitored root folder and its subfolders for 5 minutes (this duration is set within the `getAllFolderIdsCached` function in `main.js`). This is done to improve performance and reduce the number of direct calls to Google Drive. If you add new subfolders to your monitored root folder and want them to be included in the monitoring immediately (before the 5-minute cache expires), you can manually run the `clearMonitoredFolderIdsCache` function from the script editor.
1. Open your script in the Google Apps Script editor.
2. From the function dropdown menu at the top (it might say "Select function"), select `clearMonitoredFolderIdsCache`.
3. Click the **Run** ▶️ button.
This will clear the cache specifically for the `ROOT_FOLDER_ID` currently configured in your script. The script will then fetch and re-cache the updated folder list on its next scheduled run or if `checkFolderFilesUpdates` is run manually.

### Customizing Notifications
Notification messages can be customized by editing the `buildPlatformMessage` function in `main.js`. This allows you to change the formatting and content for Discord, Slack, and Telegram messages to better suit your needs. The `sendWithRetry` function handles the actual sending logic, including retries.

## Troubleshooting

### Notifications not sending:
*   **Configuration Check:** Double-check your webhook URLs, bot token, and chat ID in the `CONFIG` section of `main.js`. Ensure they are correct, do not contain typos, and are not still the placeholder values (e.g., `"DISCORD_WEBHOOK"`). The script logs will indicate if notifications are skipped due to placeholder configurations.
*   **Enabled Flag:** Verify that the respective `ENABLED` flag (e.g., `CONFIG.NOTIFICATIONS.DISCORD.ENABLED`) is set to `true` for the platform you are trying to use.
*   **Google Apps Script Logs:** Check Google Apps Script logs for any error messages. In the script editor, go to "View" > "Logs" or "Executions" (or click the "Execution log" icon). These logs often provide clues about what went wrong (e.g., invalid webhook URL, permission issues, errors from the notification service).
*   **Webhook/Bot Setup:** Ensure your Discord/Slack webhook is correctly set up in your server/channel and that your Telegram bot is a member of the target chat/group and has permission to send messages.

### Script errors during execution:
*   **ROOT_FOLDER_ID Not Set:** Ensure the `ROOT_FOLDER_ID` in the `CONFIG` section of `main.js` has been replaced with your actual Google Drive folder ID. The script will log an error and refuse to run if it's still the default placeholder `"FOLDER_TO_MONITOR_ID"`.
*   **Review Logs:** Always review the error messages in the Google Apps Script logs for details on the specific error. This is the most important step for diagnosing issues.
*   **Folder ID & Access:** Verify that the `ROOT_FOLDER_ID` in `main.js` is a valid folder ID and that the Google account running the script has at least view access to this folder and all its subfolders.
*   **Service Quotas:** If the script processes a very large number of files or folders, or runs very frequently, it might hit Google Apps Script service quotas or limitations (e.g., URL Fetch daily quota, trigger limitations, cache service limits). Review the [Google Apps Script quotas documentation](https://developers.google.com/apps-script/guides/services/quotas) if you suspect this.
*   **Recent Script Changes:** If you recently modified the script, an error might have been introduced. Try reverting to a previously working version if possible, or carefully review your changes.

### Trigger not running:
*   **Trigger Setup:** Double-check that the time-driven trigger for `checkFolderFilesUpdates` was created successfully (see Step 5). You can view existing triggers by clicking the "Triggers" (clock) icon in the left sidebar of the Apps Script editor.
*   **Authorization Issues:** Triggers can sometimes fail silently if the script's authorization is revoked or encounters an issue. Try re-running the `createTimeDrivenTrigger` function or any function manually to see if it prompts for re-authorization.
*   **Conflicting Triggers:** Ensure there are no other conflicting triggers that might be interfering with the script's execution.
# Google Drive Folder Monitoring with Notifications

This guide will help you set up a Google Apps Script to monitor updates in your Google Drive folders and send notifications to Discord, Slack, and Telegram. The script checks for file updates at regular intervals and notifies your preferred channels when changes are detected.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
  1. [Create a New Google Apps Script Project](#1-create-a-new-google-apps-script-project)
  2. [Add the Script Code](#2-add-the-script-code)
  3. [Configure the Script](#3-configure-the-script)
  4. [Set Up Notification Webhooks](#4-set-up-notification-webhooks)
  5. [Deploy and Authorize the Script](#5-deploy-and-authorize-the-script)
  6. [Create Time-Driven Triggers](#6-create-time-driven-triggers)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [License](#license)

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

1. In the script editor, delete any existing code in the `Code.gs` file.
2. Copy and paste the provided script into the editor.

### 3. Configure the Script

1. **Set the Root Folder ID:**
   - Replace `”FOLDER_TO_MONITOR_ID”` in `ROOT_FOLDER_ID` with the ID of the Google Drive folder you want to monitor.
   - To find the folder ID, navigate to the folder in Google Drive and copy the string after `folders/` in the URL.

   ```
   DRIVE: {
     ROOT_FOLDER_ID: “FOLDER_TO_MONITOR_ID”
   },
   ```
   
### 2. Configure Notifications

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

   ```
   NOTIFICATIONS: {
     DISCORD: {
       ENABLED: false,
       WEBHOOK_URL: “YOUR_DISCORD_WEBHOOK_URL”
     },
     SLACK: {
       ENABLED: false,
       WEBHOOK_URL: “YOUR_SLACK_WEBHOOK_URL”
     },
     TELEGRAM: {
       ENABLED: false,
       BOT_TOKEN: “YOUR_TELEGRAM_BOT_TOKEN”,
       CHAT_ID: “YOUR_TELEGRAM_CHAT_ID”
     }
   }  
   ```
  
### 6. Create Time-Driven Triggers

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

3. **Verify the Trigger is Set Up Correctly:**
   
   - In the script editor, click on the **Triggers** (clock) icon on the left sidebar.
     
   
   - You should see a trigger listed that runs the `checkFolderFilesUpdates` function at your specified interval (e.g., every 5 minutes).
     
   
   - **If No Trigger is Visible:**
     - Ensure that you ran the `createTimeDrivenTrigger` function without errors.
     - Check the **Logs** for any error messages and address them accordingly.

  
- **Permissions:**
  - The script requires permissions to access Google Drive, send HTTP requests (for webhooks), and manage triggers. Ensure you have granted all necessary permissions during authorization.


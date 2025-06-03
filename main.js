/****************************************************
 *                   Configuration                  *
 ****************************************************/
const CONFIG = {
  DRIVE: {
    ROOT_FOLDER_ID: "FOLDER_TO_MONITOR_ID" // IMPORTANT: Replace with your actual Google Drive Folder ID
  },
  NOTIFICATIONS: {
    DISCORD: {
      ENABLED: false,
      WEBHOOK_URL: "DISCORD_WEBHOOK" // IMPORTANT: Replace with your actual Discord webhook URL
    },
    SLACK: {
      ENABLED: false,
      WEBHOOK_URL: "SLACK_WEBHOOK" // IMPORTANT: Replace with your actual Slack webhook URL
    },
    TELEGRAM: {
      ENABLED: false,
      BOT_TOKEN: "TELEGRAM_BOT_TOKEN", // IMPORTANT: Replace with your actual Telegram bot token
      CHAT_ID: "TELEGRAM_CHAT_ID" // IMPORTANT: Replace with your actual Telegram chat/group ID
    }
  }
};

/****************************************************
 *                   Constants                      *
 ****************************************************/
const LAST_CHECK_TIME_KEY      = "lastCheckTime";
const TRIGGER_FUNCTION_NAME    = "checkFolderFilesUpdates";
const TRIGGER_FREQUENCY_MINUTES = 5;

/****************************************************
 *               Main Monitoring Logic              *
 ****************************************************/
function checkFolderFilesUpdates() {
  Logger.log("=== Starting checkFolderFilesUpdates ===");

  const props       = PropertiesService.getScriptProperties();
  const lastStr     = props.getProperty(LAST_CHECK_TIME_KEY);
  const lastDt      = lastStr ? new Date(lastStr) : new Date(0);
  Logger.log(`Previous lastCheckTime: ${lastStr || "None"}`);

  let folderIds;
  try {
    // Ensure CONFIG.DRIVE.ROOT_FOLDER_ID is not the placeholder
    if (CONFIG.DRIVE.ROOT_FOLDER_ID === "FOLDER_TO_MONITOR_ID") {
      Logger.log("ERROR: ROOT_FOLDER_ID in CONFIG has not been set. Please update the script configuration.");
      return;
    }
    const root = DriveApp.getFolderById(CONFIG.DRIVE.ROOT_FOLDER_ID);
    folderIds = getAllFolderIdsCached(root);
    if (!folderIds || folderIds.length === 0) {
      Logger.log("No folder IDs found or returned from getAllFolderIdsCached. Ensure the root folder is correct and not empty, or check cache.");
      return;
    }
  } catch (e) {
    Logger.log(`Error fetching root folder or its subfolders: ${e}`);
    return;
  }

  // Build one single Drive query across all folders
  const isoDate   = lastDt.toISOString();
  // Ensure folderIds is not empty before creating the query
  if (folderIds.length === 0) {
      Logger.log("Folder ID list is empty, skipping Drive search.");
      // Potentially update lastCheckTime here if desired, or just return
      return;
  }
  const orParents = folderIds.map(id => `'${id}' in parents`).join(" or ");
  const query     = `modifiedDate >= '${isoDate}' and trashed = false and (${orParents})`;

  Logger.log(`Executing Drive search with query: ${query}`);
  const filesIter = DriveApp.searchFiles(query);

  const updatedFiles = [];
  while (filesIter.hasNext()) {
    const f = filesIter.next();
    updatedFiles.push({
      name:        f.getName(),
      url:         f.getUrl(),
      lastUpdated: f.getLastUpdated()
    });
  }
  Logger.log(`Total updated files found: ${updatedFiles.length}`);

  if (updatedFiles.length > 0) {
    // Compute the newest modification time
    const newest = updatedFiles
      .map(f => f.lastUpdated)
      .reduce((a, b) => a > b ? a : b, lastDt);
    // Advance by one second to avoid duplicate alerts
    const nextCheck = new Date(newest.getTime() + 1000).toISOString();
    try {
      props.setProperty(LAST_CHECK_TIME_KEY, nextCheck);
      Logger.log(`Updated lastCheckTime to: ${nextCheck}`);
    } catch (err) {
      Logger.log(`Error setting lastCheckTime: ${err}`);
      // Decide if we should still attempt to send notifications
      // For now, let's return to avoid sending notifications if state saving fails
      return;
    }
    sendNotifications(updatedFiles);
  } else {
    Logger.log("No updated files; no notifications sent.");
  }

  Logger.log("=== Completed checkFolderFilesUpdates ===");
}

/****************************************************
 *          Cached Drive Folder ID Walker           *
 ****************************************************/
function getAllFolderIdsCached(rootFolder) {
  Logger.log("Starting getAllFolderIdsCached...");
  const cache = CacheService.getScriptCache();
  const key   = "allFolderIds_" + CONFIG.DRIVE.ROOT_FOLDER_ID; // Cache key specific to root folder
  let idsJson = cache.get(key);

  if (idsJson) {
    Logger.log("Successfully retrieved folder IDs from cache for key: " + key);
    try {
      const ids = JSON.parse(idsJson);
      if (ids && ids.length > 0) {
        Logger.log(`Completed getAllFolderIdsCached. Source: cache. IDs found: ${ids.length}`);
        return ids;
      } else {
        Logger.log("Cached folder IDs were empty or invalid. Fetching from Drive.");
      }
    } catch (e) {
      Logger.log(`Error parsing cached folder IDs: ${e}. Fetching from Drive.`);
    }
  } else {
    Logger.log("No cached folder IDs found for key: " + key + "; fetching from Drive.");
  }

  // no cache or invalid cache → walk tree
  const stack     = [rootFolder];
  const folderIds = [];
  while (stack.length) {
    const folder = stack.pop();
    folderIds.push(folder.getId());
    const subs = folder.getFolders();
    while (subs.hasNext()) {
      stack.push(subs.next());
    }
  }

  // cache for 5 minutes (300s) so structure changes appear quickly
  // Only cache if folderIds is not empty
  if (folderIds.length > 0) {
    try {
      cache.put(key, JSON.stringify(folderIds), 300);
      Logger.log(`Successfully fetched and cached folder IDs from Drive for key: ${key}. IDs count: ${folderIds.length}`);
    } catch (e) {
      Logger.log(`Error caching folder IDs: ${e}`);
    }
  } else {
    Logger.log("No folder IDs found while walking the Drive tree. Nothing to cache.");
  }
  Logger.log(`Completed getAllFolderIdsCached. Source: Drive. IDs found: ${folderIds.length}`);
  return folderIds;
}

/**
 * Utility function to manually clear the folder ID cache for the configured ROOT_FOLDER_ID.
 * This can be run from the Apps Script editor.
 */
function clearMonitoredFolderIdsCache() {
  const cacheKey = "allFolderIds_" + CONFIG.DRIVE.ROOT_FOLDER_ID;
  try {
    CacheService.getScriptCache().remove(cacheKey);
    Logger.log(`Cache cleared for key: ${cacheKey}`);
  } catch (e) {
    Logger.log(`Error clearing cache for key ${cacheKey}: ${e}`);
  }
}

/****************************************************
 *               Notification Plumbing              *
 ****************************************************/
function sendNotifications(files) {
  Logger.log("Preparing to send notifications...");
  const discordMsg  = buildPlatformMessage(files, "discord");
  const slackMsg    = buildPlatformMessage(files, "slack");
  const telegramMsg = buildPlatformMessage(files, "telegram");

  const platforms = [
    {
      name:    "Discord",
      enabled: CONFIG.NOTIFICATIONS.DISCORD.ENABLED,
      url:     CONFIG.NOTIFICATIONS.DISCORD.WEBHOOK_URL,
      placeholderUrl: "DISCORD_WEBHOOK",
      payload: msg => ({ content: msg }),
      isOK:    resp => [200, 204].includes(resp.getResponseCode()),
      message: discordMsg
    },
    {
      name:    "Slack",
      enabled: CONFIG.NOTIFICATIONS.SLACK.ENABLED,
      url:     CONFIG.NOTIFICATIONS.SLACK.WEBHOOK_URL,
      placeholderUrl: "SLACK_WEBHOOK",
      payload: msg => ({ text: msg }),
      isOK:    resp => resp.getResponseCode() >= 200 && resp.getResponseCode() < 300,
      message: slackMsg
    },
    {
      name:    "Telegram",
      enabled: CONFIG.NOTIFICATIONS.TELEGRAM.ENABLED,
      url:     (CONFIG.NOTIFICATIONS.TELEGRAM.BOT_TOKEN && CONFIG.NOTIFICATIONS.TELEGRAM.BOT_TOKEN !== "TELEGRAM_BOT_TOKEN") ? `https://api.telegram.org/bot${CONFIG.NOTIFICATIONS.TELEGRAM.BOT_TOKEN}/sendMessage` : null,
      placeholderUrl: "TELEGRAM_BOT_TOKEN", // Technically token, used to check if it's a placeholder
      payload: msg => ({
        chat_id:    CONFIG.NOTIFICATIONS.TELEGRAM.CHAT_ID,
        text:       msg,
        parse_mode: "Markdown"
      }),
      isOK:    resp => resp.getResponseCode() === 200,
      message: telegramMsg
    }
  ];

  let notificationsSent = 0;
  platforms.forEach(p => {
    if (!p.enabled) {
      // Logger.log(`${p.name} notifications are disabled.`);
      return;
    }
    if (!p.url || p.url === p.placeholderUrl || (p.name === "Telegram" && CONFIG.NOTIFICATIONS.TELEGRAM.BOT_TOKEN === "TELEGRAM_BOT_TOKEN")) {
      Logger.log(`${p.name} webhook/URL is not configured or is still a placeholder. Skipping.`);
      return;
    }
    if (p.name === "Telegram" && (!CONFIG.NOTIFICATIONS.TELEGRAM.CHAT_ID || CONFIG.NOTIFICATIONS.TELEGRAM.CHAT_ID === "TELEGRAM_CHAT_ID")) {
        Logger.log("Telegram CHAT_ID is not configured or is still a placeholder. Skipping.");
        return;
    }

    Logger.log(`Attempting to send ${p.name} notification.`);
    sendWithRetry(p.url, p.payload(p.message), p.isOK, p.name);
    notificationsSent++;
  });
  Logger.log(notificationsSent > 0 ? `Finished sending notifications.` : "No notifications were enabled or configured to be sent.");
}

function buildPlatformMessage(files, platform) {
  return files
    .map(f => {
      const updated = f.lastUpdated.toLocaleString();
      switch (platform) {
        case "discord":
          // For Discord, message includes literal newlines.
          return `**[${f.name}](${f.url})**\nLast Updated: ${updated}`;
        case "slack":
          // For Slack, message includes literal newlines.
          return `*<${f.url}|${f.name}>*\nLast Updated: ${updated}`;
        case "telegram":
          // For Telegram, message includes literal newlines.
          return `[${f.name}](${f.url})\nLast Updated: ${updated}`;
        default:
          return `${f.name} - ${f.url}\nLast Updated: ${updated}`;
      }
    })
    .join("\n\n"); // Double newline for paragraph breaks between file entries.
}

function sendWithRetry(url, payloadObj, isOK, platformName) {
  const options = {
    method:           "post",
    contentType:      "application/json",
    payload:          JSON.stringify(payloadObj),
    muteHttpExceptions: true
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      Logger.log(`Sending to ${platformName} (Attempt ${attempt})...`);
      const resp = UrlFetchApp.fetch(url, options);
      if (isOK(resp)) {
        Logger.log(`${platformName} notification sent successfully (Code: ${resp.getResponseCode()}).`);
        return;
      }
      // Log response text if available and not OK for more details
      const responseText = resp.getContentText();
      throw new Error(`${platformName} status ${resp.getResponseCode()}. Response: ${responseText}`);
    } catch (e) {
      Logger.log(`Attempt ${attempt} to send ${platformName} failed: ${e}`);
      if (attempt < 3) {
        const sleepTime = Math.pow(2, attempt) * 1000;
        Logger.log(`Retrying ${platformName} in ${sleepTime} ms...`);
        Utilities.sleep(sleepTime);
      } else {
        Logger.log(`All retries for ${platformName} exhausted. Last error: ${e}`);
      }
    }
  }
}

/****************************************************
 *       Trigger Creation / Management              *
 ****************************************************/
function createTimeDrivenTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let existingTrigger = false;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === TRIGGER_FUNCTION_NAME) {
      Logger.log(`Found existing trigger for ${TRIGGER_FUNCTION_NAME}. Deleting it.`);
      ScriptApp.deleteTrigger(t);
      existingTrigger = true;
    }
  });

  ScriptApp.newTrigger(TRIGGER_FUNCTION_NAME)
    .timeBased()
    .everyMinutes(TRIGGER_FREQUENCY_MINUTES)
    .create();

  Logger.log(`New trigger created to run "${TRIGGER_FUNCTION_NAME}" every ${TRIGGER_FREQUENCY_MINUTES} minutes. Was existing trigger replaced: ${existingTrigger}`);
}
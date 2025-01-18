/****************************************************
 *                   Configuration                  *
 ****************************************************/
const CONFIG = {
  DRIVE: {
    ROOT_FOLDER_ID: "FOLDER_TO_MONITOR_ID"
  },
  NOTIFICATIONS: {
    DISCORD: {
      ENABLED: false,
      WEBHOOK_URL: "DISCORD_WEBHOOK"
    },
    SLACK: {
      ENABLED: false,
      WEBHOOK_URL: "SLACK_WEBHOOK // Replace with your Slack webhook
    },
    TELEGRAM: {
      ENABLED: false,
      BOT_TOKEN: "1234567890:ABC-EXAMPLE-TOKEN", // Replace with your Telegram bot token
      CHAT_ID: "123456789" // Replace with your Telegram chat/group ID
    }
  }
};

/****************************************************
 *                   Constants                      *
 ****************************************************/
// Cache related constants
const CACHE_KEY_FOLDER_IDS = "cachedFolderIds";
const CACHE_TTL_HOURS = 24;
const LAST_CHECK_TIME_KEY = "lastCheckTime";

// Trigger related constants
const TRIGGER_FUNCTION_NAME = "checkFolderFilesUpdates";
const TRIGGER_FREQUENCY_MINUTES = 5;

/****************************************************
 *               Main Monitoring Logic              *
 ****************************************************/
/**
 * Checks for folder file updates since the last check, 
 * sends notifications if any files were updated,
 * and updates the lastCheckTime accordingly.
 */
function checkFolderFilesUpdates() {
  Logger.log("=== Starting checkFolderFilesUpdates ===");

  const properties = PropertiesService.getScriptProperties();
  const lastCheckTime = properties.getProperty(LAST_CHECK_TIME_KEY);
  const lastCheckDate = lastCheckTime ? new Date(lastCheckTime) : new Date(0);

  Logger.log(`Previous lastCheckTime: ${lastCheckTime || "None"}`);

  // Get or fetch/cached folder IDs
  let folderIds = CacheService.getScriptCache().get(CACHE_KEY_FOLDER_IDS);
  if (!folderIds) {
    Logger.log("No cached folder IDs found; fetching now.");
    try {
      const rootFolder = DriveApp.getFolderById(CONFIG.DRIVE.ROOT_FOLDER_ID);
      folderIds = getAllFolderIds(rootFolder);
      CacheService.getScriptCache().put(
        CACHE_KEY_FOLDER_IDS,
        JSON.stringify(folderIds),
        CACHE_TTL_HOURS * 3600
      );
    } catch (error) {
      Logger.log(`Error fetching/caching folder IDs: ${error}`);
      return;
    }
  } else {
    folderIds = JSON.parse(folderIds);
  }

  // Collect updated files
  const updatedFiles = [];
  const formattedDate = Utilities.formatDate(
    lastCheckDate,
    "UTC",
    "yyyy-MM-dd'T'HH:mm:ss'Z'"
  );

  folderIds.forEach(folderId => {
    const query = `modifiedDate > '${formattedDate}' and '${folderId}' in parents and trashed = false`;
    try {
      const files = DriveApp.searchFiles(query);
      while (files.hasNext()) {
        const file = files.next();
        updatedFiles.push({
          name: file.getName(),
          url: file.getUrl(),
          lastUpdated: file.getLastUpdated()
        });
      }
    } catch (error) {
      Logger.log(`Error searching in folder ${folderId}: ${error}`);
    }
  });

  Logger.log(`Total updated files found: ${updatedFiles.length}`);

  // If there are new or modified files, update lastCheckTime and notify
  if (updatedFiles.length > 0) {
    const maxUpdateTime = getMaxUpdateTime(updatedFiles, lastCheckDate);
    const updatedCheckDate = new Date(maxUpdateTime.getTime() + 1000); // +1s to prevent overlap
    const formattedCheckDate = Utilities.formatDate(
      updatedCheckDate,
      "UTC",
      "yyyy-MM-dd'T'HH:mm:ss'Z'"
    );

    try {
      properties.setProperty(LAST_CHECK_TIME_KEY, formattedCheckDate);
      Logger.log(`Updated lastCheckTime to: ${formattedCheckDate}`);
    } catch (error) {
      Logger.log(`Error setting lastCheckTime: ${error}`);
      return;
    }

    // Send notifications (all channels)
    sendNotifications(updatedFiles);
  } else {
    Logger.log("No updated files found; no notifications sent.");
  }

  Logger.log("=== Completed checkFolderFilesUpdates ===");
}

/****************************************************
 *               Helper / Utility Methods           *
 ****************************************************/
function clearCachedFolderIds() {
  Logger.log("=== Starting clearCachedFolderIds ===");
  try {
    CacheService.getScriptCache().remove(CACHE_KEY_FOLDER_IDS);
    Logger.log("Cached folder IDs cleared.");
  } catch (error) {
    Logger.log(`Error clearing cached folder IDs: ${error}`);
  }
  Logger.log("=== Completed clearCachedFolderIds ===");
}

/**
 * Returns the latest Date among the updated files or the original last check date.
 */
function getMaxUpdateTime(files, lastCheckDate) {
  return files.reduce((latest, file) => {
    return file.lastUpdated > latest ? file.lastUpdated : latest;
  }, lastCheckDate);
}

/**
 * Central entry point for sending notifications to all enabled channels.
 * For each platform, we build a *platform-specific* message, then send.
 */
function sendNotifications(files) {
  // Discord
  if (CONFIG.NOTIFICATIONS.DISCORD.ENABLED) {
    const discordMessage = buildPlatformMessage(files, "discord");
    sendDiscordNotification(discordMessage, CONFIG.NOTIFICATIONS.DISCORD.WEBHOOK_URL);
  }

  // Slack
  if (CONFIG.NOTIFICATIONS.SLACK.ENABLED) {
    const slackMessage = buildPlatformMessage(files, "slack");
    sendSlackNotification(slackMessage, CONFIG.NOTIFICATIONS.SLACK.WEBHOOK_URL);
  }

  // Telegram
  if (CONFIG.NOTIFICATIONS.TELEGRAM.ENABLED) {
    const telegramMessage = buildPlatformMessage(files, "telegram");
    sendTelegramNotification(
      telegramMessage,
      CONFIG.NOTIFICATIONS.TELEGRAM.BOT_TOKEN,
      CONFIG.NOTIFICATIONS.TELEGRAM.CHAT_ID
    );
  }
}

/**
 * Builds the notification text for a given platform.
 * This way we can customize Slack vs. Discord vs. Telegram syntax.
 */
function buildPlatformMessage(files, platform) {
  return files
    .map(file => {
      // Format each file entry differently per platform:
      switch (platform) {
        case "discord":
          // Discord supports **bold** and [Link](URL) markdown
          return `**[${file.name}](${file.url})**\nLast Updated: ${file.lastUpdated.toLocaleString()}`;

        case "slack":
          // Slack uses <URL|Text> for links; bold can be *text*
          return `*<${file.url}|${file.name}>*\nLast Updated: ${file.lastUpdated.toLocaleString()}`;

        case "telegram":
          // Telegram (with parse_mode=Markdown) supports [Text](URL)
          return `[${file.name}](${file.url})\nLast Updated: ${file.lastUpdated.toLocaleString()}`;

        default:
          // Fallback if needed (plain text)
          return `${file.name} - ${file.url}\nLast Updated: ${file.lastUpdated.toLocaleString()}`;
      }
    })
    .join("\n\n");
}

/****************************************************
 *               Platform-Specific Senders          *
 ****************************************************/
/**
 * Sends a single consolidated notification to Discord 
 * using Markdown-like formatting and exponential backoff for errors.
 */
function sendDiscordNotification(messageText, webhookUrl) {
  Logger.log("Sending Discord notification...");

  const payload = JSON.stringify({ content: messageText });
  const options = {
    method: "post",
    contentType: "application/json",
    payload: payload,
    muteHttpExceptions: true
  };

  let attempt = 0;
  const maxRetries = 3;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = UrlFetchApp.fetch(webhookUrl, options);
      const code = response.getResponseCode();
      if (code === 200 || code === 204) {
        Logger.log("Discord notification sent successfully.");
        return;
      }
      throw new Error(`Discord responded with status: ${code}`);
    } catch (error) {
      Logger.log(`Attempt ${attempt} failed: ${error}`);
      if (attempt < maxRetries) {
        const sleepTime = Math.pow(2, attempt) * 1000;
        Logger.log(`Retrying in ${sleepTime} ms...`);
        Utilities.sleep(sleepTime);
      } else {
        Logger.log(`All retries failed. Last error: ${error}`);
      }
    }
  }
}

/**
 * Sends a single consolidated notification to Slack 
 * using a Slack incoming webhook. Also uses exponential backoff.
 */
function sendSlackNotification(messageText, webhookUrl) {
  Logger.log("Sending Slack notification...");

  const payload = JSON.stringify({ text: messageText });
  const options = {
    method: "post",
    contentType: "application/json",
    payload: payload,
    muteHttpExceptions: true
  };

  let attempt = 0;
  const maxRetries = 3;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = UrlFetchApp.fetch(webhookUrl, options);
      const code = response.getResponseCode();
      if (code >= 200 && code < 300) {
        Logger.log("Slack notification sent successfully.");
        return;
      }
      throw new Error(`Slack responded with status: ${code}`);
    } catch (error) {
      Logger.log(`Attempt ${attempt} failed: ${error}`);
      if (attempt < maxRetries) {
        const sleepTime = Math.pow(2, attempt) * 1000;
        Logger.log(`Retrying in ${sleepTime} ms...`);
        Utilities.sleep(sleepTime);
      } else {
        Logger.log(`All retries failed. Last error: ${error}`);
      }
    }
  }
}

/**
 * Sends a single consolidated notification to Telegram 
 * using the Bot API (sendMessage endpoint). Also uses exponential backoff.
 */
function sendTelegramNotification(messageText, botToken, chatId) {
  Logger.log("Sending Telegram notification...");

  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
  // We set parse_mode to "Markdown" so [text](URL) is recognized
  const payload = {
    chat_id: chatId,
    text: messageText,
    parse_mode: "Markdown"
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  let attempt = 0;
  const maxRetries = 3;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = UrlFetchApp.fetch(telegramUrl, options);
      const code = response.getResponseCode();
      if (code === 200) {
        Logger.log("Telegram notification sent successfully.");
        return;
      }
      throw new Error(`Telegram responded with status: ${code}`);
    } catch (error) {
      Logger.log(`Attempt ${attempt} failed: ${error}`);
      if (attempt < maxRetries) {
        const sleepTime = Math.pow(2, attempt) * 1000;
        Logger.log(`Retrying in ${sleepTime} ms...`);
        Utilities.sleep(sleepTime);
      } else {
        Logger.log(`All retries failed. Last error: ${error}`);
      }
    }
  }
}

/****************************************************
 *       Recursive Drive Folder ID Fetcher          *
 ****************************************************/
/**
 * Recursively gathers IDs from a folder and its subfolders.
 */
function getAllFolderIds(folder) {
  const folderIds = [folder.getId()];
  const subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    const subfolder = subfolders.next();
    folderIds.push(...getAllFolderIds(subfolder));
  }
  return folderIds;
}

/****************************************************
 *       Time-driven Trigger Setup                  *
 ****************************************************/
/**
 * Creates a time-driven trigger to run `checkFolderFilesUpdates()` 
 * every configured number of minutes (from TRIGGER_FREQUENCY_MINUTES).
 */
function createTimeDrivenTrigger() {
  const existingTriggers = ScriptApp.getProjectTriggers();

  // Remove any old trigger for the same function to avoid duplicates
  existingTriggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === TRIGGER_FUNCTION_NAME) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create a new one
  ScriptApp.newTrigger(TRIGGER_FUNCTION_NAME)
    .timeBased()
    .everyMinutes(TRIGGER_FREQUENCY_MINUTES)
    .create();

  Logger.log(
    `New trigger created to run every ${TRIGGER_FREQUENCY_MINUTES} minutes.`
  );
}
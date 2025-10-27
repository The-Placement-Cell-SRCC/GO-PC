/**
 * CV Sorter Backend - Google Apps Script
 *
 * This script functions as a secure web app backend to process CV sorting
 * requests from an authenticated frontend.
 *
 * FUNCTIONS FOR ADMIN (Run from Apps Script Editor):
 * 1. setup(): Run this ONCE to initialize all required script properties.
 * 2. setApproval(required): Run to toggle the approval requirement (true/false).
 * 3. viewLogs(): A convenience function to get the URL of the log sheet.
 */

// +----------------------------------------------------------------------+
// | ADMIN CONFIGURATION FUNCTIONS (Run manually from script editor)      |
// +----------------------------------------------------------------------+

/**
 * !!! IMPORTANT: RUN THIS FUNCTION ONCE MANUALLY !!!
 * Sets up the initial configuration for the script.
 * Fill in the placeholder IDs before running.
 */
function setup() {
  const adminEmail = "fns.placementcell@srcc.du.ac.in";
  // Consider making this the same as ADMIN_EMAIL unless specifically needed otherwise
  const approvalEmail = "kohliashish12@gmail.com";

  // --- FILL IN THESE VALUES ---
  const config = {
    // ID of the 'CVlinks.csv' file on Google Drive
    'CV_LINKS_CSV_ID': '1aSh1DeUGihTnVUiKbuXu3VLbsoT0uQyf', // Example ID, replace with yours

    // ID of the Google Sheet to use for logging
    'LOG_SHEET_ID': '1k2w99k58l4T6NIWbqjUrhuM6YPiAy94j_0Ssv0Xgb0k', // Example ID, replace with yours

    // ID of the Google Drive folder where new GDrive output folders will be created
    'GDRIVE_OUTPUT_PARENT_ID': '17zXnLxH6q5se-kmQTiiO6Ov9quw1VYZ8', // Example ID, replace with yours

    // ID of a Google Drive folder for storing temporary ZIP files
    'TEMP_ZIP_FOLDER_ID': '1Qrf03gYySfML9HOR8Oi5ZWs4h-xWgtaF', // Example ID, replace with yours

    // Admin email (who can change settings)
    'ADMIN_EMAIL': adminEmail,

    // Email to send approval requests to
    'APPROVAL_EMAIL': approvalEmail,

    // Set to 'true' to require admin approval, 'false' to process immediately
    'REQUIRE_APPROVAL': 'true', // Default to true for safety

    // Whitelisted frontend origins (comma-separated, NO trailing slash)
    // IMPORTANT: Include BOTH http://127.0.0.1:5500 AND your deployed URL (e.g., http://gopc.live)
    'ALLOWED_ORIGINS': 'http://127.0.0.1:5500,http://gopc.live' // Add your production URL if different
  };
  // --- END OF VALUES TO FILL ---

  try {
    PropertiesService.getScriptProperties().setProperties(config);
    Logger.log('✅ Configuration set successfully.');
    Logger.log('Current Settings:');
    Logger.log(JSON.stringify(config, null, 2));
  } catch (e) {
    Logger.log(`Error setting configuration: ${e.message}`);
    throw new Error(`Failed to set properties: ${e.message}`);
  }
}

/**
 * ADMIN-ONLY: Toggles the approval requirement.
 * @param {boolean} required - true to require approval, false to process immediately.
 */
function setApproval(required) {
  const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  const currentUser = Session.getActiveUser().getEmail();

  if (!adminEmail) {
      Logger.log('ERROR: ADMIN_EMAIL not set. Run setup() first.');
      throw new Error('Script not configured. Please run setup().');
  }
  if (currentUser !== adminEmail) {
    Logger.log(`WARNING: Unauthorized attempt to change settings by ${currentUser}.`);
    throw new Error('You are not authorized to perform this action.');
  }

  try {
    PropertiesService.getScriptProperties().setProperty('REQUIRE_APPROVAL', String(required));
    Logger.log(`✅ Approval requirement set to: ${required}`);
    MailApp.sendEmail(adminEmail, 'CV Sorter Setting Changed',
      `The CV Sorter approval requirement was changed to ${required} by ${currentUser} at ${new Date()}.`);
  } catch (e) {
    Logger.log(`Error setting approval flag: ${e.message}`);
    throw new Error(`Failed to set approval flag: ${e.message}`);
  }
}

/**
 * Convenience function for admin to get the log sheet URL.
 */
function viewLogs() {
  const logSheetId = PropertiesService.getScriptProperties().getProperty('LOG_SHEET_ID');
  if (!logSheetId) {
    Logger.log('LOG_SHEET_ID is not set. Please run setup().');
    return "LOG_SHEET_ID not set in Script Properties.";
  }
  const url = `https://docs.google.com/spreadsheets/d/${logSheetId}/edit`;
  Logger.log(`Log Sheet URL: ${url}`);
  return url;
}


// +----------------------------------------------------------------------+
// | WEB APP ENTRY POINTS (doPost, doGet, doOptions)                      |
// +----------------------------------------------------------------------+

/**
 * Handles CORS preflight OPTIONS requests.
 * Explicitly allows methods and headers needed by doPost.
 */
function doOptions(e) {
  const origin = e.headers.origin || e.headers.Origin;
  const allowedOrigins = (PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGINS') || '').split(',');
  const response = ContentService.createTextOutput(''); // No content needed for OPTIONS response body

  // Only add headers if the origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    // Use .withHeaders() to set multiple headers correctly
    response.withHeaders({
      'Access-Control-Allow-Origin': origin, // Echo back the allowed origin
      'Access-Control-Allow-Methods': 'POST, OPTIONS', // Specify allowed methods
      'Access-Control-Allow-Headers': 'Content-Type', // Specify allowed headers like Content-Type
      'Access-Control-Max-Age': '86400' // Cache preflight response for 1 day
    });
  } else {
    // If origin is not allowed, don't send CORS headers, browser will block.
    Logger.log(`Blocked OPTIONS request from disallowed origin: ${origin}`);
    // You might return a simple text output here, but without CORS headers it will likely fail anyway.
    // The key is *not* adding the CORS headers for disallowed origins.
  }
  return response; // Return the response object configured (or not) with headers
}


/**
 * Handles GET requests.
 * Used primarily for the approval link callback. Also provides a test message.
 */
function doGet(e) {
  // Check if run from editor or without parameters
  if (!e || !e.parameter) {
    Logger.log('doGet run from editor or without parameters.');
    // Return simple HTML indicating the backend is running
    return HtmlService.createHtmlOutput(
      '<h1>GO-PC CV Sorter Backend</h1><p>This Apps Script is running.</p>' +
      '<p>Access via the frontend application or approval links.</p>'
    );
  }

  try {
    // Handle approval action
    if (e.parameter.action === 'approve') {
      const approvalId = e.parameter.id;
      if (!approvalId) {
        return HtmlService.createHtmlOutput('<h1>Error</h1><p>Invalid or missing approval ID.</p>');
      }
      // Process the approval (this function now returns HTML)
      return handleApprovalCallback(approvalId);
    } else {
      // Handle other GET requests (e.g., just visiting the URL)
      return HtmlService.createHtmlOutput('<h1>GO-PC CV Sorter Backend</h1><p>Invalid request.</p>');
    }
  } catch (err) {
    // Log any unexpected errors during GET handling
    Logger.log(`doGet Error: ${err.message}\nStack: ${err.stack}`);
    return HtmlService.createHtmlOutput(`<h1>Error</h1><p>An unexpected error occurred: ${err.message}</p>`);
  }
}


/**
 * Handles POST requests from the frontend application for CV sorting.
 */
function doPost(e) {
  let origin = e.headers.origin || e.headers.Origin;
  let requestData;
  let responseData = {}; // Initialize response data object
  let statusCode = 200; // Default success code (GAS doesn't really use this, but good practice)

  // --- Validate Origin ---
  const allowedOriginsProperty = PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGINS');
  const allowedOrigins = allowedOriginsProperty ? allowedOriginsProperty.split(',') : [];
  let isOriginAllowed = false;

  if (origin && allowedOrigins.includes(origin)) {
    isOriginAllowed = true;
  } else {
    // If not allowed, log it and prepare an error response.
    // We still return using createJsonResponse to ensure *some* headers are set
    // allowing the browser to read the error, rather than just failing silently.
    Logger.log(`Blocked POST request from disallowed origin: ${origin}`);
    origin = allowedOrigins[0] || '*'; // Use a safe origin for the response header itself
    responseData = { status: 'error', message: `Origin (${e.headers.origin || 'unknown'}) is not permitted.` };
    statusCode = 403; // Forbidden (though GAS ignores this)
    return createJsonResponse(responseData, origin); // Send error response with CORS header for the fallback origin
  }

  // --- Process Request ---
  try {
    // Parse request body
    try {
      requestData = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      statusCode = 400; // Bad Request
      throw new Error(`Invalid JSON payload: ${parseErr.message}`);
    }

    // Validate parameters
    const { keys, outputName, outputType, userEmail } = requestData;
    if (!keys || !outputName || !outputType || !userEmail || !Array.isArray(keys) || keys.length === 0) {
      statusCode = 400;
      throw new Error('Missing or invalid parameters. Required: keys (non-empty array), outputName (string), outputType (string), userEmail (string).');
    }

    // Check if approval is needed
    const requireApproval = PropertiesService.getScriptProperties().getProperty('REQUIRE_APPROVAL') === 'true';

    if (requireApproval) {
      responseData = handleApprovalRequest(requestData); // Send for approval
    } else {
      responseData = processRequest(requestData); // Process immediately
    }
    // Success status is set within the handling functions

  } catch (err) {
    // Catch errors from parsing, validation, or processing
    Logger.log(`doPost Error: ${err.message}\nStack: ${err.stack}\nRequest Body: ${e.postData ? e.postData.contents : 'N/A'}`);
    responseData = { status: 'error', message: err.message };
    // Log error to sheet
    logRequest(
      new Date(),
      requestData ? requestData.userEmail : (e.postData ? 'Unknown (Parse Error?)' : 'Unknown'),
      requestData ? requestData.outputName : 'Unknown',
      requestData ? requestData.outputType : 'Unknown',
      'N/A',
      'Error: Request Failed',
      err.message
    );
  }

  // --- Send Response ---
  // Crucially, createJsonResponse adds the required CORS headers using the validated origin
  return createJsonResponse(responseData, origin);
}


// +----------------------------------------------------------------------+
// | CORE LOGIC FUNCTIONS                                                 |
// +----------------------------------------------------------------------+

/**
 * Handles the approval link callback clicked by the approver.
 * @param {string} approvalId - The unique ID for the pending request.
 * @returns {HtmlOutput} An HTML page indicating success or failure.
 */
function handleApprovalCallback(approvalId) {
  const propKey = `REQ_${approvalId}`;
  const properties = PropertiesService.getScriptProperties();
  const requestDataJson = properties.getProperty(propKey);

  if (!requestDataJson) {
    // Request already processed or expired
    return HtmlService.createHtmlOutput('<h1>Request Not Found</h1><p>This approval link is invalid, has expired, or the request has already been processed.</p>');
  }

  try {
    // Delete property immediately to prevent double processing
    properties.deleteProperty(propKey);
    const requestData = JSON.parse(requestDataJson);

    // Perform the actual CV processing
    const result = processRequest(requestData);

    // Log the successful approval and processing
    logRequest(
      new Date(),
      requestData.userEmail,
      requestData.outputName,
      requestData.outputType,
      result.processedKeys ? result.processedKeys.join(', ') : 'N/A', // Log joined keys
      'Success (Approved)',
      JSON.stringify(result) // Store full result details
    );

    // Build HTML response for the approver
    let detailsHtml = `<li>Status: <strong style="color: green;">${result.status}</strong></li>`;
    if (result.folderUrl) { // GDrive success
      detailsHtml += `<li>Folder URL: <a href="${result.folderUrl}" target="_blank" rel="noopener noreferrer">${result.folderUrl}</a></li>`;
    }
    if (result.downloadUrls && result.downloadUrls.length > 0) { // ZIP success
      detailsHtml += '<li>ZIP Download URLs:<ul>';
      result.downloadUrls.forEach((url, i) => {
        detailsHtml += `<li><a href="${url}" target="_blank" rel="noopener noreferrer">Part ${i + 1}</a></li>`;
      });
      detailsHtml += '</ul></li>';
    }
     if (result.processedKeys) {
        detailsHtml += `<li>CVs Processed: ${result.processedKeys.length}</li>`;
     }
    if (result.errors && result.errors.length > 0) {
      detailsHtml += `<li style="color: red;">Errors Encountered (${result.errors.length}): <pre>${result.errors.join('\n')}</pre></li>`;
    }

    return HtmlService.createHtmlOutput(
      '<h1>Request Approved & Processed</h1>' +
      '<p>The CV sorting request has been successfully processed.</p>' +
      '<h3>Request Details:</h3>' +
      '<ul>' +
      `<li>User: ${requestData.userEmail}</li>` +
      `<li>Output Name: ${requestData.outputName}</li>` +
      `<li>Output Type: ${requestData.outputType}</li>` +
      `<li>Timestamp: ${new Date(requestData.timestamp).toLocaleString()}</li>`+
      '</ul>' +
      '<h3>Processing Results:</h3>' +
      '<ul>' + detailsHtml + '</ul>'
    );

  } catch (err) {
    // Log error during processing after approval
    Logger.log(`Approval Callback Error (ID: ${approvalId}): ${err.message}\nStack: ${err.stack}`);
    // Also log to sheet if possible
    try {
        const requestData = JSON.parse(requestDataJson || '{}'); // Try parsing again for logging
        logRequest(
            new Date(),
            requestData.userEmail || 'Unknown (Approval Error)',
            requestData.outputName || 'Unknown',
            requestData.outputType || 'Unknown',
            'N/A',
            'Error: Processing Failed After Approval',
            err.message
        );
    } catch (logErr) {
        Logger.log("Failed to log approval processing error to sheet.");
    }
    // Return error page to approver
    return HtmlService.createHtmlOutput(`<h1>Error Processing Request</h1><p>Failed to process the request after approval: ${err.message}</p><p>Please check the script logs for details.</p>`);
  }
}

/**
 * Stores a request details in Script Properties for later approval and sends an email notification.
 * @param {object} requestData - The parsed request object containing keys, outputName, outputType, userEmail.
 * @returns {object} A result object indicating approval is requested.
 */
function handleApprovalRequest(requestData) {
  const { keys, outputName, outputType, userEmail } = requestData;
  const requestId = Utilities.getUuid(); // Generate a unique ID for this request
  const propKey = `REQ_${requestId}`; // Key to store request data in properties
  const timestamp = new Date();

  // Store the full request data along with a timestamp
  const pendingRequest = {
    ...requestData, // Spread existing data
    timestamp: timestamp.toISOString(), // Add timestamp
    requestId: requestId // Add the ID itself for reference
  };
  try {
     // Store for up to 6 hours (Apps Script property limit) - Adjust if needed
     PropertiesService.getScriptProperties().setProperty(propKey, JSON.stringify(pendingRequest));
  } catch(propErr) {
      throw new Error(`Failed to store pending request: ${propErr.message}. Property size might be too large if many keys are requested.`);
  }


  // Construct the approval link using the web app's URL
  const webAppUrl = ScriptApp.getService().getUrl();
  // Ensure URL ends with /exec before appending parameters if needed (sometimes GAS URLs vary)
  const baseUrl = webAppUrl.endsWith('/exec') ? webAppUrl : webAppUrl.replace(/\/dev$/, '/exec'); // Handle dev vs exec URLs
  const approvalLink = `${baseUrl}?action=approve&id=${requestId}`;

  // Get the designated approval email address
  const approvalEmail = PropertiesService.getScriptProperties().getProperty('APPROVAL_EMAIL');
  if (!approvalEmail) {
    Logger.log("ERROR: APPROVAL_EMAIL is not set in Script Properties. Cannot send approval email.");
    // Clean up stored property as email cannot be sent
    PropertiesService.getScriptProperties().deleteProperty(propKey);
    throw new Error('Approval email recipient is not configured in the script settings.');
  }

  // Compose and send the approval email
  const subject = `CV Sorter Approval Required: ${outputName}`;
  const formattedTimestamp = timestamp.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
  const keyList = keys.length > 50 ? keys.slice(0, 50).join('\n') + `\n... (${keys.length - 50} more)` : keys.join('\n'); // Show limited keys
  const body = `
    A CV sorter request from ${userEmail} requires your approval.

    Timestamp: ${formattedTimestamp}
    Output Name: ${outputName}
    Output Type: ${outputType}
    Requested By: ${userEmail}
    Number of CVs: ${keys.length}

    Requested CV Keys (Preview):
    --------------------------
    ${keyList}
    --------------------------

    To APPROVE this request and generate the files/folder, click the link below:
    ${approvalLink}

    If you do not approve, please ignore this email. The request data will eventually expire or can be manually deleted from script properties (Key: ${propKey}).
  `;

  try {
      MailApp.sendEmail(approvalEmail, subject, body);
  } catch (mailErr) {
      Logger.log(`ERROR: Failed to send approval email to ${approvalEmail}: ${mailErr.message}`);
      // Clean up stored property as email failed
       PropertiesService.getScriptProperties().deleteProperty(propKey);
      throw new Error(`Failed to send approval email: ${mailErr.message}`);
  }


  // Log the request initiation to the spreadsheet
  logRequest(
    timestamp,
    userEmail,
    outputName,
    outputType,
    `${keys.length} keys (Pending Approval)`, // Note pending status
    'Approval Sent',
    `Request ID: ${requestId}`
  );

  // Return status to the frontend
  return {
    status: 'approval_sent', // Use a distinct status for the frontend to check
    message: 'Your request has been sent for admin approval. You will be notified separately if approved.'
  };
}


/**
 * Main processing logic: fetches CV files based on keys and generates the specified output (GDrive folder or ZIP).
 * @param {object} requestData - The request object containing keys, outputName, outputType, userEmail.
 * @returns {object} A result object with status, URLs/links, errors, and processed keys.
 */
function processRequest(requestData) {
  const { keys, outputName, outputType, userEmail } = requestData;
  const errors = []; // Collect errors encountered during processing
  const processedKeys = []; // Keep track of keys successfully processed
  const cvBlobs = {}; // Store fetched file blobs: { originalFilename: Blob }

  // 1. Get the mapping from CV Key -> {link, filename}
  let cvMap;
  try {
    cvMap = getCvLinksMap(); // This function reads and parses CVlinks.csv
  } catch (mapErr) {
    // If reading the index fails, it's a critical error
    throw new Error(`Failed to load CV index data: ${mapErr.message}`);
  }

  // 2. Filter requested keys and fetch corresponding CV files from Google Drive
  keys.forEach(key => {
    const fileData = cvMap.get(key.toUpperCase()); // Ensure lookup key is uppercase
    if (!fileData) {
      errors.push(`Key not found in CV index: "${key}"`);
      return; // Skip this key
    }

    try {
      // Extract the Google Drive File ID from the link
      const fileId = extractDriveIdFromUrl(fileData.link);
      if (!fileId) {
        throw new Error(`Could not extract File ID from link: ${fileData.link}`);
      }
      // Access the file and get its content as a Blob
      const file = DriveApp.getFileById(fileId);
      // IMPORTANT: Set the Blob's name to the original filename for correct ZIP/GDrive naming
      const blob = file.getBlob().setName(fileData.filename);
      cvBlobs[fileData.filename] = blob; // Store blob using filename as key
      processedKeys.push(key); // Mark this key as successfully processed
    } catch (fetchErr) {
      // Catch errors during file access (permissions, deleted file, invalid ID, etc.)
      errors.push(`Failed to fetch file for key "${key}" (Filename: ${fileData.filename}): ${fetchErr.message}`);
      Logger.log(`Error fetching file ID ${extractDriveIdFromUrl(fileData.link)} for key ${key}: ${fetchErr}`);
    }
  });

  // If no files could be fetched at all, stop processing
  if (Object.keys(cvBlobs).length === 0) {
     logRequest(new Date(), userEmail, outputName, outputType, 'None', 'Error: No CVs Fetched', JSON.stringify(errors));
     // Return an error status - different from throwing an error which stops execution earlier
     return {
         status: 'error',
         message: 'No valid CV files could be fetched for the provided keys.',
         errors: errors,
         processedKeys: []
     };
  }

  // 3. Generate the requested output type (GDrive folder or ZIP file(s))
  let result;
  if (outputType === 'gdrive') {
    result = createGDriveOutput(cvBlobs, outputName, userEmail, processedKeys, errors);
  } else if (outputType === 'zip') {
    result = createZipOutput(cvBlobs, outputName, userEmail, processedKeys, errors);
  } else {
    // Should not happen if frontend validation is correct, but handle defensively
    throw new Error(`Invalid outputType specified: ${outputType}`);
  }

  // Return the result object from the output function
  return result;
}

/**
 * Creates a Google Drive folder and copies the fetched CV blobs into it.
 * @param {Object.<string, Blob>} cvBlobs - Object mapping filename to Blob.
 * @param {string} outputName - Desired name for the new folder.
 * @param {string} userEmail - Email of the user requesting the action (for logging).
 * @param {string[]} processedKeys - Array of keys successfully fetched.
 * @param {string[]} errors - Array to append any new errors to.
 * @returns {object} Result object including status, folder URL, errors, processed keys.
 */
function createGDriveOutput(cvBlobs, outputName, userEmail, processedKeys, errors) {
  const parentFolderId = PropertiesService.getScriptProperties().getProperty('GDRIVE_OUTPUT_PARENT_ID');
  if (!parentFolderId) {
    throw new Error('GDRIVE_OUTPUT_PARENT_ID (Parent folder for output) is not configured in script properties.');
  }

  let parentFolder;
  try {
      parentFolder = DriveApp.getFolderById(parentFolderId);
  } catch (folderErr) {
      throw new Error(`Could not access configured Parent Output Folder (ID: ${parentFolderId}): ${folderErr.message}`);
  }

  let newFolder;
  try {
      // Sanitize output name slightly for folder creation
      const folderName = outputName.replace(/[\\/:"*?<>|]/g, '_'); // Replace invalid chars
      newFolder = parentFolder.createFolder(folderName);
  } catch (createFolderErr) {
      throw new Error(`Could not create output folder "${outputName}" in parent folder: ${createFolderErr.message}`);
  }


  // Copy each fetched CV blob into the new folder
  for (const filename in cvBlobs) {
    try {
      // Use the filename stored in the blob's name property
      newFolder.createFile(cvBlobs[filename]);
    } catch (copyErr) {
      errors.push(`Failed to copy file "${filename}" to new folder: ${copyErr.message}`);
      Logger.log(`Error copying blob ${filename} to folder ${newFolder.getName()}: ${copyErr}`);
    }
  }

  let folderUrl = 'N/A';
  try {
      // Set sharing to anyone with the link can view (adjust if needed)
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      folderUrl = newFolder.getUrl();
  } catch (shareErr) {
      errors.push(`Could not set sharing settings for folder "${newFolder.getName()}": ${shareErr.message}`);
      Logger.log(`Error setting sharing for folder ${newFolder.getId()}: ${shareErr}`);
      folderUrl = `Error setting sharing (Folder ID: ${newFolder.getId()})`; // Provide ID for manual check
  }


  // Log the outcome
  logRequest(
    new Date(),
    userEmail,
    outputName,
    'gdrive',
    processedKeys.join(', '), // Log processed keys
    errors.length === 0 ? 'Success' : 'Success with Errors', // Indicate if errors occurred
    JSON.stringify({ folderUrl: folderUrl, errors: errors }) // Log URL and errors
  );

  return {
    status: 'success', // Overall status is success, check errors array for details
    folderUrl: folderUrl,
    errors: errors, // Include any errors that occurred during file copying or sharing
    processedKeys: processedKeys
  };
}

/**
 * Creates one or more ZIP files containing the fetched CV blobs. Splits into multiple zips if size exceeds limit.
 * @param {Object.<string, Blob>} cvBlobs - Object mapping filename to Blob.
 * @param {string} outputName - Base name for the ZIP file(s).
 * @param {string} userEmail - Email of the user requesting the action (for logging).
 * @param {string[]} processedKeys - Array of keys successfully fetched.
 * @param {string[]} errors - Array to append any new errors to.
 * @returns {object} Result object including status, array of download URLs, errors, processed keys.
 */
function createZipOutput(cvBlobs, outputName, userEmail, processedKeys, errors) {
  const tempFolderId = PropertiesService.getScriptProperties().getProperty('TEMP_ZIP_FOLDER_ID');
  if (!tempFolderId) {
    throw new Error('TEMP_ZIP_FOLDER_ID (Folder for temporary ZIPs) is not configured in script properties.');
  }

  let tempFolder;
   try {
      tempFolder = DriveApp.getFolderById(tempFolderId);
  } catch (folderErr) {
      throw new Error(`Could not access configured Temp ZIP Folder (ID: ${tempFolderId}): ${folderErr.message}`);
  }

  // --- ZIP Splitting Logic ---
  const MAX_ZIP_SIZE_MB = 45; // Increased limit slightly, monitor GAS quotas
  const MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024;
  const allBlobs = Object.values(cvBlobs); // Get blobs as an array
  const zipBlobs = []; // To store the generated zip blobs
  let currentZipFiles = [];
  let currentZipSize = 0;

  allBlobs.forEach(blob => {
    const blobSize = blob.getBytes().length;

     // If adding this blob exceeds the limit AND the current zip isn't empty, finalize the current zip first.
     if (currentZipFiles.length > 0 && (currentZipSize + blobSize) > MAX_ZIP_SIZE_BYTES) {
       try {
         zipBlobs.push(Utilities.zip(currentZipFiles, `temp_zip_${zipBlobs.length}.zip`)); // Temporary name
       } catch (zipError) {
           errors.push(`Error creating ZIP part ${zipBlobs.length + 1}: ${zipError.message}`);
           Logger.log(`Error zipping files (part ${zipBlobs.length + 1}): ${zipError}`);
       }
       currentZipFiles = []; // Reset for the next zip
       currentZipSize = 0;
     }

     // Add the blob to the current zip (if it fits or if it's the first file)
     // Also check if individual file exceeds limit (though unlikely for PDFs)
     if (blobSize <= MAX_ZIP_SIZE_BYTES) {
        currentZipFiles.push(blob);
        currentZipSize += blobSize;
     } else {
         errors.push(`Skipped large file "${blob.getName()}" (${(blobSize / 1024 / 1024).toFixed(1)}MB) - exceeds single file limit for zipping.`);
         Logger.log(`Skipped large file ${blob.getName()} (${blobSize} bytes)`);
     }
  });

  // Add the last batch of files if any remain
  if (currentZipFiles.length > 0) {
     try {
        zipBlobs.push(Utilities.zip(currentZipFiles, `temp_zip_${zipBlobs.length}.zip`));
     } catch (zipError) {
         errors.push(`Error creating final ZIP part ${zipBlobs.length + 1}: ${zipError.message}`);
         Logger.log(`Error zipping final files (part ${zipBlobs.length + 1}): ${zipError}`);
     }
  }

  // --- Save ZIPs and Generate Links ---
  const downloadUrls = [];
  const sanitizedOutputName = outputName.replace(/[\\/:"*?<>|]/g, '_'); // Sanitize base name

  zipBlobs.forEach((blob, index) => {
    // Determine filename for this part
    const partName = (zipBlobs.length > 1) ?
      `${sanitizedOutputName}_part${index + 1}_of_${zipBlobs.length}.zip` :
      `${sanitizedOutputName}.zip`;

    try {
      // Create the ZIP file in the temporary Drive folder
      const file = tempFolder.createFile(blob.setName(partName));
      // Set sharing so the link works for anyone
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      // Construct the direct download URL
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.getId()}`;
      downloadUrls.push(downloadUrl);
      Logger.log(`Created ZIP: ${partName}, URL: ${downloadUrl}`);
    } catch (saveErr) {
      errors.push(`Failed to save or share ZIP part ${index + 1} ("${partName}"): ${saveErr.message}`);
      Logger.log(`Error saving/sharing zip ${partName}: ${saveErr}`);
    }
  });

   // If no URLs were generated due to errors saving zips
   if (downloadUrls.length === 0 && errors.length > 0) {
        logRequest(new Date(), userEmail, outputName, 'zip', processedKeys.join(', '), 'Error: ZIP Creation Failed', JSON.stringify(errors));
        return { status: 'error', message: 'Failed to create ZIP files.', errors: errors, processedKeys: processedKeys };
   }


  // Log the outcome
  logRequest(
    new Date(),
    userEmail,
    outputName,
    'zip',
    processedKeys.join(', '),
    errors.length === 0 ? 'Success' : 'Success with Errors',
    JSON.stringify({ downloadUrls: downloadUrls, errors: errors })
  );

  return {
    status: 'success', // Even if some files failed to save, the overall operation might partially succeed
    downloadUrls: downloadUrls,
    errors: errors,
    processedKeys: processedKeys
  };
}


// +----------------------------------------------------------------------+
// | HELPER FUNCTIONS                                                     |
// +----------------------------------------------------------------------+

/**
 * Creates a JSON response object formatted for ContentService with CORS headers.
 * @param {object} data - The JavaScript object to stringify and send.
 * @param {string} origin - The allowed origin ('*' or specific URL) for the Access-Control-Allow-Origin header.
 * @returns {ContentService.TextOutput} The response object.
 */
function createJsonResponse(data, origin) {
  // Ensure origin is valid or fallback safely
  const allowedOriginsProperty = PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGINS');
  const allowedOrigins = allowedOriginsProperty ? allowedOriginsProperty.split(',') : [];
  // Use the origin if it's allowed, otherwise fallback to the first allowed origin or '*'
  const responseOrigin = (origin && allowedOrigins.includes(origin)) ? origin : (allowedOrigins[0] || '*');

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .withHeaders({ // Use withHeaders for setting multiple headers
      'Access-Control-Allow-Origin': responseOrigin
      // No need to explicitly add Allow-Methods or Allow-Headers to the *response* of a POST
      // They are needed in the response to the *OPTIONS* preflight request.
    });
}


/**
 * Appends a log entry to the configured Google Sheet. Includes error handling.
 * @param {Date} timestamp - The time of the event.
 * @param {string} userEmail - Email of the user initiating the action.
 * @param {string} outputName - Name provided for the output.
 * @param {string} outputType - 'gdrive' or 'zip'.
 * @param {string} processedKeysInfo - Summary of keys processed (e.g., count or comma-separated list).
 * @param {string} status - 'Success', 'Success with Errors', 'Error', 'Approval Sent', etc.
 * @param {string} details - Additional info (e.g., URL, error message, request ID). Max length ~50k chars.
 */
function logRequest(timestamp, userEmail, outputName, outputType, processedKeysInfo, status, details) {
  try {
    const logSheetId = PropertiesService.getScriptProperties().getProperty('LOG_SHEET_ID');
    if (!logSheetId) {
      Logger.log('Logging Error: LOG_SHEET_ID is not configured in script properties.');
      return; // Cannot log without sheet ID
    }

    let sheet;
    try {
        const ss = SpreadsheetApp.openById(logSheetId);
        sheet = ss.getSheetByName('Logs');
        if (!sheet) {
            // If 'Logs' sheet doesn't exist, try the first sheet or create 'Logs'
            sheet = ss.getSheets()[0] || ss.insertSheet('Logs');
            Logger.log("Log sheet 'Logs' not found, using first sheet or creating it.");
        }
    } catch (sheetErr) {
        Logger.log(`CRITICAL: Failed to open or access log sheet (ID: ${logSheetId}): ${sheetErr.message}`);
        return; // Cannot log if sheet is inaccessible
    }

    // Define header row content
    const header = ['Timestamp', 'User Email', 'Output Name', 'Output Type', 'Processed Keys Info', 'Status', 'Details/Link'];

    // Check if the sheet is empty or if the first row is not the header
    if (sheet.getLastRow() < 1 || sheet.getRange(1, 1, 1, header.length).getValues()[0].join('') !== header.join('')) {
      // Make sure there's space if sheet isn't empty but header is missing/wrong
      if(sheet.getLastRow() > 0) {
        sheet.insertRowBefore(1); // Add a new row at the top
      }
      sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold'); // Set header
      Logger.log('Log sheet header row created or fixed.');
    }

    // Truncate details if too long (Sheet cell limit is ~50k chars)
    const maxDetailLength = 49000;
    const truncatedDetails = (details && details.length > maxDetailLength)
        ? details.substring(0, maxDetailLength) + '... [TRUNCATED]'
        : details;

    // Append the log data
    sheet.appendRow([
      timestamp, // Use Date object directly, Sheet formats it
      userEmail || 'N/A',
      outputName || 'N/A',
      outputType || 'N/A',
      processedKeysInfo || 'N/A',
      status || 'Unknown',
      truncatedDetails || ''
    ]);

  } catch (e) {
    // Log any error during the logging process itself
    Logger.log(`CRITICAL: Failed to write log entry to sheet: ${e.message}\nLog Data: ${JSON.stringify({timestamp, userEmail, outputName, status})}`);
  }
}


/**
 * Reads the CVlinks.csv file from Google Drive and returns a Map for easy lookup.
 * @returns {Map<string, {link: string, filename: string}>} Map where key = "ROLLNUMBER VARIANT" (UPPERCASE) and value = { link, filename }.
 * @throws {Error} If CSV ID is not set or file cannot be read/parsed.
 */
function getCvLinksMap() {
  const csvFileId = PropertiesService.getScriptProperties().getProperty('CV_LINKS_CSV_ID');
  if (!csvFileId) {
    throw new Error('CV_LINKS_CSV_ID is not configured in script properties.');
  }

  let file;
  try {
      file = DriveApp.getFileById(csvFileId);
  } catch (driveErr) {
      throw new Error(`Cannot access CV Links CSV file (ID: ${csvFileId}). Check ID and permissions: ${driveErr.message}`);
  }

  const csvData = file.getBlob().getDataAsString();
  if (!csvData || csvData.trim().length === 0) {
      throw new Error(`CV Links CSV file (ID: ${csvFileId}) is empty.`);
  }

  // Use Utilities.parseCsv for more robust CSV handling (quotes, commas within fields)
  const parsedData = Utilities.parseCsv(csvData);
  const cvMap = new Map();
  // Regex to match the desired key format (e.g., "24BC123 A") - Case Insensitive, anywhere in the string
  // It captures the RollNumber-Variant part
  const keyRegex = /(\d{2}[A-Z]{2}\d{3}\s[A-C])/i;

  // Start from row 1 assuming row 0 is the header
  let skippedRows = 0;
  for (let i = 1; i < parsedData.length; i++) {
    const row = parsedData[i];
    // Check if row has enough columns (at least filename and link)
    if (row.length < 2) {
        skippedRows++;
        continue;
    }
    const filename = row[0]?.trim();
    const link = row[1]?.trim();

    // Basic validation
    if (!filename || !link ) { // Removed the .pdf check, filename format varies
      // Logger.log(`Skipping invalid row ${i + 1} in CSV: Missing filename or link. Content: ${row.join(',')}`);
      skippedRows++;
      continue;
    }

    // Extract the key using regex from the filename
    const keyMatch = filename.match(keyRegex);
    if (keyMatch && keyMatch[1]) {
        const key = keyMatch[1].toUpperCase(); // Standardize key to uppercase
        if (cvMap.has(key)) {
            // Logger.log(`Warning: Duplicate key "${key}" found in CSV row ${i + 1} (File: ${filename}). Keeping the first entry found.`);
             skippedRows++; // Count duplicates as skipped
        } else {
            cvMap.set(key, {
                link: link,
                filename: filename // Store original filename
            });
        }
    } else {
        // Logger.log(`Skipping row ${i + 1}: Could not extract valid key (##AA### A/B/C) from filename "${filename}"`);
        skippedRows++;
    }
  }

  if (cvMap.size === 0) {
    throw new Error(`No valid data (Filename containing pattern like '24BC123 A', Link) found in CVlinks.csv (ID: ${csvFileId}). ${skippedRows} rows were skipped or invalid.`);
  }
  Logger.log(`Loaded ${cvMap.size} unique CV links from index. Skipped ${skippedRows} rows (invalid format, missing data, or duplicates).`);
  return cvMap;
}


/**
 * Extracts a Google Drive file ID from various common URL formats.
 * @param {string} url - The Google Drive URL (file view, download link, etc.).
 * @returns {string|null} The extracted file ID or null if not found.
 */
function extractDriveIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  let match;

  // 1. Matches '/file/d/FILE_ID/...' or '/d/FILE_ID/...' (Most common view/edit links)
  // Ensure FILE_ID is captured correctly, allowing for trailing slashes or query params
  match = url.match(/(?:\/d\/|\/file\/d\/)([-\w]{25,})(?:[\/?]|$)/);
  if (match && match[1]) return match[1];

  // 2. Matches '...?id=FILE_ID...' or '&id=FILE_ID...' (Common in sharing links, uc links)
  // Look for 'id=' followed by the ID characters
  match = url.match(/[?&]id=([-\w]{25,})/);
  if (match && match[1]) return match[1];

  // 3. Matches '/open?id=FILE_ID' (Less common, but possible)
   match = url.match(/\/open\?id=([-\w]{25,})/);
  if (match && match[1]) return match[1];

  // Note: /uc? links are typically covered by pattern 2

   Logger.log(`Could not extract Drive ID from URL: ${url}`); // Log failures if needed
  return null; // ID not found in common patterns
}


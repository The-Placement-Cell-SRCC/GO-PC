/**
 * CV Sorter Backend - Google Apps Script
 * CRITICAL: All setHeader calls must be separate, not chained
 */

// ============================================
// WEB APP ENTRY POINTS (MUST BE FIRST!)
// ============================================

/**
 * Handles CORS preflight OPTIONS requests
 */
function doOptions(e) {
  Logger.log('doOptions called');
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Handles GET requests
 */
function doGet(e) {
  Logger.log('doGet called');
  
  if (!e || !e.parameter) {
    return HtmlService.createHtmlOutput(
      '<h1>GO-PC CV Sorter Backend</h1>' +
      '<p>✅ This Apps Script is running correctly.</p>' +
      '<p>CORS should be working now.</p>'
    );
  }

  try {
    if (e.parameter.action === 'approve' && e.parameter.id) {
      return handleApprovalCallback(e.parameter.id);
    }
    return HtmlService.createHtmlOutput('<h1>Invalid request</h1>');
  } catch (err) {
    Logger.log('doGet Error: ' + err.message);
    return HtmlService.createHtmlOutput('<h1>Error</h1><p>' + err.message + '</p>');
  }
}

/**
 * Handles POST requests from frontend
 */
function doPost(e) {
  Logger.log('doPost called');
  
  var requestData;
  var responseData = {};

  try {
    // Check if payload is in parameter (FormData) or postData (JSON)
    if (e.parameter && e.parameter.payload) {
      Logger.log('Received FormData payload');
      requestData = JSON.parse(e.parameter.payload);
    } else if (e.postData && e.postData.contents) {
      Logger.log('Received JSON payload');
      requestData = JSON.parse(e.postData.contents);
    } else {
      throw new Error('No payload received');
    }
    
    Logger.log('Parsed request data: ' + JSON.stringify(requestData));

    // Validate
    var keys = requestData.keys;
    var outputName = requestData.outputName;
    var outputType = requestData.outputType;
    var userEmail = requestData.userEmail;
    
    if (!keys || !outputName || !outputType || !userEmail) {
      throw new Error('Missing required parameters');
    }
    
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error('Keys must be a non-empty array');
    }

    // Check approval requirement
    var requireApproval = PropertiesService.getScriptProperties()
      .getProperty('REQUIRE_APPROVAL') === 'true';

    if (requireApproval) {
      responseData = handleApprovalRequest(requestData);
    } else {
      responseData = processRequest(requestData);
    }

  } catch (err) {
    Logger.log('doPost Error: ' + err.message);
    Logger.log('Stack: ' + err.stack);
    responseData = { 
      status: 'error', 
      message: err.message 
    };
  }

  // Return JSON with CORS - NO CHAINING
  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// ADMIN CONFIGURATION FUNCTIONS
// ============================================

function setup() {
  var config = {
    'CV_LINKS_CSV_ID': '1aSh1DeUGihTnVUiKbuXu3VLbsoT0uQyf',
    'LOG_SHEET_ID': '1k2w99k58l4T6NIWbqjUrhuM6YPiAy94j_0Ssv0Xgb0k',
    'GDRIVE_OUTPUT_PARENT_ID': '17zXnLxH6q5se-kmQTiiO6Ov9quw1VYZ8',
    'TEMP_ZIP_FOLDER_ID': '1Qrf03gYySfML9HOR8Oi5ZWs4h-xWgtaF',
    'ADMIN_EMAIL': 'fns.placementcell@srcc.du.ac.in',
    'APPROVAL_EMAIL': 'kohliashish12@gmail.com',
    'REQUIRE_APPROVAL': 'false'
  };
  
  PropertiesService.getScriptProperties().setProperties(config);
  Logger.log('✅ Setup complete');
  Logger.log('Web App URL: ' + ScriptApp.getService().getUrl());
}

function setApproval(required) {
  PropertiesService.getScriptProperties()
    .setProperty('REQUIRE_APPROVAL', String(required));
  Logger.log('Approval set to: ' + required);
}

function viewLogs() {
  var logSheetId = PropertiesService.getScriptProperties().getProperty('LOG_SHEET_ID');
  var url = 'https://docs.google.com/spreadsheets/d/' + logSheetId + '/edit';
  Logger.log('Log Sheet URL: ' + url);
  return url;
}

// ============================================
// CORE LOGIC FUNCTIONS
// ============================================

function handleApprovalCallback(approvalId) {
  var propKey = 'REQ_' + approvalId;
  var requestDataJson = PropertiesService.getScriptProperties().getProperty(propKey);
  
  if (!requestDataJson) {
    return HtmlService.createHtmlOutput('<h1>Request Not Found</h1>');
  }

  try {
    PropertiesService.getScriptProperties().deleteProperty(propKey);
    var requestData = JSON.parse(requestDataJson);
    var result = processRequest(requestData);
    
    logRequest(
      new Date(),
      requestData.userEmail,
      requestData.outputName,
      requestData.outputType,
      result.processedKeys ? result.processedKeys.join(', ') : 'N/A',
      'Success (Approved)',
      JSON.stringify(result)
    );

    return HtmlService.createHtmlOutput(
      '<h1>✅ Request Approved & Processed</h1>' +
      '<p>Status: ' + result.status + '</p>'
    );
  } catch (err) {
    Logger.log('Approval Error: ' + err.message);
    return HtmlService.createHtmlOutput('<h1>Error</h1><p>' + err.message + '</p>');
  }
}

function handleApprovalRequest(requestData) {
  var requestId = Utilities.getUuid();
  var propKey = 'REQ_' + requestId;
  var timestamp = new Date();
  
  var pendingRequest = {
    keys: requestData.keys,
    outputName: requestData.outputName,
    outputType: requestData.outputType,
    userEmail: requestData.userEmail,
    timestamp: timestamp.toISOString(),
    requestId: requestId
  };
  
  PropertiesService.getScriptProperties().setProperty(propKey, JSON.stringify(pendingRequest));
  
  var webAppUrl = ScriptApp.getService().getUrl();
  var approvalLink = webAppUrl + '?action=approve&id=' + requestId;
  var approvalEmail = PropertiesService.getScriptProperties().getProperty('APPROVAL_EMAIL');
  
  if (!approvalEmail) {
    throw new Error('APPROVAL_EMAIL not configured');
  }
  
  var subject = 'CV Sorter Approval Required: ' + requestData.outputName;
  var body = 
    'Request from: ' + requestData.userEmail + '\n' +
    'Output Name: ' + requestData.outputName + '\n' +
    'Number of CVs: ' + requestData.keys.length + '\n\n' +
    'Approval Link: ' + approvalLink;
  
  MailApp.sendEmail(approvalEmail, subject, body);
  
  logRequest(
    timestamp,
    requestData.userEmail,
    requestData.outputName,
    requestData.outputType,
    requestData.keys.length + ' keys (Pending)',
    'Approval Sent',
    'Request ID: ' + requestId
  );
  
  return {
    status: 'approval_sent',
    message: 'Request sent for approval'
  };
}

function processRequest(requestData) {
  var keys = requestData.keys;
  var outputName = requestData.outputName;
  var outputType = requestData.outputType;
  var userEmail = requestData.userEmail;
  var errors = [];
  var processedKeys = [];
  var cvBlobs = {};

  try {
    var cvMap = getCvLinksMap();
    
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var fileData = cvMap.get(key.toUpperCase());
      
      if (!fileData) {
        errors.push('Key not found: ' + key);
        continue;
      }

      try {
        var fileId = extractDriveIdFromUrl(fileData.link);
        if (!fileId) {
          throw new Error('Invalid file link');
        }
        
        var file = DriveApp.getFileById(fileId);
        var blob = file.getBlob().setName(fileData.filename);
        cvBlobs[fileData.filename] = blob;
        processedKeys.push(key);
      } catch (fetchErr) {
        errors.push('Failed to fetch: ' + key + ' - ' + fetchErr.message);
      }
    }

    if (Object.keys(cvBlobs).length === 0) {
      logRequest(new Date(), userEmail, outputName, outputType, 'None', 'Error', 'No CVs fetched');
      return {
        status: 'error',
        message: 'No valid CV files could be fetched',
        errors: errors,
        processedKeys: []
      };
    }

    var result;
    if (outputType === 'gdrive') {
      result = createGDriveOutput(cvBlobs, outputName, userEmail, processedKeys, errors);
    } else if (outputType === 'zip') {
      result = createZipOutput(cvBlobs, outputName, userEmail, processedKeys, errors);
    } else {
      throw new Error('Invalid outputType: ' + outputType);
    }

    return result;
    
  } catch (err) {
    Logger.log('Process Error: ' + err.message);
    throw err;
  }
}

function createGDriveOutput(cvBlobs, outputName, userEmail, processedKeys, errors) {
  var parentFolderId = PropertiesService.getScriptProperties()
    .getProperty('GDRIVE_OUTPUT_PARENT_ID');
  
  if (!parentFolderId) {
    throw new Error('GDRIVE_OUTPUT_PARENT_ID not configured');
  }

  var parentFolder = DriveApp.getFolderById(parentFolderId);
  var folderName = outputName.replace(/[\\/:*?"<>|]/g, '_');
  var newFolder = parentFolder.createFolder(folderName);

  for (var filename in cvBlobs) {
    try {
      newFolder.createFile(cvBlobs[filename]);
    } catch (copyErr) {
      errors.push('Failed to copy: ' + filename);
    }
  }

  newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var folderUrl = newFolder.getUrl();

  logRequest(
    new Date(),
    userEmail,
    outputName,
    'gdrive',
    processedKeys.join(', '),
    errors.length === 0 ? 'Success' : 'Success with Errors',
    JSON.stringify({ folderUrl: folderUrl, errors: errors })
  );

  return {
    status: 'success',
    folderUrl: folderUrl,
    errors: errors,
    processedKeys: processedKeys
  };
}

function createZipOutput(cvBlobs, outputName, userEmail, processedKeys, errors) {
  var tempFolderId = PropertiesService.getScriptProperties()
    .getProperty('TEMP_ZIP_FOLDER_ID');
  
  if (!tempFolderId) {
    throw new Error('TEMP_ZIP_FOLDER_ID not configured');
  }

  var tempFolder = DriveApp.getFolderById(tempFolderId);
  var MAX_ZIP_SIZE_MB = 45;
  var MAX_ZIP_SIZE_BYTES = MAX_ZIP_SIZE_MB * 1024 * 1024;
  
  var allBlobs = [];
  for (var fname in cvBlobs) {
    allBlobs.push(cvBlobs[fname]);
  }
  
  var zipBlobs = [];
  var currentZipFiles = [];
  var currentZipSize = 0;

  for (var i = 0; i < allBlobs.length; i++) {
    var blob = allBlobs[i];
    var blobSize = blob.getBytes().length;
    
    if (currentZipFiles.length > 0 && (currentZipSize + blobSize) > MAX_ZIP_SIZE_BYTES) {
      try {
        zipBlobs.push(Utilities.zip(currentZipFiles, 'temp_' + zipBlobs.length + '.zip'));
      } catch (zipError) {
        errors.push('Error creating ZIP part ' + (zipBlobs.length + 1));
      }
      currentZipFiles = [];
      currentZipSize = 0;
    }

    if (blobSize <= MAX_ZIP_SIZE_BYTES) {
      currentZipFiles.push(blob);
      currentZipSize += blobSize;
    } else {
      errors.push('File too large: ' + blob.getName());
    }
  }

  if (currentZipFiles.length > 0) {
    try {
      zipBlobs.push(Utilities.zip(currentZipFiles, 'temp_' + zipBlobs.length + '.zip'));
    } catch (zipError) {
      errors.push('Error creating final ZIP');
    }
  }

  var downloadUrls = [];
  var sanitizedName = outputName.replace(/[\\/:*?"<>|]/g, '_');

  for (var j = 0; j < zipBlobs.length; j++) {
    var blob = zipBlobs[j];
    var partName = (zipBlobs.length > 1) ?
      sanitizedName + '_part' + (j + 1) + '_of_' + zipBlobs.length + '.zip' :
      sanitizedName + '.zip';

    try {
      var file = tempFolder.createFile(blob.setName(partName));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + file.getId();
      downloadUrls.push(downloadUrl);
    } catch (saveErr) {
      errors.push('Failed to save ZIP part ' + (j + 1));
    }
  }

  if (downloadUrls.length === 0) {
    logRequest(new Date(), userEmail, outputName, 'zip', processedKeys.join(', '), 
               'Error', 'ZIP creation failed');
    return { 
      status: 'error', 
      message: 'Failed to create ZIP files', 
      errors: errors 
    };
  }

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
    status: 'success',
    downloadUrls: downloadUrls,
    errors: errors,
    processedKeys: processedKeys
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function logRequest(timestamp, userEmail, outputName, outputType, processedKeysInfo, status, details) {
  try {
    var logSheetId = PropertiesService.getScriptProperties().getProperty('LOG_SHEET_ID');
    if (!logSheetId) return;

    var ss = SpreadsheetApp.openById(logSheetId);
    var sheet = ss.getSheetByName('Logs');
    
    if (!sheet) {
      sheet = ss.getSheets()[0] || ss.insertSheet('Logs');
    }

    if (sheet.getLastRow() < 1) {
      sheet.appendRow(['Timestamp', 'User Email', 'Output Name', 'Output Type', 
                       'Processed Keys', 'Status', 'Details']);
    }

    var maxDetailLength = 49000;
    var truncatedDetails = (details && details.length > maxDetailLength) ?
      details.substring(0, maxDetailLength) + '... [TRUNCATED]' : (details || '');

    sheet.appendRow([
      timestamp,
      String(userEmail || 'N/A'),
      String(outputName || 'N/A'),
      String(outputType || 'N/A'),
      String(processedKeysInfo || 'N/A'),
      String(status || 'Unknown'),
      String(truncatedDetails)
    ]);
  } catch (e) {
    Logger.log('Logging Error: ' + e.message);
  }
}

function getCvLinksMap() {
  var csvFileId = PropertiesService.getScriptProperties().getProperty('CV_LINKS_CSV_ID');
  if (!csvFileId) {
    throw new Error('CV_LINKS_CSV_ID not configured');
  }

  var file = DriveApp.getFileById(csvFileId);
  var csvData = file.getBlob().getDataAsString();
  
  if (!csvData || csvData.trim().length === 0) {
    throw new Error('CSV file is empty');
  }

  var parsedData = Utilities.parseCsv(csvData);
  var cvMap = new Map();
  var keyRegex = /(\d{2}[A-Z]{2}\d{3}\s[A-C])/i;

  for (var i = 1; i < parsedData.length; i++) {
    var row = parsedData[i];
    if (!row || row.length < 2) continue;
    
    var filename = row[0] ? row[0].trim() : '';
    var link = row[1] ? row[1].trim() : '';
    
    if (!filename || !link) continue;

    var keyMatch = filename.match(keyRegex);
    if (keyMatch && keyMatch[1]) {
      var key = keyMatch[1].toUpperCase();
      if (!cvMap.has(key)) {
        cvMap.set(key, { link: link, filename: filename });
      }
    }
  }

  if (cvMap.size === 0) {
    throw new Error('No valid CV data found in CSV');
  }

  Logger.log('Loaded ' + cvMap.size + ' CV links');
  return cvMap;
}

function extractDriveIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  var match;
  match = url.match(/(?:\/d\/|\/file\/d\/)([-\w]{25,})(?:[\/?]|$)/);
  if (match && match[1]) return match[1];

  match = url.match(/[?&]id=([-\w]{25,})/);
  if (match && match[1]) return match[1];

  match = url.match(/\/open\?id=([-\w]{25,})/);
  if (match && match[1]) return match[1];

  return null;
}
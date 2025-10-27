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
    'APPROVAL_EMAIL': 'srcc.pc.fns2526@gmail.com',
    'REQUIRE_APPROVAL': 'true'
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
    return HtmlService.createHtmlOutput(
      '<h1>Request Not Found</h1>' +
      '<p>This approval link is invalid, has expired, or the request has already been processed.</p>'
    );
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

    // Send email notification to the user who requested it
    var userEmail = requestData.userEmail;
    var outputType = requestData.outputType;
    var outputName = requestData.outputName;
    
    var emailSubjecttouser = 'CV Sorter Pull Request || ' + outputName;
    var bodytouser = 'Dear SC,\nGreetings from GO-PC!\nTrust you are doing well.\n\n' +
    'This is to inform you that your CV sorting pull request has been authorised and processed. ' +
    'Please find below the details and Google Drive/ZIP File(s) Link:\n\n';

    bodytouser += 'Output Name: ' + outputName + '\n';
    // bodytouser += 'Output Type: ' + outputType + '\n';
    bodytouser += 'CVs Processed: ' + (result.processedKeys ? result.processedKeys.length : 0) + '\n\n';

    if (result.status === 'success') {
      if (outputType === 'gdrive' && result.folderUrl) {
        bodytouser += 'Google Drive Folder: ' + result.folderUrl + '\n';
      } else if (outputType === 'zip' && result.downloadUrls && result.downloadUrls.length > 0) {
        bodytouser += 'Download ZIP file(s):\n';
        for (var i = 0; i < result.downloadUrls.length; i++) {
          bodytouser += 'Part ' + (i + 1) + ': ' + result.downloadUrls[i] + '\n';
        }
        bodytouser += '\n';
      }
    }

    if (result.errors && result.errors.length > 0) {
      bodytouser += '▲ Errors encountered:\n' + result.errors.join('\n') + '\n\n';
    }

    bodytouser += 'Processed at: ' + new Date().toLocaleString() + '\n';
    bodytouser += 'Warm Regards\nGO-PC';
    
    var htmlBodytouser = `
  <body style="margin: 0; padding: 0; background-color: #1b3055; font-family: 'Trebuchet MS', Arial, sans-serif; -webkit-font-smoothing: antialiased; word-spacing: normal;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 40px 10px; background-color: #1b3055;">
          <!--[if (gte mso 9)|(IE)]>
          <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
          <tr>
          <td align="center" valign="top">
          <![endif]-->
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                
                <h1 style="color: #1b3055; margin-top: 0; margin-bottom: 24px; font-size: 24px; font-weight: bold; text-align: center;">CV Sorter Pull Request</h1>
                
                <p style="margin-bottom: -20px;">Dear SC,</p>
                <p style="margin-bottom: 0px;">Greetings from GO-PC!</p>
                <p style="margin-bottom: 0px;">Trust you are doing well.</p>
                <p style="margin-bottom: 20px;">This is to inform you that your CV sorting pull request has been authorised and processed. Please find the details below:</p>
                
                <!-- Details Table -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; border: 1px solid #eeeeee; border-radius: 4px; border-collapse: separate; overflow: hidden;">
                  <tr>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee; background-color: #f9f9f9; color: #555555; font-weight: bold; width: 40%;">Folder Name:</td>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee; color: #1b3055; font-weight: bold; width: 60%;">${outputName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 15px; background-color: #f9f9f9; color: #555555; font-weight: bold;">CVs Processed:</td>
                    <td style="padding: 12px 15px; color: #1b3055; font-weight: bold;">${result.processedKeys ? result.processedKeys.length : 0}</td>
                  </tr>
                </table>
  `;

  // --- Success Logic ---
  if (result.status === 'success') {
    if (outputType === 'gdrive' && result.folderUrl) {
      // Add Google Drive Button
      htmlBodytouser += `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
          <tr>
            <td align="center">
              <a href="${result.folderUrl}" target="_blank" style="background-color: #1b3055; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px; mso-padding-alt: 0; text-underline-color: #1b3055;">
                <!--[if mso]><i style="letter-spacing: 28px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
                <span style="mso-text-raise: 15pt;">Open Google Drive Folder</span>
                <!--[if mso]><i style="letter-spacing: 28px; mso-font-width: -100%;">&nbsp;</i><![endif]-->
              </a>
            </td>
          </tr>
        </table>
      `;
    } else if (outputType === 'zip' && result.downloadUrls && result.downloadUrls.length > 0) {
      // Add ZIP File Links
      htmlBodytouser += `<h3 style="color: #1b3055; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Download ZIP File(s):</h3>`;
      htmlBodytouser += `<div style="line-height: 1.8; font-size: 15px;">`;
      for (var i = 0; i < result.downloadUrls.length; i++) {
        htmlBodytouser += `
          <p style="margin: 5px 0;">
            <strong style="color: #333;">Part ${i + 1}:</strong> 
            <a href="${result.downloadUrls[i]}" target="_blank" style="color: #1b3055; text-decoration: underline; word-break: break-all;">${result.downloadUrls[i]}</a>
          </p>
        `;
      }
      htmlBodytouser += `</div>`;
    }
  }

  // --- Error Logic ---
  if (result.errors && result.errors.length > 0) {
    htmlBodytouser += `
      <div style="margin-top: 25px; padding: 15px; background-color: #fff0f0; border: 1px solid #e0b4b4; border-radius: 5px; color: #c00;">
        <h3 style="margin-top: 0; margin-bottom: 10px; color: #c00;">▲ Errors Encountered:</h3>
        <p style="margin: 0; line-height: 1.5; font-family: 'Courier New', Courier, monospace; font-size: 14px; word-break: break-all; word-wrap: break-word;">
          ${result.errors.join('<br>')}
        </p>
      </div>
    `;
  }

  // --- Footer and Closing Tags ---
  htmlBodytouser += `
                <p style="margin-top: 40px; margin-bottom: 0; font-size: 14px; color: #555;">Processed at: ${new Date().toLocaleString()}</p>
                <p style="margin-top: 25px; margin-bottom: 0;">Warm Regards</p>
                <p style="margin-top: 5px; margin-bottom: 0;">GO-PC</p>
              </td>
            </tr>
          </table>
          
          <!--[if (gte mso 9)|(IE)]>
          </td>
          </tr>
          </table>
          <![endif]-->
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 20px;">
             <tr>
               <td align="center" style="color: #cccccc; font-size: 12px; padding: 10px; font-family: Arial, sans-serif;">
                 This is an automated message. Please do not reply.
               </td>
             </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  `;
    // Send email to user
    
    GmailApp.sendEmail(userEmail, emailSubjecttouser, bodytouser, {
    htmlBody: htmlBodytouser
    });

    // Build success HTML page for admin
    var detailsHtml = '<li>Status: <strong style="color: green;">' + result.status + '</strong></li>';
    if (result.folderUrl) {
      detailsHtml += '<li>Folder URL: <a href="' + result.folderUrl + '" target="_blank">' + result.folderUrl + '</a></li>';
    }
    if (result.downloadUrls && result.downloadUrls.length > 0) {
      detailsHtml += '<li>ZIP Download URLs:<ul>';
      for (var j = 0; j < result.downloadUrls.length; j++) {
        detailsHtml += '<li><a href="' + result.downloadUrls[j] + '" target="_blank">Part ' + (j + 1) + '</a></li>';
      }
      detailsHtml += '</ul></li>';
    }
    if (result.processedKeys) {
      detailsHtml += '<li>CVs Processed: ' + result.processedKeys.length + '</li>';
    }
    if (result.errors && result.errors.length > 0) {
      detailsHtml += '<li style="color: red;">Errors Encountered (' + result.errors.length + '): <pre>' + result.errors.join('\n') + '</pre></li>';
    }

    return HtmlService.createHtmlOutput(
      '<style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}h1{color:#2e7d32}ul{line-height:1.8}</style>' +
      '<h1>✅ Request Approved & Processed</h1>' +
      '<p>The CV sorting request has been successfully processed and the user has been notified via email.</p>' +
      '<h3>Request Details:</h3>' +
      '<ul>' +
      '<li>User: ' + requestData.userEmail + '</li>' +
      '<li>Output Name: ' + requestData.outputName + '</li>' +
      '<li>Output Type: ' + requestData.outputType + '</li>' +
      '<li>Timestamp: ' + new Date(requestData.timestamp).toLocaleString() + '</li>' +
      '</ul>' +
      '<h3>Processing Results:</h3>' +
      '<ul>' + detailsHtml + '</ul>' +
      '<p style="background:#e8f5e9;padding:15px;border-radius:5px;margin-top:20px">' +
      '📧 A notification email with these details has been sent to <strong>' + userEmail + '</strong></p>'
    );

  } catch (err) {
    Logger.log('Approval Error: ' + err.message);
    Logger.log('Stack: ' + err.stack);
    
    // Try to log error
    try {
      var requestData = JSON.parse(requestDataJson || '{}');
      logRequest(
        new Date(),
        requestData.userEmail || 'Unknown',
        requestData.outputName || 'Unknown',
        requestData.outputType || 'Unknown',
        'N/A',
        'Error: Processing Failed After Approval',
        err.message
      );
    } catch (logErr) {
      Logger.log('Failed to log approval error');
    }
    
    return HtmlService.createHtmlOutput(
      '<style>body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:0 auto}h1{color:#c62828}</style>' +
      '<h1>❌ Error Processing Request</h1>' +
      '<p>Failed to process the request after approval: ' + err.message + '</p>' +
      '<p>Please check the script logs for details or contact the developer.</p>'
    );
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
  
  var subject = 'Authorisation Request || ' + requestData.outputName;
  var htmlBody = `
  <body style="margin: 0; padding: 0; background-color: #1b3055; font-family: 'Trebuchet MS', Arial, sans-serif; -webkit-font-smoothing: antialiased; word-spacing: normal;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding: 40px 10px; background-color: #1b3055;">
          
          <!--[if (gte mso 9)|(IE)]>
          <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
          <tr>
          <td align="center" valign="top">
          <![endif]-->
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding: 40px 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                
                <h1 style="color: #1b3055; margin-top: 0; margin-bottom: 24px; font-size: 24px; font-weight: bold; text-align: center;">CV Sorter Approval Request</h1>
                
                <p style="margin-top: 0; margin-bottom: 20px;">Dear FnS,</p>
                
                <p style="margin-bottom: 25px;">This is to request you to kindly authourise the following CV Sorter Pull Request made by <strong style="color: #1b3055;">${requestData.userEmail}</strong>:</p>
                
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px; border: 1px solid #eeeeee; border-radius: 4px; border-collapse: separate; overflow: hidden;">
                  <tr>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee; background-color: #f9f9f9; color: #555555; font-weight: bold; width: 40%;">Output Name:</td>
                    <td style="padding: 12px 15px; border-bottom: 1px solid #eeeeee; color: #1b3055; font-weight: bold; width: 60%;">${requestData.outputName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 15px; background-color: #f9f9f9; color: #555555; font-weight: bold;">Number of CVs:</td>
                    <td style="padding: 12px 15px; color: #1b3055; font-weight: bold;">${requestData.keys.length}</td>
                  </tr>
                </table>

                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 30px;">
                  <tr>
                    <td align="center">
                      <a href="${approvalLink}" target="_blank" style="background-color: #1b3055; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; font-size: 16px; mso-padding-alt: 0; text-underline-color: #1b3055;">
                        <!--[if mso]><i style="letter-spacing: 28px; mso-font-width: -100%; mso-text-raise: 30pt;">&nbsp;</i><![endif]-->
                        <span style="mso-text-raise: 15pt;">Click to Authorise</span>
                        <!--[if mso]><i style="letter-spacing: 28px; mso-font-width: -100%;">&nbsp;</i><![endif]-->
                      </a>
                    </td>
                  </tr>
                </table>
                
                <p style="margin-top: 40px; margin-bottom: 0;">Warm Regards</p>
                <p style="margin-top: 5px; margin-bottom: 0;">GO-PC</p>
              </td>
            </tr>
          </table>
          
          <!--[if (gte mso 9)|(IE)]>
          </td>
          </tr>
          </table>
          <![endif]-->
          
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin-top: 20px;">
             <tr>
               <td align="center" style="color: #cccccc; font-size: 12px; padding: 10px; font-family: Arial, sans-serif;">
                 This is an automated message. Please do not reply.
               </td>
             </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
  `;
  GmailApp.sendEmail(approvalEmail, subject, "Not Working", {
    htmlBody: htmlBody
  });

  // MailApp.sendEmail({
  //   to: approvalEmail, 
  //   subject: subject,
  //   htmlBody : htmlBody});
  
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
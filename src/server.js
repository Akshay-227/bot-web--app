require('dotenv').config(); // Load environment variables
const express = require('express');
const cors = require('cors'); // Enable CORS
const axios = require('axios');
const { google } = require('googleapis');

const app = express();
app.use(express.json());
app.use(cors());

// Load environment variables
const PORT = process.env.PORT || 3000;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Sheet1';
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH || './api.json';

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  keyFile: SERVICE_ACCOUNT_PATH, // Path to your service account file
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Fetch Telegram user info
app.get('/telegram-info', async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const userInfo = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getChat?chat_id=${user_id}`);

    if (!userInfo.data.ok || !userInfo.data.result.username) {
      throw new Error('Failed to fetch Telegram username. Ensure the user has a username set.');
    }

    res.json({
      telegramUsername: userInfo.data.result.username,
    });
  } catch (error) {
    console.error('Error fetching Telegram info:', error.message);
    res.status(500).json({ error: 'Failed to fetch Telegram info. Please ensure the user has a username set.' });
  }
});

// Handle form submission
app.post('/submit', async (req, res) => {
  const formData = req.body;

  // Validate required fields
  if (
    !formData.userId ||
    !formData.groupId ||
    !formData.messageId ||
    !formData.name ||
    !formData.email ||
    !formData.telegramUsername ||
    !formData.miId ||
    !formData.country ||
    !formData.dob ||
    !formData.reasonToJoin
  ) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    // Send welcome message
    const welcomeMessageResponse = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: formData.userId,
        text: `🎉 Welcome to xiaomi india official group! 🎉`,
      }
    );

    if (!welcomeMessageResponse.data.ok) {
      throw new Error('Failed to send welcome message.');
    }

    // Delete welcome message
    const deleteMessageResponse = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`,
      {
        chat_id: formData.groupId,
        message_id: formData.messageId,
      }
    );

    if (!deleteMessageResponse.data.ok) {
      throw new Error('Failed to delete welcome message.');
    }

    // Save to Google Sheets
    const sheets = google.sheets({ version: 'v4', auth });
    const appendResponse = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:H1`, // Append to the first row
      valueInputOption: 'RAW',
      resource: {
        values: [
          [
            formData.name,
            formData.email,
            formData.telegramUsername,
            formData.miId,
            formData.country,
            formData.dob,
            formData.reasonToJoin,
            new Date().toISOString(),
          ],
        ],
      },
    });

    if (appendResponse.status !== 200) {
      throw new Error('Failed to save data to Google Sheets.');
    }

    // Unmute user
    const unmuteResponse = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/restrictChatMember`,
      {
        chat_id: formData.groupId,
        user_id: formData.userId,
        permissions: {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_polls: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true,
          can_change_info: false,
          can_invite_users: false,
          can_pin_messages: false,
        },
      }
    );

    if (!unmuteResponse.data.ok) {
      throw new Error('Failed to unmute user.');
    }

    res.json({ message: 'You have been verified & unmuted! Please close the web app.' });
  } catch (error) {
    console.error('Error during form submission:', error.message);
    res.status(500).json({ error: `An error occurred: ${error.message}` });
  }
});

// Serve static files
app.use(express.static('public'));

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
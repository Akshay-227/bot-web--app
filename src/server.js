require('dotenv').config(); // Add this line at the top
const express = require('express');
const cors = require('cors'); // Import the cors package
const axios = require('axios');
const { google } = require('googleapis')

const app = express();
app.use(express.json());
app.use(cors()); // Add this line
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

// Fetch Telegram user and group info
app.get('/telegram-info', async (req, res) => {
  const { user_id } = req.query;
    console.log(user_id, TELEGRAM_TOKEN)
  try {
    const userInfo = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getChat?chat_id=${user_id}`);
    console.log(userInfo)

    res.json({
      telegramUsername: userInfo.data.result.username,
    });
  } catch (error) {
    console.error('Error fetching Telegram info:', error);
    res.status(500).json({ error: 'Failed to fetch Telegram info' });
  }
});

// Handle form submission
app.post('/submit', async (req, res) => {
  const formData = req.body;
    console.log('Form data:', formData);
  try {
    // Send welcome message
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: formData.userId,
      text: `🎉 Welcome to xiaomi india official group! 🎉`,
    });

    // Delete welcome message
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
      chat_id: formData.groupId,
      message_id: formData.messageId,
    });


        // Save to Google Sheets
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A1:H1`, // Corrected range          
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


    // Unmute user
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/restrictChatMember`, {
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
    });

    res.json({ message: 'You have been verified & unmuted! Please close the web app.' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'An error occurred. Please try again.' });
  }
});

// Serve static files
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
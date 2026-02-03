const { google } = require("googleapis");
const { GMAIL_SCOPES } = require("../config/constants");

class GmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );
  }

  // Generate OAuth URL
  getAuthUrl(state = "") {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: GMAIL_SCOPES,
      prompt: "consent", // Force to get refresh token
      state: state,
    });
    return authUrl;
  }

  // Exchange authorization code for tokens
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      return tokens;
    } catch (error) {
      throw new Error(
        "Failed to exchange authorization code: " + error.message,
      );
    }
  }

  // Set credentials for API calls
  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  // Get Gmail API instance
  getGmailApi() {
    return google.gmail({ version: "v1", auth: this.oauth2Client });
  }

  // Refresh access token if expired
  async refreshAccessToken(refreshToken) {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      return credentials;
    } catch (error) {
      throw new Error("Failed to refresh access token: " + error.message);
    }
  }

  // Fetch emails with query
  async fetchEmails(query, maxResults = 100) {
    try {
      const gmail = this.getGmailApi();

      const response = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: maxResults,
      });

      if (!response.data.messages) {
        return [];
      }

      // Fetch full message details
      const messages = await Promise.all(
        response.data.messages.map(async (message) => {
          const details = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
            format: "full",
          });
          return details.data;
        }),
      );

      return messages;
    } catch (error) {
      throw new Error("Failed to fetch emails: " + error.message);
    }
  }

  // Parse email message
  parseMessage(message) {
    const headers = message.payload.headers;

    const getHeader = (name) => {
      const header = headers.find(
        (h) => h.name.toLowerCase() === name.toLowerCase(),
      );
      return header ? header.value : "";
    };

    let body = "";

    // Extract body
    if (message.payload.body.data) {
      body = Buffer.from(message.payload.body.data, "base64").toString("utf-8");
    } else if (message.payload.parts) {
      const textPart = message.payload.parts.find(
        (part) =>
          part.mimeType === "text/plain" || part.mimeType === "text/html",
      );
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    }

    return {
      id: message.id,
      subject: getHeader("Subject"),
      from: getHeader("From"),
      date: getHeader("Date"),
      body: body,
      snippet: message.snippet,
    };
  }
}

module.exports = new GmailService();

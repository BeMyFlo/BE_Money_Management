const { CATEGORY_KEYWORDS } = require("../config/constants");
const BankEmailConfig = require("../models/BankEmailConfig");

class TransactionParser {
  // Find matching config for email
  async findMatchingConfig(emailData, userId) {
    try {
      const configs = await BankEmailConfig.find({
        userId,
        isActive: true,
      });

      for (const config of configs) {
        if (this.matchesConfig(emailData, config)) {
          return config;
        }
      }

      return null;
    } catch (error) {
      console.error("Error finding matching config:", error);
      return null;
    }
  }

  // Check if email matches a config
  matchesConfig(emailData, config) {
    const { from, subject, body, snippet } = emailData;
    const fullText =
      `${subject || ""} ${body || ""} ${snippet || ""}`.toLowerCase();
    const fromLower = (from || "").toLowerCase();
    const subjectLower = (subject || "").toLowerCase();

    // Check from patterns
    const matchesFrom = config.fromPatterns.some((pattern) =>
      fromLower.includes(pattern.toLowerCase()),
    );

    if (!matchesFrom) {
      return false;
    }

    // Check subject patterns (if configured)
    if (config.subjectPatterns && config.subjectPatterns.length > 0) {
      const matchesSubject = config.subjectPatterns.some((pattern) =>
        subjectLower.includes(pattern.toLowerCase()),
      );

      if (!matchesSubject) {
        return false;
      }
    }

    // Check body keywords (if configured)
    if (config.bodyKeywords && config.bodyKeywords.length > 0) {
      const matchesKeywords = config.bodyKeywords.some((keyword) =>
        fullText.includes(keyword.toLowerCase()),
      );

      console.log(
        "Checking body keywords:",
        config.bodyKeywords,
        "→",
        matchesKeywords,
      );

      if (!matchesKeywords) {
        return false;
      }
    }

    return true;
  }

  // Extract transaction from email content using config
  async parseTransaction(emailData, configOrUserId) {
    const { subject, body, snippet, from, date } = emailData;
    const fullText = `${subject} ${body} ${snippet}`.toLowerCase();

    console.log("\n=== PARSING EMAIL ===");
    console.log("Subject:", subject);
    console.log("From:", from);
    console.log("Snippet:", snippet ? snippet.substring(0, 200) : "");

    // Get matching config
    let config;
    if (typeof configOrUserId === "string") {
      // It's a userId, find matching config
      config = await this.findMatchingConfig(emailData, configOrUserId);
      if (!config) {
        console.log("No matching config found");
        return null;
      }
    } else {
      // It's already a config object (for testing)
      config = configOrUserId;
      if (!this.matchesConfig(emailData, config)) {
        console.log("Email does not match provided config");
        return null;
      }
    }

    console.log("Using config:", config.name);

    const transaction = {
      amount: this.extractAmount(fullText, config),
      date: this.extractDate(fullText, date, config),
      description: this.extractDescription(subject, body, config),
      transactionType: this.extractTransactionType(subject, body),
      bankName: config.bankName,
      rawText: fullText,
    };

    console.log("Extracted Amount:", transaction.amount);
    console.log("Extracted Bank:", transaction.bankName);
    console.log("Extracted Description:", transaction.description);
    console.log("Extracted Transaction Type:", transaction.transactionType);

    // Only return if we found an amount
    if (transaction.amount) {
      transaction.category = this.categorizeTransaction(
        transaction.description,
        transaction.transactionType,
      );
      return transaction;
    }

    return null;
  }

  // Extract amount from text using config patterns
  extractAmount(text, config) {
    // Build regex patterns from user-provided labels
    if (config.amountLabels && config.amountLabels.length > 0) {
      for (const label of config.amountLabels) {
        try {
          // Escape special regex characters in the label
          const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          // Create pattern: label followed by optional colon/space and numbers
          const pattern = new RegExp(
            `${escapedLabel}[:\\s]+([0-9,]+)(?:\\s*(?:vnd|đồng|dong))?`,
            "i",
          );
          const match = text.match(pattern);
          if (match && match[1]) {
            const amount = parseFloat(match[1].replace(/,/g, ""));
            if (amount > 0) {
              console.log(`Found amount with label "${label}":`, amount);
              return amount;
            }
          }
        } catch (error) {
          console.error("Error processing amount label:", label, error);
        }
      }
    }

    // Fallback to default patterns
    const patterns = [
      // VPBank specific: "Số tiền trích nợ: 200,000 VND" or "Debit Amount"
      /(?:số tiền trích nợ|debit amount)[:\s]+([0-9,]+)\s*vnd/i,

      // Vietnamese format: "1,500,000 VND" or "Amount 1,500,000 VND"
      /amount[:\s]+([0-9,]+)\s*vnd/i,
      /(?:số tiền|so tien)[:\s]+([0-9,]+)\s*vnd/i,
      /([0-9,]+)\s*vnd/i,
      /([0-9,]+)\s*(?:đồng|dong)/i,

      // Generic number patterns (no currency symbol)
      /amount[:\s]+([0-9,]+)/i,
      /(?:số tiền|so tien)[:\s]+([0-9,]+)/i,
      /debited[:\s]+([0-9,]+)/i,
      /credited[:\s]+([0-9,]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ""));
        if (amount > 0) {
          return amount;
        }
      }
    }

    return null;
  }

  // Extract transaction date using config patterns
  extractDate(text, emailDate, config) {
    // Always use default patterns (no custom date patterns from user)
    const datePatterns = [
      // Vietnamese date format: "13:38 Thứ Ba 03/02/2026" or just "03/02/2026"
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        // Parse DD/MM/YYYY format (Vietnamese)
        const [day, month, year] = match[1].split("/");
        const parsedDate = new Date(year, parseInt(month) - 1, parseInt(day));

        console.log("Parsing date:", match[1], "→", parsedDate.toISOString());

        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }

    // Fallback to email date
    console.log(
      "Using email date fallback:",
      new Date(emailDate).toISOString(),
    );
    return new Date(emailDate);
  }

  // Extract description/merchant using config patterns
  extractDescription(subject, body, config) {
    subject = subject.replace(/re:|fwd:/gi, "").trim();
    const fullText = subject + " " + body;

    // Build regex patterns from user-provided labels
    if (config.descriptionLabels && config.descriptionLabels.length > 0) {
      for (const label of config.descriptionLabels) {
        try {
          // Escape special regex characters in the label
          const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          // Create pattern: label followed by colon/space and capture the content
          const pattern = new RegExp(
            `${escapedLabel}[:\\s]+([^\\n\\r<>]+?)(?:\\s*(?:<|cám ơn|thank you|^\\s*$))`,
            "i",
          );
          const match = fullText.match(pattern);
          if (match && match[1]) {
            let extracted = match[1].trim();
            extracted = extracted.replace(/\s+/g, " ");
            extracted = extracted.replace(/\s*\(.*?\)\s*/g, " ");
            extracted = extracted.trim();

            if (extracted.length >= 5) {
              console.log(
                `Found description with label "${label}":`,
                extracted,
              );
              return extracted.substring(0, 100);
            }
          }
        } catch (error) {
          console.error("Error processing description label:", label, error);
        }
      }
    }

    // Ưu tiên lấy "Nội dung chuyển tiền" từ email ngân hàng Việt Nam
    const vietnamesePatterns = [
      // VPBank format: "Nội dung chuyển tiền: HA THANH TU chuyen tien"
      /nội dung chuyển tiền[:\s]+([^\n\r<>]+?)(?:\s*(?:<|cám ơn|thank you|^\s*$))/i,
      /details\s+of\s+payment[:\s]+([^\n\r<>]+?)(?:\s*(?:<|cám ơn|thank you|^\s*$))/i,

      // Match text sau "Details of Payment" cho đến khi gặp "Cám ơn" hoặc end
      /details\s+of\s+payment[\s\S]*?>\s*([A-Z][A-Za-z0-9\s]+?)(?:\s*<|cám ơn|thank you)/i,
      // Match text sau "Nội dung chuyển tiền"
      /nội dung chuyển tiền[\s\S]*?>\s*([A-Z][A-Za-z0-9\s]+?)(?:\s*<|cám ơn|thank you)/i,
      /noi dung chuyen tien[\s\S]*?>\s*([A-Z][A-Za-z0-9\s]+?)(?:\s*<|cám ơn|thank you)/i,
      // Pattern for "NAME chuyen tien" format
      /([A-Z][A-Z\s]+ chuyen tien)/i,
    ];

    for (const pattern of vietnamesePatterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        let extracted = match[1].trim();
        // Loại bỏ các từ không cần thiết
        extracted = extracted.replace(/\s+/g, " ");
        extracted = extracted.replace(/\s*\(.*?\)\s*/g, " "); // Remove (...)
        extracted = extracted.trim();

        if (extracted.length >= 5) {
          console.log("Found Vietnamese description:", extracted);
          return extracted.substring(0, 100);
        }
      }
    }

    // Fallback về subject nếu không tìm thấy
    console.log("Using subject as description:", subject);
    return subject.substring(0, 100);
  }

  // Extract transaction type (debit/credit/credit_card_statement)
  extractTransactionType(subject, body) {
    const fullText = (subject + " " + body).toLowerCase();

    // Check for credit card statement first
    if (
      fullText.includes("sao kê") ||
      fullText.includes("sao ke") ||
      fullText.includes("credit card payment") ||
      fullText.includes("thẻ tín dụng") ||
      fullText.includes("the tin dung")
    ) {
      return "credit_card_statement";
    }

    // Check if it's incoming money (credit/received)
    if (
      fullText.includes("nhận tiền") ||
      fullText.includes("nhan tien") ||
      fullText.includes("received") ||
      fullText.includes("credited") ||
      fullText.includes("thu tiền") ||
      fullText.includes("thu tien")
    ) {
      return "credit";
    }

    // Default to debit (outgoing payment)
    return "debit";
  }

  // Categorize transaction based on description
  categorizeTransaction(description, transactionType) {
    const descLower = description.toLowerCase().trim();

    // If it's credit card statement
    if (transactionType === "credit_card_statement") {
      return "sao kê thẻ tín dụng";
    }

    // If it's incoming money
    if (transactionType === "credit") {
      // Check if description mentions salary/income
      if (
        descLower.includes("lương") ||
        descLower.includes("luong") ||
        descLower.includes("salary")
      ) {
        return "lương";
      }
      return "thu nhập";
    }

    // For debit: use the full description as category name
    // Keep the original description intact as the category
    let category = description.trim();

    // Only convert to lowercase for storage consistency
    if (!category || category.length < 2) {
      return "khác";
    }

    return category.toLowerCase();
  }
}

module.exports = new TransactionParser();

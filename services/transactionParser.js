const { CATEGORY_KEYWORDS } = require("../config/constants");

class TransactionParser {
  // Extract transaction from email content
  parseTransaction(emailData) {
    const { subject, body, snippet, from, date } = emailData;
    const fullText = `${subject} ${body} ${snippet}`.toLowerCase();

    console.log("\n=== PARSING EMAIL ===");
    console.log("Subject:", subject);
    console.log("From:", from);
    console.log("Snippet:", snippet.substring(0, 200));

    // Check if this is a transaction email
    const isTransaction = this.isTransactionEmail(fullText, from);
    console.log("Is Transaction Email:", isTransaction);

    if (!isTransaction) {
      return null;
    }

    const transaction = {
      amount: this.extractAmount(fullText),
      date: this.extractDate(fullText, date),
      description: this.extractDescription(subject, body),
      transactionType: this.extractTransactionType(subject, body),
      bankName: this.extractBankName(from),
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

  // Check if email is a transaction notification
  isTransactionEmail(text, from) {
    const transactionKeywords = [
      "debited",
      "credited",
      "spent",
      "payment",
      "withdrawn",
      "purchase",
      "transfer",
      "paid",
      "received",
      "chuyen tien", // Vietnamese: transfer money
      "giao dich", // Vietnamese: transaction
      "bien lai", // Vietnamese: receipt
      "so lenh giao dich", // Order number
      "tai khoan nguon", // Source account
    ];

    const fromLower = from.toLowerCase();

    // Check if from a known bank domain
    const bankDomains = [
      "vietcombank.com",
      "vcb",
      "sc.com", // SCB
      "techcombank.com",
      "tcb",
      "bidv.com",
      "vietinbank.com",
      "agribank.com",
      "mbbank.com",
      "acb.com",
      "sacombank.com",
      "vpbank.com",
    ];

    const isFromBank = bankDomains.some((domain) => fromLower.includes(domain));

    if (!isFromBank) {
      return false;
    }

    const hasTransactionKeyword = transactionKeywords.some((keyword) =>
      text.includes(keyword),
    );

    return hasTransactionKeyword && isFromBank;
  }

  // Extract amount from text
  extractAmount(text) {
    // Patterns for amount extraction (Vietnamese format priority)
    const patterns = [
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

  // Extract transaction date
  extractDate(text, emailDate) {
    // Try to find date in text
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

  // Extract description/merchant
  extractDescription(subject, body) {
    subject = subject.replace(/re:|fwd:/gi, "").trim();

    const fullText = subject + " " + body;

    // Ưu tiên lấy "Nội dung chuyển tiền" từ email ngân hàng Việt Nam
    const vietnamesePatterns = [
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

  // Extract bank name from email sender
  extractBankName(from) {
    const bankNames = [
      // Vietnamese banks
      "Vietcombank",
      "VCB",
      "SCB",
      "Standard Chartered",
      "Techcombank",
      "TCB",
      "BIDV",
      "VietinBank",
      "Agribank",
      "MB Bank",
      "ACB",
      "Sacombank",
      "VPBank",
      // Indian banks
      "HDFC",
      "ICICI",
      "SBI",
      "Axis",
      "Kotak",
      "Yes Bank",
      "IDFC",
      "Citibank",
      "HSBC",
      "IndusInd",
      "Punjab National",
      "Bank of Baroda",
      "Canara",
    ];

    const fromUpper = from.toUpperCase();

    for (const bank of bankNames) {
      if (fromUpper.includes(bank.toUpperCase())) {
        return bank;
      }
    }

    return "Unknown Bank";
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

function aiSupportReply(orderId, message) {
  const msg = (message || "").toLowerCase();

  if (
    msg.includes("screenshot") ||
    msg.includes("screenshots") ||
    msg.includes("skins") ||
    msg.includes("items included")
  ) {
    return `Yes 👍

All skins and items included are visible in the screenshots provided in the listing.

If you need any additional screenshots, just let me know.`;
  }

  if (msg.includes("login")⠞⠞⠵⠵⠺⠵⠺⠟⠺⠞⠟⠺⠞⠟⠵⠵⠵⠵⠟⠵⠟⠵⠺⠟⠞⠟msg.includes("can't login") || msg.includes("cannot login")) {
    return `Hi 👋

Please log in using the account details provided with your order.

1. Open Epic Games login page
2. Enter the provided login details
3. If a verification code appears, check the linked email inbox

If you still need help, the seller will assist you shortly.`;
  }

  if (msg.includes("code") || msg.includes("verification")) {
    return `That is normal.

Sometimes the email provider asks for a verification code for security.

Please check the linked email inbox and enter the code shown there.

If you still need help, the seller will assist you shortly.`;
  }

  if (msg.includes("hello")⠟⠵⠺⠵⠵⠟⠺⠞⠵⠟⠵⠵⠺⠵⠵⠟⠵⠺⠺⠟⠵⠟msg.trim() === "?") {
    return `Hello 👋

Thanks for contacting us.

If you have any questions about the account or the items included, feel free to ask.`;
  }

  return null;
}

module.exports = { aiSupportReply };

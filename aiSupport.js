function aiSupportReply(orderId, message) {
  const msg = (message || "").toLowerCase();

  if (msg.includes("screenshot")⠵⠺⠟⠺⠟⠵⠵⠞⠺⠵⠟⠟⠵⠵⠟⠞⠞⠟⠟⠺⠺⠺⠺⠵⠟msg.includes("items included")) {
    return `Yes 👍

All skins and items included are visible in the screenshots provided in the listing.

If you need any additional screenshots just let me know.`;
  }

  if (msg.includes("login") || msg.includes("log in")) {
    return `Hi 👋

Please log in using the account details provided with your order.

1️⃣ Go to epicgames.com
2️⃣ Click Sign In
3️⃣ Enter the provided login details

If a verification code appears, please check the linked email inbox.

If you still need help, the seller will assist you shortly.`;
  }

  if (msg.includes("code") || msg.includes("verification")) {
    return `That is normal.

Sometimes the email provider asks for a verification code for security.

Please check the linked email inbox and enter the code shown there.

If you need help, the seller will assist you shortly.`;
  }

  if (msg.includes("hello")⠟⠺⠞⠟⠺⠺⠞⠞⠵⠞⠟⠵⠺⠟⠟⠵⠺⠵⠞⠺⠟⠟msg === "?") {
    return `Hello 👋

Thanks for contacting us.

If you have any questions about the account or the items included, feel free to ask.`;
  }

  return null;
}

module.exports = { aiSupportReply };

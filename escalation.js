function isEscalationMessage(message) {
  const msg = (message || "").toLowerCase();

  const triggers = [
    "refund",
    "scam",
    "not working",
    "doesn't work",
    "does not work",
    "ban",
    "banned",
    "locked",
    "wrong account",
    "chargeback",
    "fake",
    "fraud",
    "problem",
    "issue",
    "angry"
  ];

  return triggers.some(word => msg.includes(word));
}

module.exports = { isEscalationMessage };

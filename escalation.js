function isEscalationMessage(message) {
  const msg = (message || "").toLowerCase();

  const triggers = [
    "refund",
    "scam",
    "not working",
    "doesn't work",
    "does not work",
    "banned",
    "ban",
    "locked",
    "wrong account",
    "fake",
    "fraud",
    "problem",
    "issue",
    "angry",
    "chargeback"
  ];

  return triggers.some((word) => msg.includes(word));
}

module.exports = { isEscalationMessage };

const orderStates = {};
const aiHandledOrders = new Set();
const welcomedOrders = new Set();

function disableAI(orderId) {
  orderStates[String(orderId)] = "SELLER";
}

function escalate(orderId) {
  orderStates[String(orderId)] = "ESCALATED";
}

function getState(orderId) {
  return orderStates[String(orderId)] || "AI";
}

function hasAIHandled(orderId) {
  return aiHandledOrders.has(String(orderId));
}

function markAIHandled(orderId) {
  aiHandledOrders.add(String(orderId));
}

function hasWelcomed(orderId) {
  return welcomedOrders.has(String(orderId));
}

function markWelcomed(orderId) {
  welcomedOrders.add(String(orderId));
}

module.exports = {
  disableAI,
  escalate,
  getState,
  hasAIHandled,
  markAIHandled,
  hasWelcomed,
  markWelcomed
};

export { supabase } from './supabase';
export { fetchProfile, upsertProfile } from './profileService';
export {
  fetchClients,
  createClient,
  searchClients,
  fetchClientWithTransactions,
} from './clientService';
export {
  fetchRecentTransactions,
  fetchDashboardSummary,
  createTransaction,
  updateTransactionStatus,
} from './transactionService';
export {
  fetchProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
} from './productService';
export {
  fetchScheduledMessages,
  fetchDueReminders,
  dismissReminder,
  fetchScheduledMessagesByClient,
  fetchScheduledMessage,
  createScheduledMessage,
  updateScheduledMessage,
  deleteScheduledMessage,
  toggleScheduledMessage,
} from './scheduledMessageService';

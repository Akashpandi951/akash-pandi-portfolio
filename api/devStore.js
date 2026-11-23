/**
 * api/devStore.js
 * In-memory fallback message store for seamless local development and automated testing
 * when external Supabase PostgreSQL credentials are not yet specified in .env.
 */

const devMessages = [
  {
    id: 'demo-msg-01',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@fintechsolutions.com',
    message: 'Hi Akash, we came across your portfolio and were really impressed by your data analytics projects and SQL background. We are expanding our data team and would love to schedule a preliminary conversation with you this week.',
    status: 'new',
    ip_address: '192.168.1.101',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    reply_notes: null,
    replied_at: null,
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo-msg-02',
    name: 'David Kumar',
    email: 'david.k@analyticsinsights.io',
    message: 'Hello Akash, great work on the AI-assisted development project! I had a quick question regarding the prompt engineering workflows you used. Let me know if you are open to discussing.',
    status: 'read',
    ip_address: '10.0.0.45',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    reply_notes: null,
    replied_at: null,
    created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  },
  {
    id: 'demo-msg-03',
    name: 'Elena Rostova',
    email: 'elena@moderntechlabs.org',
    message: 'Hi Akash, following up on our discussion regarding the junior data analyst position. We sent over the initial technical assessment to your email.',
    status: 'replied',
    ip_address: '172.16.0.12',
    user_agent: 'Mozilla/5.0 (X11; Linux x86_64)',
    reply_notes: 'Confirmed receipt of technical assessment and submitted solutions.',
    replied_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  }
];

module.exports = {
  devMessages,
  addDevMessage(msg) {
    devMessages.unshift(msg);
  },
  getDevMessages({ status, search, page = 1, limit = 20 }) {
    let list = [...devMessages];
    if (status && status !== 'all') {
      list = list.filter(m => m.status === status);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.message.toLowerCase().includes(q)
      );
    }
    const total = list.length;
    const offset = (page - 1) * limit;
    const paginated = list.slice(offset, offset + limit);

    const stats = {
      total: devMessages.length,
      new: devMessages.filter(m => m.status === 'new').length,
      read: devMessages.filter(m => m.status === 'read').length,
      replied: devMessages.filter(m => m.status === 'replied').length
    };

    return {
      messages: paginated,
      total,
      stats,
      totalPages: Math.ceil(total / limit) || 1
    };
  },
  updateDevMessageStatus(id, newStatus) {
    const item = devMessages.find(m => m.id === id);
    if (item) {
      item.status = newStatus;
      item.updated_at = new Date().toISOString();
      return item;
    }
    return null;
  },
  replyDevMessage(id, replyText) {
    const item = devMessages.find(m => m.id === id);
    if (item) {
      item.status = 'replied';
      item.reply_notes = replyText;
      item.replied_at = new Date().toISOString();
      item.updated_at = new Date().toISOString();
      return item;
    }
    return null;
  },
  deleteDevMessage(id) {
    const index = devMessages.findIndex(m => m.id === id);
    if (index !== -1) {
      return devMessages.splice(index, 1)[0];
    }
    return null;
  }
};

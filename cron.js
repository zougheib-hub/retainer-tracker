const { kv } = require('@vercel/kv');
const webpush = require('web-push');

module.exports = async function handler(req, res) {
  // Vercel automatically injects CRON_SECRET and sends it in the Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL || 'retainer@tracker.app'}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const data = await kv.get('push_data');
    if (!data) {
      return res.status(200).json({ ok: true, message: 'No subscription found' });
    }

    const { subscription, currentRetainer, switchDate } = data;

    // Use Dubai time (UTC+4) to determine today's date
    const dubaiOffset = 4 * 60 * 60 * 1000;
    const dubaiNow = new Date(Date.now() + dubaiOffset);
    const today = dubaiNow.toISOString().split('T')[0];

    // Days since switch date (0 = switch day, 1 = one day overdue, etc.)
    const daysDiff = Math.floor(
      (new Date(today) - new Date(switchDate)) / 86400000
    );

    // Notify on switch day and up to 2 days after (in case user missed it)
    if (daysDiff >= 0 && daysDiff <= 2) {
      const nextRetainer = currentRetainer === 3 ? 1 : currentRetainer + 1;
      const isOverdue = daysDiff > 0;

      const title = isOverdue
        ? `⚠️ Overdue — Switch retainer!`
        : `🦷 Time to switch retainer`;

      const body = isOverdue
        ? `You're ${daysDiff} day${daysDiff > 1 ? 's' : ''} late. Switch from ${currentRetainer} → ${nextRetainer} now.`
        : `Switch from Retainer ${currentRetainer} → Retainer ${nextRetainer} today.`;

      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title, body, url: '/' })
      );

      return res.status(200).json({ ok: true, notified: true, today, switchDate, daysDiff });
    }

    res.status(200).json({ ok: true, notified: false, today, switchDate, daysDiff });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
};

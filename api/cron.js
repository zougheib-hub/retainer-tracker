const webpush = require('web-push');

module.exports = async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const getRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/push_data`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });
    const { result } = await getRes.json();
    if (!result) return res.status(200).json({ ok: true, message: 'No subscription' });

    const { subscription, currentRetainer, switchDate } = JSON.parse(result);

    // Dubai is UTC+4 — today's date in Dubai time
    const dubaiNow = new Date(Date.now() + 4 * 60 * 60 * 1000);
    const todayDubai = dubaiNow.toISOString().split('T')[0];

    if (todayDubai < switchDate) {
      return res.status(200).json({ ok: true, message: 'Not due yet' });
    }

    const nextRetainer = currentRetainer === 3 ? 1 : currentRetainer + 1;
    const payload = JSON.stringify({
      title: '🦷 Time to switch retainers',
      body: `Switch from Retainer ${currentRetainer} to Retainer ${nextRetainer} now.`,
      url: '/'
    });

    await webpush.sendNotification(subscription, payload);
    res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(500).json({ error: err.message });
  }
};
